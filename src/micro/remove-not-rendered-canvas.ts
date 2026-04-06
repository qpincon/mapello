// Minimum number of canvas pixels an element must occupy to be considered visible.
// This filters out fully-occluded quads (0 pixels) and anti-aliased edge slivers
// while keeping any meaningfully visible wall.
const PIXEL_THRESHOLD = 10;

function randomColor(): [number, number, number] {
	// Avoid 0 (background) and stay away from edges to reduce anti-aliasing collisions
	const r = 10 + Math.floor(Math.random() * 235);
	const g = 10 + Math.floor(Math.random() * 235);
	const b = 10 + Math.floor(Math.random() * 235);
	return [r, g, b];
}

function countMAndL(d: string): number {
	// Count M/L/m/l commands to determine if this is a quad (exactly 4 vertices).
	// Avoids pulling in parse-svg-path for a simple count.
	let n = 0;
	for (let i = 0; i < d.length; i++) {
		const c = d[i];
		if (c === 'M' || c === 'L' || c === 'm' || c === 'l') n++;
	}
	return n;
}

function showDebugCanvas(canvas: OffscreenCanvas, svgRect: DOMRect) {
	document.querySelector("[data-debug-canvas]")?.remove();
	const visible = document.createElement("canvas");
	visible.setAttribute("data-debug-canvas", "");
	visible.width = canvas.width;
	visible.height = canvas.height;
	visible.style.cssText = `position:fixed;left:${svgRect.left}px;top:${svgRect.top}px;width:${svgRect.width}px;height:${svgRect.height}px;z-index:999999;pointer-events:none;opacity:.3;`;
	visible.getContext("2d")!.drawImage(canvas, 0, 0);
	document.body.appendChild(visible);
}

export function removeNotRenderedElements(pathElements: SVGPathElement[], scale = 6, enableDebug = false) {
	if (pathElements.length === 0) return 0;

	const svg = pathElements[0].ownerSVGElement;
	if (!svg) return 0;

	const svgRect = svg.getBoundingClientRect();
	const w = Math.ceil(svgRect.width * scale);
	const h = Math.ceil(svgRect.height * scale);
	if (w === 0 || h === 0) return 0;

	console.time('Remove not rendered elements');
	const canvas = new OffscreenCanvas(w, h);
	const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
	const originX = svgRect.left;
	const originY = svgRect.top;

	// Assign a random color to each element and paint in DOM order (painter's algorithm).
	// Elements painted later overwrite earlier ones, so an occluded element's color
	// will have zero (or very few) pixels remaining after all elements are drawn.
	const colors = new Uint8Array(pathElements.length * 3);
	for (let idx = 0; idx < pathElements.length; idx++) {
		const [r, g, b] = randomColor();
		colors[idx * 3] = r;
		colors[idx * 3 + 1] = g;
		colors[idx * 3 + 2] = b;

		const el = pathElements[idx];
		const d = el.getAttribute("d");
		if (!d) continue;

		const style = getComputedStyle(el);
		if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0")
			continue;

		const ctm = el.getScreenCTM();
		if (!ctm) continue;

		ctx.setTransform(
			ctm.a * scale, ctm.b * scale,
			ctm.c * scale, ctm.d * scale,
			(ctm.e - originX) * scale, (ctm.f - originY) * scale,
		);
		ctx.fillStyle = `rgb(${r},${g},${b})`;
		ctx.fill(new Path2D(d));
	}

	// Count how many canvas pixels each color occupies in a single pass.
	// Key: r << 16 | g << 8 | b  (fits in a 24-bit integer).
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	const pixels = ctx.getImageData(0, 0, w, h).data;
	const colorCounts = new Map<number, number>();
	for (let i = 0; i < pixels.length; i += 4) {
		if (pixels[i + 3] === 0) continue; // skip transparent background
		const key = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
		colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
	}

	if (enableDebug) showDebugCanvas(canvas, svgRect);

	// Remove quads whose color has fewer than PIXEL_THRESHOLD pixels on the canvas,
	// meaning they are fully (or almost fully) occluded by elements drawn on top.
	// Non-quads (roofs, polygons with more or fewer than 4 vertices) are always kept.
	const toRemove: SVGPathElement[] = [];

	for (let idx = 0; idx < pathElements.length; idx++) {
		const el = pathElements[idx];
		const d = el.getAttribute("d");
		if (!d) {
			toRemove.push(el);
			continue;
		}

		const style = getComputedStyle(el);
		if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
			toRemove.push(el);
			continue;
		}

		if (countMAndL(d) !== 4) continue; // not a quad, keep it

		const key = (colors[idx * 3] << 16) | (colors[idx * 3 + 1] << 8) | colors[idx * 3 + 2];
		const count = colorCounts.get(key) ?? 0;

		if (count < PIXEL_THRESHOLD) {
			if (enableDebug) console.log(`removing quad idx=${idx}, color=[${colors[idx * 3]},${colors[idx * 3 + 1]},${colors[idx * 3 + 2]}], pixels=${count}`);
			toRemove.push(el);
		}
	}

	console.log(`removing ${toRemove.length} not rendered elements`);
	for (const el of toRemove) el.remove();
	console.timeEnd('Remove not rendered elements');
	return toRemove.length;
}
