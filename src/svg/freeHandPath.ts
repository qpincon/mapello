import fitCurve from 'fit-curve';

// ── Speed-aware fitting constants ────────────────────────────────────────────
const MIN_ERROR   = 5;    // tight/detailed fit (slow strokes)
const MAX_ERROR   = 60;   // smooth/loose fit  (fast strokes)
const SPEED_SLOW  = 0.15; // px/ms at/below → MIN_ERROR
const SPEED_FAST  = 1.0;  // px/ms at/above → MAX_ERROR
const EMA_ALPHA   = 0.35; // exponential-moving-average smoothing for speed
const ERROR_BANDS = 5;    // quantize errors to this many levels (reduces join points)
const MIN_RUN_PTS = 4;    // merge runs shorter than this into a neighbour
// ─────────────────────────────────────────────────────────────────────────────

type TimedPoint = [number, number, number]; // [x, y, t_ms]

let rawLineData: TimedPoint[] = [];
let isMouseDown: boolean = false;
let fittedCurveData: [number, number][][] | undefined;
let fittedCurve: SVGPathElement | null = null;
let svgElem: SVGSVGElement | null = null;
let endCb: ((path: SVGPathElement) => void) | undefined;

export function freeHandDrawPath(svg: SVGSVGElement, onEnd: (path: SVGPathElement) => void): void {
    endCb = onEnd;
    svgElem = svg;
    svgElem.addEventListener('mousedown', onMouseDown);
    svgElem.addEventListener('mouseup', onMouseUp);
    svgElem.addEventListener('mousemove', onMouseMove);
}

export function cancelFreeHandDrawPath(): void {
    detachListeners();
    if (fittedCurve) {
        fittedCurve.remove();
        fittedCurve = null;
    }
    rawLineData = [];
    isMouseDown = false;
}

function onMouseDown(): void {
    rawLineData = [];
    fittedCurve = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // Use svgElem.querySelector to avoid matching non-SVG elements with the same id (e.g. layer checkboxes in the sidebar)
    const pathsContainer = svgElem?.querySelector('#paths');
    if (pathsContainer && fittedCurve) {
        pathsContainer.append(fittedCurve);
    }
    isMouseDown = true;
}

function onMouseUp(): void {
    isMouseDown = false;
    detachListeners();
    if (endCb && fittedCurve) {
        endCb(fittedCurve);
    }
    fittedCurve = null;
}

function onMouseMove(event: MouseEvent): void {
    if (!isMouseDown || !svgElem) return;
    const containerArea = svgElem.getBoundingClientRect();
    const x = event.clientX - containerArea.left;
    const y = event.clientY - containerArea.top;
    rawLineData.push([x, y, event.timeStamp]);
    updateLine();
}

function detachListeners(): void {
    if (svgElem) {
        svgElem.removeEventListener('mousedown', onMouseDown);
        svgElem.removeEventListener('mouseup', onMouseUp);
        svgElem.removeEventListener('mousemove', onMouseMove);
    }
}

function fittedCurveDataToPathString(fittedLineData: [number, number][][]): string {
    let str = "";
    fittedLineData.forEach((bezier, i) => {
        if (i === 0) {
            str += `M ${bezier[0][0]} ${bezier[0][1]}`;
        }
        str += `C ${bezier[1][0]} ${bezier[1][1]}, ${bezier[2][0]} ${bezier[2][1]}, ${bezier[3][0]} ${bezier[3][1]} `;
    });
    return str;
}

// ── Speed-aware helpers ───────────────────────────────────────────────────────

/** Map a drawing speed (px/ms) to a fit-curve error tolerance. */
function speedToError(speed: number): number {
    const t = Math.max(0, Math.min(1, (speed - SPEED_SLOW) / (SPEED_FAST - SPEED_SLOW)));
    return MIN_ERROR + t * (MAX_ERROR - MIN_ERROR);
}

/** Snap a continuous error to one of ERROR_BANDS discrete steps. */
function quantizeError(error: number): number {
    const step = (MAX_ERROR - MIN_ERROR) / (ERROR_BANDS - 1);
    return MIN_ERROR + Math.round((error - MIN_ERROR) / step) * step;
}

/**
 * For each point in `pts`, compute an EMA-smoothed speed and return
 * its quantized error tolerance.
 */
function perPointErrors(pts: TimedPoint[]): number[] {
    const errors: number[] = new Array(pts.length);
    let emaSpeed = 0;
    for (let i = 0; i < pts.length; i++) {
        if (i === 0) {
            errors[0] = quantizeError(speedToError(0));
            continue;
        }
        const dx = pts[i][0] - pts[i - 1][0];
        const dy = pts[i][1] - pts[i - 1][1];
        const dt = Math.max(pts[i][2] - pts[i - 1][2], 1); // guard dt === 0
        const instSpeed = Math.sqrt(dx * dx + dy * dy) / dt;
        emaSpeed = i === 1 ? instSpeed : EMA_ALPHA * instSpeed + (1 - EMA_ALPHA) * emaSpeed;
        errors[i] = quantizeError(speedToError(emaSpeed));
    }
    return errors;
}

interface Run { start: number; end: number; error: number }

/**
 * Group points into contiguous runs that share the same quantized error.
 * Merge short runs into a neighbour so each run is ≥ MIN_RUN_PTS long.
 */
function buildRuns(errors: number[]): Run[] {
    if (errors.length === 0) return [];

    // Build raw runs
    const runs: Run[] = [];
    let runStart = 0;
    for (let i = 1; i <= errors.length; i++) {
        if (i === errors.length || errors[i] !== errors[runStart]) {
            runs.push({ start: runStart, end: i - 1, error: errors[runStart] });
            runStart = i;
        }
    }

    // Merge short runs
    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < runs.length; i++) {
            const len = runs[i].end - runs[i].start + 1;
            if (len < MIN_RUN_PTS) {
                // Prefer merging into previous, fall back to next
                const target = i > 0 ? i - 1 : i + 1;
                if (target >= runs.length) break;
                runs[target].start = Math.min(runs[target].start, runs[i].start);
                runs[target].end   = Math.max(runs[target].end,   runs[i].end);
                runs.splice(i, 1);
                changed = true;
                break; // restart
            }
        }
    }

    return runs;
}

// ─────────────────────────────────────────────────────────────────────────────

function updateLine(): void {
    if (rawLineData.length <= 1 || !fittedCurve) return;

    const errors = perPointErrors(rawLineData);
    const runs   = buildRuns(errors);

    const allBeziers: [number, number][][] = [];
    for (let r = 0; r < runs.length; r++) {
        const run = runs[r];
        // Start one point earlier for runs after the first → share boundary point → no gap
        const sliceStart = r === 0 ? run.start : run.start - 1;
        const slice2D = rawLineData.slice(sliceStart, run.end + 1)
            .map(([x, y]) => [x, y] as [number, number]);
        if (slice2D.length < 2) continue;
        const beziers = fitCurve(slice2D, run.error);
        allBeziers.push(...beziers);
    }

    if (allBeziers.length > 0) {
        fittedCurveData = allBeziers;
        fittedCurve.setAttribute("d", fittedCurveDataToPathString(fittedCurveData));
    }
}
