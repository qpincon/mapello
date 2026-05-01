import type { SelectedEntity } from "../selection.svelte";
import { getTranslateFromTransform, setTransformTranslate, setTransformRotation, getRotationFromTransform, pathStringFromParsed } from "./svg";
import { appState, commonState } from "../state.svelte";
import { saveState } from "../util/save";

const SVG_NS = "http://www.w3.org/2000/svg";
const HANDLE_SIZE = 8;
const HALF_HANDLE = HANDLE_SIZE / 2;
const STROKE_COLOR = "#528af4";

type Corner = "nw" | "ne" | "se" | "sw";
type TransformCommitFn = (
    deltas: { entity: SelectedEntity; dx: number; dy: number; scale?: number; rotation?: number }[],
) => void;

interface DragState {
    mode: "move" | "resize" | "rotate";
    startX: number;
    startY: number;
    started?: boolean;
    corner?: Corner;
    anchorX?: number;
    anchorY?: number;
    origDiag?: number;
    origPositions?: Map<string, { x: number; y: number }>;
    startAngle?: number;
    centerX?: number;
    centerY?: number;
    origRotation?: number;
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
    private onDragConfirmed?: () => void;
    private onSimpleClick?: () => void;
    private rotateHandle: SVGCircleElement | null = null;
    private rotateLine: SVGLineElement | null = null;
    private isTextSelection: boolean = false;

    // Bound handlers for cleanup
    private boundMouseMove: (e: MouseEvent) => void;
    private boundMouseUp: (e: MouseEvent) => void;

    // Performance: cache CTM inverse for the duration of a drag (viewport doesn't change during drag)
    private cachedInverseScreenCTM: DOMMatrix | null = null;
    // Performance: rAF handle to throttle mousemove updates to one per frame
    private pendingRaf: number | null = null;
    private pendingClientX: number = 0;
    private pendingClientY: number = 0;

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

        // Rotation handle: only for a single selected text/label element
        this.isTextSelection = (
            entities.length === 1 &&
            entities[0].type === "shape" &&
            commonState.providedShapes[entities[0].index]?.text !== undefined
        );

        if (this.isTextSelection) {
            this.rotateLine = document.createElementNS(SVG_NS, "line");
            this.rotateLine.setAttribute("stroke", STROKE_COLOR);
            this.rotateLine.setAttribute("stroke-width", "1.5");
            this.group.appendChild(this.rotateLine);

            this.rotateHandle = document.createElementNS(SVG_NS, "circle");
            this.rotateHandle.setAttribute("r", String(HALF_HANDLE));
            this.rotateHandle.setAttribute("fill", "white");
            this.rotateHandle.setAttribute("stroke", STROKE_COLOR);
            this.rotateHandle.setAttribute("stroke-width", "1.5");
            this.rotateHandle.setAttribute("cursor", "grab");
            this.group.appendChild(this.rotateHandle);
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

        if (this.rotateHandle && this.rotateLine) {
            const STEM_LENGTH = 20;
            const topCenterX = bx + bw / 2;
            const topCenterY = by;
            this.rotateLine.setAttribute("x1", String(topCenterX));
            this.rotateLine.setAttribute("y1", String(topCenterY));
            this.rotateLine.setAttribute("x2", String(topCenterX));
            this.rotateLine.setAttribute("y2", String(topCenterY - STEM_LENGTH));
            this.rotateHandle.setAttribute("cx", String(topCenterX));
            this.rotateHandle.setAttribute("cy", String(topCenterY - STEM_LENGTH));
        }
    }

    // Sets up mouse event handlers on the overlay group.
    // Both click and mousedown are stopped from propagating to the SVG's handlers
    // (onSvgClick / onSvgMouseDown) to prevent unintended deselection or re-selection.
    // Drag/resize is handled entirely within the overlay; for simple clicks (no drag),
    // the onSimpleClick callback is invoked (used e.g. to toggle popovers).
    private attachListeners(): void {
        // Prevent clicks on the overlay from reaching onSvgClick (which would clearSelection)
        this.group.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        // Forward contextmenu to the element beneath, so right-click menus work through the overlay
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

        if (this.rotateHandle) {
            this.rotateHandle.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.startRotate(e);
            });
        }
    }

    public beginDrag(e: MouseEvent): void {
        this.startDrag(e, "move");
    }

    // onDragConfirmed: called when a drag actually starts (movement > threshold).
    // onSimpleClick: called on mouseup without drag — used by labels to enter edit mode
    // and by non-label entities to toggle popovers.
    public setCallbacks(callbacks: { onDragConfirmed?: () => void; onSimpleClick?: () => void }): void {
        this.onDragConfirmed = callbacks.onDragConfirmed;
        this.onSimpleClick = callbacks.onSimpleClick;
    }

    private svgPoint(clientX: number, clientY: number): { x: number; y: number } {
        const pt = this.svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        // Use cached inverse CTM during drag to avoid forced layout reads on every mousemove
        const matrix = this.cachedInverseScreenCTM ?? this.svg.getScreenCTM()?.inverse();
        const svgPt = pt.matrixTransform(matrix!);
        return { x: svgPt.x, y: svgPt.y };
    }

    private startDrag(e: MouseEvent, mode: "move"): void {
        // Cache the CTM inverse once — the SVG viewport doesn't change during a drag
        this.cachedInverseScreenCTM = this.svg.getScreenCTM()?.inverse() ?? null;
        const pt = this.svgPoint(e.clientX, e.clientY);
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
        this.cachedInverseScreenCTM = this.svg.getScreenCTM()?.inverse() ?? null;
        const pt = this.svgPoint(e.clientX, e.clientY);
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
            origPositions,
        };

        document.addEventListener("mousemove", this.boundMouseMove);
        document.addEventListener("mouseup", this.boundMouseUp);
    }

    private startRotate(e: MouseEvent): void {
        this.cachedInverseScreenCTM = this.svg.getScreenCTM()?.inverse() ?? null;
        const pt = this.svgPoint(e.clientX, e.clientY);
        const bbox = this.computeUnifiedBbox();
        if (!bbox) return;

        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        const startAngle = Math.atan2(pt.y - centerY, pt.x - centerX);
        const entity = this.entities[0];
        const origRotation = commonState.providedShapes[entity.index]?.rotation ?? 0;

        this.dragState = {
            mode: "rotate",
            startX: pt.x,
            startY: pt.y,
            startAngle,
            centerX,
            centerY,
            origRotation,
        };

        document.addEventListener("mousemove", this.boundMouseMove);
        document.addEventListener("mouseup", this.boundMouseUp);
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.dragState) return;

        // First real movement: let caller cancel any in-progress edit
        if (!this.dragState.started) {
            this.dragState.started = true;
            this.onDragConfirmed?.();
        }

        // Capture raw client coords immediately (cheap, no layout reads)
        this.pendingClientX = e.clientX;
        this.pendingClientY = e.clientY;

        // Throttle visual updates to one per animation frame to avoid redundant
        // paints when mousemove fires faster than the display refresh rate
        if (this.pendingRaf === null) {
            this.pendingRaf = requestAnimationFrame(() => {
                this.pendingRaf = null;
                if (!this.dragState) return;
                const pt = this.svgPoint(this.pendingClientX, this.pendingClientY);
                if (this.dragState.mode === "move") {
                    const dx = pt.x - this.dragState.startX;
                    const dy = pt.y - this.dragState.startY;
                    this.applyMoveVisual(dx, dy);
                } else if (this.dragState.mode === "resize") {
                    this.applyResizeVisual(pt);
                } else if (this.dragState.mode === "rotate") {
                    this.applyRotateVisual(pt);
                }
            });
        }
    }

    private applyMoveVisual(dx: number, dy: number): void {
        for (const el of this.elements) {
            const orig = this.dragState!.origPositions!.get(el.id);
            if (!orig) continue;
            setTransformTranslate(el, `translate(${orig.x + dx} ${orig.y + dy})`);
        }
        // Move the overlay group with a single transform write instead of calling
        // positionFromBbox(), which forces expensive getBBox()/getCTM() layout reads
        // on every frame when the background is complex.
        this.group.setAttribute("transform", `translate(${dx} ${dy})`);
    }

    private applyResizeVisual(pt: { x: number; y: number }): void {
        const state = this.dragState!;
        const ax = state.anchorX!;
        const ay = state.anchorY!;

        // Compute scale factor from diagonal distance
        const newDiag = Math.sqrt((pt.x - ax) ** 2 + (pt.y - ay) ** 2);
        const scaleFactor = Math.max(0.1, newDiag / state.origDiag!);


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

    private applyRotateVisual(pt: { x: number; y: number }): void {
        const state = this.dragState!;
        const currentAngle = Math.atan2(pt.y - state.centerY!, pt.x - state.centerX!);
        const deltaAngleDeg = (currentAngle - state.startAngle!) * (180 / Math.PI);
        const newRotation = state.origRotation! + deltaAngleDeg;
        for (const el of this.elements) {
            setTransformRotation(el, `rotate(${newRotation})`);
        }
        this.positionFromBbox();
    }

    private onMouseUp(e: MouseEvent): void {
        document.removeEventListener("mousemove", this.boundMouseMove);
        document.removeEventListener("mouseup", this.boundMouseUp);

        // Cancel any pending rAF and reset drag-time caches
        if (this.pendingRaf !== null) {
            cancelAnimationFrame(this.pendingRaf);
            this.pendingRaf = null;
        }
        this.cachedInverseScreenCTM = null;
        // Remove the drag-time group offset so positionFromBbox() computes cleanly
        this.group.removeAttribute("transform");

        if (!this.dragState) return;

        const pt = this.svgPoint(e.clientX, e.clientY);
        const state = this.dragState;

        if (state.mode === "move") {
            const dx = pt.x - state.startX;
            const dy = pt.y - state.startY;

            // Skip if barely moved
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
                this.dragState = null;
                this.suppressNextClick(); // eat the synthetic click so the SVG handler doesn't deselect
                // Restore original positions
                for (const el of this.elements) {
                    const orig = state.origPositions!.get(el.id);
                    if (orig) setTransformTranslate(el, `translate(${orig.x} ${orig.y})`);
                }
                this.onSimpleClick?.();
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
        } else if (state.mode === "rotate") {
            const currentAngle = Math.atan2(pt.y - state.centerY!, pt.x - state.centerX!);
            const deltaAngleDeg = (currentAngle - state.startAngle!) * (180 / Math.PI);

            if (Math.abs(deltaAngleDeg) < 0.5) {
                // Restore original rotation
                for (const el of this.elements) {
                    setTransformRotation(el, `rotate(${state.origRotation!})`);
                }
                this.dragState = null;
                this.suppressNextClick();
                this.positionFromBbox();
                return;
            }

            const finalRotation = state.origRotation! + deltaAngleDeg;
            const deltas = this.entities.map((entity) => ({
                entity,
                dx: 0,
                dy: 0,
                rotation: finalRotation,
            }));
            this.onCommit(deltas);
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
                const newScale = shapeDef.scale * scaleFactor;
                commonState.providedShapes[entity.index] = {
                    ...shapeDef,
                    pos: projection.invert!(newPixel)!,
                    scale: newScale,
                };
                // Keep inline style scale in sync (used by InlineStyleEditor)
                const inlineStyle = commonState.inlineStyles[shapeDef.id];
                if (inlineStyle && 'scale' in inlineStyle) {
                    inlineStyle.scale = String(newScale);
                }
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
        if (this.pendingRaf !== null) {
            cancelAnimationFrame(this.pendingRaf);
            this.pendingRaf = null;
        }
        this.group.remove();
    }
}
