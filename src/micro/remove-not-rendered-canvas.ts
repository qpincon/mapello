import parsePath from "parse-svg-path";

const INSET_FACTOR = 0.85;
const coords = new Float64Array(8);

function fillCoords(d: string): number {
	const segments = parsePath(d);
	let n = 0;
	let curX = 0,
		curY = 0;
	for (let i = 0, len = segments.length; i < len; i++) {
		const seg = segments[i];
		const cmd = seg[0];
		if (cmd === "M" || cmd === "L") {
			curX = seg[1];
			curY = seg[2];
			if (n < 4) {
				coords[n * 2] = curX;
				coords[n * 2 + 1] = curY;
			}
			n++;
		} else if (cmd === "m" || cmd === "l") {
			curX += seg[1];
			curY += seg[2];
			if (n < 4) {
				coords[n * 2] = curX;
				coords[n * 2 + 1] = curY;
			}
			n++;
		}
	}
	return n;
}

function randomColor(): [number, number, number] {
	// Avoid 0 (background) and stay away from edges to reduce anti-aliasing collisions
	const r = 10 + Math.floor(Math.random() * 235);
	const g = 10 + Math.floor(Math.random() * 235);
	const b = 10 + Math.floor(Math.random() * 235);
	return [r, g, b];
}

function pixelMatchesColor(
	data: Uint8ClampedArray,
	offset: number,
	r: number,
	g: number,
	b: number,
): boolean {
	return data[offset] === r && data[offset + 1] === g && data[offset + 2] === b;
}

function showDebugCanvas(canvas: OffscreenCanvas, svgRect: DOMRect) {
	document.querySelector("[data-debug-canvas]")?.remove();
	const visible = document.createElement("canvas");
	visible.setAttribute("data-debug-canvas", "");
	visible.width = canvas.width;
	visible.height = canvas.height;
	visible.style.cssText = `position:fixed;left:${svgRect.left}px;top:${svgRect.top}px;width:${svgRect.width}px;height:${svgRect.height}px;z-index:999999;pointer-events:none;opacity:0.7;`;
	visible.getContext("2d")!.drawImage(canvas, 0, 0);
	document.body.appendChild(visible);
}

export function removeNotRenderedElements(pathElements: SVGPathElement[], scale = 5, enableDebug = false) {
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

	// Assign a random color to each wall and draw in DOM order (painter's algorithm)
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

	if (enableDebug) showDebugCanvas(canvas, svgRect);

	// Read all pixels once
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	const imageData = ctx.getImageData(0, 0, w, h);
	const pixels = imageData.data;

	// Check visibility for each wall
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

		if (fillCoords(d) !== 4) continue; // not a quad, keep it

		const ctm = el.getScreenCTM();
		if (!ctm) {
			toRemove.push(el);
			continue;
		}

		const cx = (coords[0] + coords[2] + coords[4] + coords[6]) / 4;
		const cy = (coords[1] + coords[3] + coords[5] + coords[7]) / 4;

		let visible = false;
		for (let i = 0; i < 5; i++) {
			let sx: number, sy: number;
			if (i < 4) {
				sx = cx + (coords[i * 2] - cx) * INSET_FACTOR;
				sy = cy + (coords[i * 2 + 1] - cy) * INSET_FACTOR;
			} else {
				sx = cx;
				sy = cy;
			}

			// Transform to canvas coords (scaled)
			const canvasX = Math.round((ctm.a * sx + ctm.c * sy + ctm.e - originX) * scale);
			const canvasY = Math.round((ctm.b * sx + ctm.d * sy + ctm.f - originY) * scale);

			if (canvasX < 0 || canvasX >= w || canvasY < 0 || canvasY >= h) continue;

			const offset = (canvasY * w + canvasX) * 4;
			if (pixelMatchesColor(pixels, offset, colors[idx * 3], colors[idx * 3 + 1], colors[idx * 3 + 2])) {
				visible = true;
				break;
			}
		}

		if (!visible) {
			toRemove.push(el);
		}
	}

	console.log(`removing ${toRemove.length} not rendered elements`);
	for (const el of toRemove) {
		el.remove();
	}
	console.timeEnd('Remove not rendered elements');
	return toRemove.length;
}
