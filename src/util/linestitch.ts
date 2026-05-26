import type { Feature, LineString, GeoJsonProperties, Position } from "geojson";

const SCALE = 10000000;

const pointToKey = (p: Position): string =>
  `${Math.round(p[0] * SCALE)}|${Math.round(p[1] * SCALE)}`;

/**
 * Merges GeoJSON LineString Features that share their first or last points.
 * Single-pass O(N + total_coords) graph walk — finds maximal degree-2 paths in
 * the endpoint graph and stops at junctions (degree ≥ 3) and dead ends (degree 1).
 */
export function mergeLineStrings(features: Array<Feature<LineString>>): Array<Feature<LineString>> {
  if (!features || features.length === 0) return [];

  const valid: Array<Feature<LineString>> = [];
  for (const f of features) {
    if (f && f.geometry?.type === 'LineString' &&
        Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length > 0) {
      valid.push(f);
    }
  }
  if (valid.length === 0) return [];

  const N = valid.length;
  const firstKeys: string[] = new Array(N);
  const lastKeys: string[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const c = valid[i].geometry.coordinates;
    firstKeys[i] = pointToKey(c[0]);
    lastKeys[i] = pointToKey(c[c.length - 1]);
  }

  // adjacency: endpoint key -> packed entries where entry = (lineIdx << 1) | isLast
  // isLast=0 means the line connects here via its FIRST endpoint
  // isLast=1 means the line connects here via its LAST endpoint
  const adj = new Map<string, number[]>();
  for (let i = 0; i < N; i++) {
    let l = adj.get(firstKeys[i]);
    if (!l) { l = []; adj.set(firstKeys[i], l); }
    l.push(i << 1);           // isLast=0

    l = adj.get(lastKeys[i]);
    if (!l) { l = []; adj.set(lastKeys[i], l); }
    l.push((i << 1) | 1);     // isLast=1
  }

  const visited = new Uint8Array(N);
  const out: Array<Feature<LineString>> = [];

  // Reuse piece arrays across iterations to avoid GC pressure
  const rightPieces: Array<{ idx: number; reversed: boolean }> = [];
  const leftPieces: Array<{ idx: number; reversed: boolean }> = [];

  for (let i = 0; i < N; i++) {
    if (visited[i]) continue;
    visited[i] = 1;
    rightPieces.length = 0;
    leftPieces.length = 0;
    let ringClosed = false;

    // Walk RIGHT: extend the chain from lastKeys[i] outward
    let curKey = lastKeys[i];
    while (true) {
      const cands = adj.get(curKey);
      if (!cands || cands.length !== 2) break;   // dead end or junction — stop
      let enc = -1;
      for (let k = 0; k < cands.length; k++) {
        if (!visited[cands[k] >>> 1]) { enc = cands[k]; break; }
      }
      if (enc < 0) break;                        // both neighbors already visited
      const oIdx = enc >>> 1;
      const oIsLast = (enc & 1) === 1;
      visited[oIdx] = 1;
      // oIsLast=false: neighbor connects via its first endpoint → walk it forward (not reversed)
      // oIsLast=true:  neighbor connects via its last endpoint  → walk it backward (reversed)
      rightPieces.push({ idx: oIdx, reversed: oIsLast });
      curKey = oIsLast ? firstKeys[oIdx] : lastKeys[oIdx];
      if (curKey === firstKeys[i]) { ringClosed = true; break; }
    }

    // Walk LEFT: extend the chain from firstKeys[i] outward (skip if ring already closed)
    if (!ringClosed) {
      curKey = firstKeys[i];
      while (true) {
        const cands = adj.get(curKey);
        if (!cands || cands.length !== 2) break;
        let enc = -1;
        for (let k = 0; k < cands.length; k++) {
          if (!visited[cands[k] >>> 1]) { enc = cands[k]; break; }
        }
        if (enc < 0) break;
        const oIdx = enc >>> 1;
        const oIsLast = (enc & 1) === 1;
        visited[oIdx] = 1;
        // For prepending we need the "away" direction of the neighbor:
        // oIsLast=false: neighbor's first endpoint is here → prepend it reversed so its last becomes leftmost
        // oIsLast=true:  neighbor's last endpoint is here  → prepend it in natural order so its first becomes leftmost
        leftPieces.push({ idx: oIdx, reversed: !oIsLast });
        curKey = oIsLast ? firstKeys[oIdx] : lastKeys[oIdx];
      }
    }

    if (rightPieces.length === 0 && leftPieces.length === 0) {
      out.push(valid[i]);
      continue;
    }

    // Compute total coordinate count so we allocate exactly once
    const startCoords = valid[i].geometry.coordinates;
    let total = startCoords.length;
    for (let k = 0; k < leftPieces.length; k++)  total += valid[leftPieces[k].idx].geometry.coordinates.length - 1;
    for (let k = 0; k < rightPieces.length; k++) total += valid[rightPieces[k].idx].geometry.coordinates.length - 1;

    const merged: Position[] = new Array(total);
    let w = 0;

    // Emit left pieces in reverse walk order (farthest from start comes first in the output)
    for (let k = leftPieces.length - 1; k >= 0; k--) {
      const oc = valid[leftPieces[k].idx].geometry.coordinates;
      const n = oc.length;
      if (leftPieces[k].reversed) {
        // Connected via first endpoint, stored reversed → emit coords[n-1..1] (skip shared first)
        for (let j = n - 1; j >= 1; j--) merged[w++] = oc[j];
      } else {
        // Connected via last endpoint, natural order → emit coords[0..n-2] (skip shared last)
        for (let j = 0; j < n - 1; j++) merged[w++] = oc[j];
      }
    }

    // Emit start coords in full (includes both shared endpoints)
    for (let j = 0; j < startCoords.length; j++) merged[w++] = startCoords[j];

    // Emit right pieces in walk order
    for (let k = 0; k < rightPieces.length; k++) {
      const oc = valid[rightPieces[k].idx].geometry.coordinates;
      const n = oc.length;
      if (rightPieces[k].reversed) {
        // Connected via last endpoint, stored reversed → emit coords[n-2..0] (skip shared last)
        for (let j = n - 2; j >= 0; j--) merged[w++] = oc[j];
      } else {
        // Connected via first endpoint, natural order → emit coords[1..n-1] (skip shared first)
        for (let j = 1; j < n; j++) merged[w++] = oc[j];
      }
    }

    // Build merged properties once in final chain order (left-to-right)
    const props: GeoJsonProperties = {};
    for (let k = leftPieces.length - 1; k >= 0; k--) Object.assign(props as object, valid[leftPieces[k].idx].properties);
    Object.assign(props as object, valid[i].properties);
    for (let k = 0; k < rightPieces.length; k++) Object.assign(props as object, valid[rightPieces[k].idx].properties);
    (props as any).merged = true;

    out.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: merged },
      properties: props,
    });
  }

  return out;
}
