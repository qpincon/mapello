import type { SelectedEntity } from "../selection.svelte";
import { getTranslateFromTransform, setTransformTranslate, pathStringFromParsed } from "./svg";
import { appState, commonState } from "../state.svelte";
import { saveState } from "../util/save";

const SVG_NS = "http://www.w3.org/2000/svg";
const HANDLE_SIZE = 8;
const HALF_HANDLE = HANDLE_SIZE / 2;
const STROKE_COLOR = "#528af4";

type Corner = "nw" | "ne" | "se" | "sw";
type TransformCommitFn = (
    deltas: { entity: SelectedEntity; dx: number; dy: number; scale?: number }[],
) => void;

interface DragState {
    mode: "move" | "resize";
    startX: number;
    startY: number;
    corner?: Corner;
    anchorX?: number;
    anchorY?: number;
    origDiag?: number;
    origBbox?: DOMRect;
    origPositions?: Map<string, { x: number; y: number }>;
}

export class SelectionOverlay {
    private svg: SVGSVGElement;
    private group: SVGGElement;
    private bboxRect: SVGRectElement;
    private handles: Map<Corner, SVGRectElement> = new Map();
    private elements: SVGElement[];
    private entities: SelectedEntity[];
    private onCommit: TransformCommitFn;
    private dragState: DragState | null = null;

    // Bound handlers for cleanup
    private boundMouseMove: (e: MouseEvent) => void;
    private boundMouseUp: (e: MouseEvent) => void;

    constructor(
        svg: SVGSVGElement,
        elements: SVGElement[],
        entities: SelectedEntity[],
        onCommit: TransformCommitFn,
    ) {
        this.svg = svg;
        this.elements = elements;
        this.entities = entities;
        this.onCommit = onCommit;
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundMouseUp = this.onMouseUp.bind(this);

        // Create overlay group
        this.group = document.createElementNS(SVG_NS, "g");
        this.group.setAttribute("id", "selection-overlay");
        this.group.setAttribute("pointer-events", "all");

        // Create bounding box rect
        this.bboxRect = document.createElementNS(SVG_NS, "rect");
        this.bboxRect.setAttribute("id", "sel-bbox");
        this.bboxRect.setAttribute("fill", "none");
        this.bboxRect.setAttribute("stroke", STROKE_COLOR);
        this.bboxRect.setAttribute("stroke-width", "1.5");
        this.bboxRect.setAttribute("stroke-dasharray", "4 3");
        this.bboxRect.setAttribute("cursor", "move");
        this.group.appendChild(this.bboxRect);

        // Create 4 corner handles
        for (const corner of ["nw", "ne", "se", "sw"] as Corner[]) {
            const handle = document.createElementNS(SVG_NS, "rect");
            handle.setAttribute("class", "sel-handle");
            handle.setAttribute("data-corner", corner);
            handle.setAttribute("width", String(HANDLE_SIZE));
            handle.setAttribute("height", String(HANDLE_SIZE));
            handle.setAttribute("fill", "white");
            handle.setAttribute("stroke", STROKE_COLOR);
            handle.setAttribute("stroke-width", "1.5");
            handle.setAttribute("rx", "1");
            const cursor = corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize";
            handle.setAttribute("cursor", cursor);
            this.group.appendChild(handle);
            this.handles.set(corner, handle);
        }

        this.svg.appendChild(this.group);
        this.positionFromBbox();
        this.attachListeners();
    }

    private computeUnifiedBbox(): DOMRect | null {
        if (this.elements.length === 0) return null;

        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        for (const el of this.elements) {
            const bbox = (el as unknown as SVGGraphicsElement).getBBox();
            const ctm = (el as unknown as SVGGraphicsElement).getCTM();
            const svgCtm = this.svg.getCTM();

            // We need bbox in SVG root coordinate space
            if (ctm && svgCtm) {
                // Transform bbox corners through the element's CTM relative to SVG root
                const svgInverse = svgCtm.inverse();
                const transform = svgInverse.multiply(ctm);
                const corners = [
                    this.transformPoint(bbox.x, bbox.y, transform),
                    this.transformPoint(bbox.x + bbox.width, bbox.y, transform),
                    this.transformPoint(bbox.x, bbox.y + bbox.height, transform),
                    this.transformPoint(bbox.x + bbox.width, bbox.y + bbox.height, transform),
                ];
                for (const c of corners) {
                    minX = Math.min(minX, c.x);
                    minY = Math.min(minY, c.y);
                    maxX = Math.max(maxX, c.x);
                    maxY = Math.max(maxY, c.y);
                }
            } else {
                minX = Math.min(minX, bbox.x);
                minY = Math.min(minY, bbox.y);
                maxX = Math.max(maxX, bbox.x + bbox.width);
                maxY = Math.max(maxY, bbox.y + bbox.height);
            }
        }

        if (!isFinite(minX)) return null;
        return new DOMRect(minX, minY, maxX - minX, maxY - minY);
    }

    private transformPoint(x: number, y: number, matrix: DOMMatrix): { x: number; y: number } {
        return {
            x: matrix.a * x + matrix.c * y + matrix.e,
            y: matrix.b * x + matrix.d * y + matrix.f,
        };
    }

    private positionFromBbox(): void {
        const bbox = this.computeUnifiedBbox();
        if (!bbox) return;

        const pad = 4;
        const bx = bbox.x - pad;
        const by = bbox.y - pad;
        const bw = bbox.width + pad * 2;
        const bh = bbox.height + pad * 2;

        this.bboxRect.setAttribute("x", String(bx));
        this.bboxRect.setAttribute("y", String(by));
        this.bboxRect.setAttribute("width", String(bw));
        this.bboxRect.setAttribute("height", String(bh));

        // Position handles at corners
        this.handles.get("nw")!.setAttribute("x", String(bx - HALF_HANDLE));
        this.handles.get("nw")!.setAttribute("y", String(by - HALF_HANDLE));

        this.handles.get("ne")!.setAttribute("x", String(bx + bw - HALF_HANDLE));
        this.handles.get("ne")!.setAttribute("y", String(by - HALF_HANDLE));

        this.handles.get("se")!.setAttribute("x", String(bx + bw - HALF_HANDLE));
        this.handles.get("se")!.setAttribute("y", String(by + bh - HALF_HANDLE));

        this.handles.get("sw")!.setAttribute("x", String(bx - HALF_HANDLE));
        this.handles.get("sw")!.setAttribute("y", String(by + bh - HALF_HANDLE));
    }

    private attachListeners(): void {
        // Stop click events on the overlay from reaching the SVG click handler
        // (which would call clearSelection because the target is the overlay, not a selectable entity)
        this.group.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        // Forward contextmenu events to the element beneath the overlay
        this.group.addEventListener("contextmenu", (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.group.setAttribute("pointer-events", "none");
            const below = document.elementFromPoint(e.clientX, e.clientY);
            this.group.setAttribute("pointer-events", "all");
            if (below) {
                below.dispatchEvent(
                    new MouseEvent("contextmenu", {
                        bubbles: true,
                        cancelable: true,
                        clientX: e.clientX,
                        clientY: e.clientY,
                        pageX: e.pageX,
                        pageY: e.pageY,
                        button: e.button,
                        buttons: e.buttons,
                        ctrlKey: e.ctrlKey,
                        shiftKey: e.shiftKey,
                        altKey: e.altKey,
                        metaKey: e.metaKey,
                    }),
                );
            }
        });

        this.bboxRect.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.startDrag(e, "move");
        });

        for (const [corner, handle] of this.handles) {
            handle.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.startResize(e, corner);
            });
        }
    }

    private svgPoint(e: MouseEvent): { x: number; y: number } {
        const pt = this.svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgPt = pt.matrixTransform(this.svg.getScreenCTM()?.inverse());
        return { x: svgPt.x, y: svgPt.y };
    }

    private startDrag(e: MouseEvent, mode: "move"): void {
        const pt = this.svgPoint(e);
        // Save original positions for all selected elements
        const origPositions = new Map<string, { x: number; y: number }>();
        for (const el of this.elements) {
            const coords = getTranslateFromTransform(el);
            if (coords) {
                origPositions.set(el.id, { x: coords[0], y: coords[1] });
            } else {
                origPositions.set(el.id, { x: 0, y: 0 });
            }
        }

        this.dragState = {
            mode,
            startX: pt.x,
            startY: pt.y,
            origPositions,
        };

        document.addEventListener("mousemove", this.boundMouseMove);
        document.addEventListener("mouseup", this.boundMouseUp);
    }

    private startResize(e: MouseEvent, corner: Corner): void {
        const pt = this.svgPoint(e);
        const bbox = this.computeUnifiedBbox();
        if (!bbox) return;

        // Anchor is the opposite corner
        const anchorMap: Record<Corner, { x: number; y: number }> = {
            nw: { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
            ne: { x: bbox.x, y: bbox.y + bbox.height },
            se: { x: bbox.x, y: bbox.y },
            sw: { x: bbox.x + bbox.width, y: bbox.y },
        };
        const anchor = anchorMap[corner];
        const origDiag = Math.sqrt(bbox.width ** 2 + bbox.height ** 2);

        // Save original positions
        const origPositions = new Map<string, { x: number; y: number }>();
        for (const el of this.elements) {
            const coords = getTranslateFromTransform(el);
            if (coords) {
                origPositions.set(el.id, { x: coords[0], y: coords[1] });
            } else {
                origPositions.set(el.id, { x: 0, y: 0 });
            }
        }

        this.dragState = {
            mode: "resize",
            startX: pt.x,
            startY: pt.y,
            corner,
            anchorX: anchor.x,
            anchorY: anchor.y,
            origDiag: origDiag || 1,
            origBbox: bbox,
            origPositions,
        };

        document.addEventListener("mousemove", this.boundMouseMove);
        document.addEventListener("mouseup", this.boundMouseUp);
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.dragState) return;
        const pt = this.svgPoint(e);

        if (this.dragState.mode === "move") {
            const dx = pt.x - this.dragState.startX;
            const dy = pt.y - this.dragState.startY;
            this.applyMoveVisual(dx, dy);
        } else if (this.dragState.mode === "resize") {
            this.applyResizeVisual(pt);
        }
    }

    private applyMoveVisual(dx: number, dy: number): void {
        for (const el of this.elements) {
            const orig = this.dragState!.origPositions!.get(el.id);
            if (!orig) continue;
            setTransformTranslate(el, `translate(${orig.x + dx} ${orig.y + dy})`);
        }
        this.positionFromBbox();
    }

    private applyResizeVisual(pt: { x: number; y: number }): void {
        const state = this.dragState!;
        const ax = state.anchorX!;
        const ay = state.anchorY!;

        // Compute scale factor from diagonal distance
        const newDiag = Math.sqrt((pt.x - ax) ** 2 + (pt.y - ay) ** 2);
        const scaleFactor = Math.max(0.1, newDiag / state.origDiag!);

        const origBbox = state.origBbox!;

        for (let i = 0; i < this.elements.length; i++) {
            const el = this.elements[i];
            const entity = this.entities[i];
            const orig = state.origPositions!.get(el.id);
            if (!orig) continue;

            if (entity.type === "shape") {
                // Reposition: new pos = anchor + (orig - anchor) * scale
                const newX = ax + (orig.x - ax) * scaleFactor;
                const newY = ay + (orig.y - ay) * scaleFactor;
                setTransformTranslate(el, `translate(${newX} ${newY})`);
                // Visual scale via transform
                const existingTransform = el.getAttribute("transform") || "";
                const baseScale = existingTransform.match(/scale\(([0-9.]+)\)/);
                // We'll apply a temporary scale marker
                if (!baseScale) {
                    el.setAttribute(
                        "transform",
                        `${el.getAttribute("transform") || ""} scale(${scaleFactor})`,
                    );
                } else {
                    // Just update scale in transform - original scale is on shapeDef
                    const origScale = commonState.providedShapes[entity.index]?.scale || 1;
                    el.setAttribute(
                        "transform",
                        existingTransform.replace(
                            /scale\([0-9.]+\)/,
                            `scale(${origScale * scaleFactor})`,
                        ),
                    );
                }
            } else if (entity.type === "path" || entity.type === "freehand") {
                // For paths/freehand, apply a transform group
                const newX = ax + (orig.x - ax) * scaleFactor;
                const newY = ay + (orig.y - ay) * scaleFactor;
                // Apply visual transform
                el.setAttribute(
                    "transform",
                    `translate(${ax} ${ay}) scale(${scaleFactor}) translate(${-ax} ${-ay})`,
                );
            }
        }
        this.positionFromBbox();
    }

    private onMouseUp(e: MouseEvent): void {
        document.removeEventListener("mousemove", this.boundMouseMove);
        document.removeEventListener("mouseup", this.boundMouseUp);

        if (!this.dragState) return;

        const pt = this.svgPoint(e);
        const state = this.dragState;

        if (state.mode === "move") {
            const dx = pt.x - state.startX;
            const dy = pt.y - state.startY;

            // Skip if barely moved
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
                this.dragState = null;
                // Restore original positions
                for (const el of this.elements) {
                    const orig = state.origPositions!.get(el.id);
                    if (orig) setTransformTranslate(el, `translate(${orig.x} ${orig.y})`);
                }
                return;
            }

            const deltas = this.entities.map((entity) => ({
                entity,
                dx,
                dy,
            }));
            this.onCommit(deltas);
            this.reRenderPathElements();
            this.positionFromBbox();
        } else if (state.mode === "resize") {
            const ax = state.anchorX!;
            const ay = state.anchorY!;
            const newDiag = Math.sqrt((pt.x - ax) ** 2 + (pt.y - ay) ** 2);
            const scaleFactor = Math.max(0.1, newDiag / state.origDiag!);

            if (Math.abs(scaleFactor - 1) < 0.01) {
                this.dragState = null;
                // Restore transforms
                this.restoreOriginalTransforms(state);
                return;
            }

            // For resize, we need to commit differently per entity type
            const deltas = this.entities.map((entity, i) => {
                const orig = state.origPositions!.get(this.elements[i].id);
                if (!orig) return { entity, dx: 0, dy: 0, scale: scaleFactor };

                // Compute position delta from scaling around anchor
                const newX = ax + (orig.x - ax) * scaleFactor;
                const newY = ay + (orig.y - ay) * scaleFactor;
                return {
                    entity,
                    dx: newX - orig.x,
                    dy: newY - orig.y,
                    scale: scaleFactor,
                };
            });

            // For paths/freehand, we need special handling: scale coords around anchor
            this.commitResize(deltas, scaleFactor, ax, ay);
        }

        this.dragState = null;
        // Suppress the click event that the browser synthesizes after mousedown+mouseup.
        // Without this, the SVG click handler fires and clears the selection.
        this.suppressNextClick();
    }

    /** Add a one-time capture-phase click listener on the SVG to eat the next click */
    private suppressNextClick(): void {
        const handler = (e: MouseEvent) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            this.svg.removeEventListener("click", handler, true);
        };
        this.svg.addEventListener("click", handler, true);
        // Safety: remove after a short delay in case the click never fires
        setTimeout(() => this.svg.removeEventListener("click", handler, true), 200);
    }

    private restoreOriginalTransforms(state: DragState): void {
        for (const el of this.elements) {
            const orig = state.origPositions!.get(el.id);
            if (orig) {
                setTransformTranslate(el, `translate(${orig.x} ${orig.y})`);
            }
            // Remove any leftover scale
            const transform = el.getAttribute("transform") || "";
            if (transform.includes("scale") && !this.isShapeWithScale(el)) {
                el.setAttribute("transform", transform.replace(/\s*scale\([^)]+\)/, ""));
            }
        }
        this.positionFromBbox();
    }

    private isShapeWithScale(el: SVGElement): boolean {
        const entity = this.entities.find((_, i) => this.elements[i] === el);
        if (!entity || entity.type !== "shape") return false;
        const shapeDef = commonState.providedShapes[entity.index];
        return shapeDef?.scale !== undefined && shapeDef.scale !== 1;
    }

    private commitResize(
        deltas: { entity: SelectedEntity; dx: number; dy: number; scale?: number }[],
        scaleFactor: number,
        anchorX: number,
        anchorY: number,
    ): void {
        const projection = appState.projection!;

        for (const { entity, dx, dy, scale } of deltas) {
            if (entity.type === "shape") {
                // Shape: move + scale
                const shapeDef = commonState.providedShapes[entity.index];
                if (!shapeDef) continue;
                const projected = projection(shapeDef.pos)!;
                const newPixel: [number, number] = [projected[0] + dx, projected[1] + dy];
                shapeDef.pos = projection.invert!(newPixel)!;
                shapeDef.scale *= scaleFactor;
            } else if (entity.type === "path") {
                const pathDef = commonState.providedPaths[entity.index];
                if (!pathDef) continue;
                pathDef.d = this.scaleParsedPath(pathDef.d, projection, scaleFactor, anchorX, anchorY);
            } else if (entity.type === "freehand") {
                const freehandGroup = commonState.providedFreeHand[entity.index];
                if (!freehandGroup) continue;
                commonState.providedFreeHand[entity.index] = freehandGroup.map((parsed) =>
                    this.scaleParsedPath(parsed, projection, scaleFactor, anchorX, anchorY),
                );
            }
        }

        // Remove visual transforms from elements (will be re-rendered)
        for (const el of this.elements) {
            const transform = el.getAttribute("transform") || "";
            // Clean up complex transforms added during resize
            const cleaned = transform
                .replace(/translate\([^)]+\)\s*scale\([^)]+\)\s*translate\([^)]+\)/, "")
                .trim();
            if (cleaned) {
                el.setAttribute("transform", cleaned);
            } else {
                el.removeAttribute("transform");
            }
        }

        this.reRenderPathElements();
        saveState();
        this.positionFromBbox();
    }

    private reRenderPathElements(): void {
        const projection = appState.projection!;
        for (let i = 0; i < this.elements.length; i++) {
            const entity = this.entities[i];
            const el = this.elements[i];
            if (entity.type === "path") {
                const pathDef = commonState.providedPaths[entity.index];
                if (!pathDef) continue;
                el.setAttribute("d", pathStringFromParsed(pathDef.d, projection));
                el.removeAttribute("transform");
            } else if (entity.type === "freehand") {
                const freehandGroup = commonState.providedFreeHand[entity.index];
                if (!freehandGroup) continue;
                const children = Array.from(el.querySelectorAll("path"));
                freehandGroup.forEach((parsed, j) => {
                    if (children[j]) {
                        children[j].setAttribute("d", pathStringFromParsed(parsed, projection));
                    }
                });
                el.removeAttribute("transform");
            }
        }
    }

    private scaleParsedPath(
        parsed: any[],
        projection: d3.GeoProjection,
        scaleFactor: number,
        anchorX: number,
        anchorY: number,
    ): any[] {
        return parsed.map((group: any[]) => {
            const [instruction, ...data] = group;
            const newData: number[] = [];
            for (let i = 0; i < data.length; i += 2) {
                const projected = projection([data[i], data[i + 1]])!;
                const newX = anchorX + (projected[0] - anchorX) * scaleFactor;
                const newY = anchorY + (projected[1] - anchorY) * scaleFactor;
                const inverted = projection.invert!([newX, newY])!;
                newData.push(inverted[0], inverted[1]);
            }
            return [instruction, ...newData];
        });
    }

    refresh(): void {
        this.positionFromBbox();
    }

    destroy(): void {
        document.removeEventListener("mousemove", this.boundMouseMove);
        document.removeEventListener("mouseup", this.boundMouseUp);
        this.group.remove();
    }
}
