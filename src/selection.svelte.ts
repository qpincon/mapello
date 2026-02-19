import { cloneDeep } from "lodash-es";
import type { SelectableEntityType, ParsedPath, ShapeDefinition, PathDef } from "./types";
import { appState, commonState } from "./state.svelte";
import { closestDistance } from "./svg/svg";
import { saveState } from "./util/save";
import { SelectionOverlay } from "./svg/selectionOverlay";

export interface SelectedEntity {
    type: SelectableEntityType;
    index: number;
    id: string;
}

interface ClipboardItem {
    type: SelectableEntityType;
    data: any;
    styles?: Record<string, string>;
}

interface SelectionState {
    selected: SelectedEntity[];
    clipboard: ClipboardItem[] | null;
}

export const selectionState: SelectionState = $state({
    selected: [],
    clipboard: null,
});

let overlay: SelectionOverlay | null = null;

export function getOverlay(): SelectionOverlay | null {
    return overlay;
}

export function identifyClickedEntity(target: Element): SelectedEntity | null {
    // Check if clicked on a shape/label in #points-labels
    const pointsLabelsContainer = target.closest("#points-labels");
    if (pointsLabelsContainer) {
        let elem = target as Element;
        // tspan -> parent text element
        if (elem.tagName === "tspan") elem = elem.parentElement!;
        const id = elem.getAttribute("id");
        if (!id) return null;
        const index = commonState.providedShapes.findIndex((def) => def.id === id);
        if (index === -1) return null;
        return { type: "shape", index, id };
    }

    // Check if clicked on a freehand drawing
    const freehandGroup = target.closest(".freehand");
    if (freehandGroup) {
        const idAttr = freehandGroup.getAttribute("id");
        if (!idAttr) return null;
        const index = parseInt(idAttr.match(/\d+$/)![0]);
        return { type: "freehand", index, id: idAttr };
    }

    // Check if clicked on a path in #paths (use closestDistance for thin paths)
    const pathsElement = document.getElementById("paths");
    if (pathsElement) {
        // Direct hit: check if target is inside #paths
        if (target.closest("#paths") && target.tagName === "path") {
            const id = target.getAttribute("id");
            if (id) {
                const index = parseInt(id.match(/\d+$/)![0]);
                return { type: "path", index, id };
            }
        }
    }

    return null;
}

/** Hit-test paths with a proximity threshold (for thin strokes) */
export function identifyClickedPath(e: MouseEvent): SelectedEntity | null {
    const pathsElement = document.getElementById("paths");
    if (!pathsElement) return null;
    const svgElem = document.getElementById("static-svg-map") as unknown as SVGSVGElement;
    if (!svgElem) return null;

    const pt = svgElem.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svgElem.getScreenCTM()?.inverse());
    const point = { x: svgPt.x, y: svgPt.y };

    const paths = Array.from(pathsElement.querySelectorAll('path')) as SVGPathElement[];
    if (!paths.length) return null;

    let bestDist = Infinity;
    let bestElem: SVGPathElement | null = null;
    for (const pathElem of paths) {
        const result = closestDistance(point, pathElem);
        if (result.distance != null && result.distance < bestDist) {
            bestDist = result.distance;
            bestElem = pathElem;
        }
    }
    if (bestElem && bestDist < 6) {
        const id = bestElem.getAttribute("id")!;
        const index = parseInt(id.match(/\d+$/)![0]);
        return { type: "path", index, id };
    }
    return null;
}

export function toggleSelection(entity: SelectedEntity, shiftKey: boolean): void {
    if (shiftKey) {
        const existingIdx = selectionState.selected.findIndex(
            (s) => s.type === entity.type && s.index === entity.index,
        );
        if (existingIdx !== -1) {
            selectionState.selected.splice(existingIdx, 1);
        } else {
            selectionState.selected.push(entity);
        }
    } else {
        selectionState.selected = [entity];
    }
    updateOverlay();
}

export function clearSelection(): void {
    selectionState.selected = [];
    destroyOverlay();
}

export function isSelectionActive(): boolean {
    return selectionState.selected.length > 0;
}

function updateOverlay(): void {
    destroyOverlay();
    if (selectionState.selected.length === 0) return;

    const svgElem = document.getElementById("static-svg-map") as unknown as SVGSVGElement;
    if (!svgElem) return;

    const elements = getSelectedElements();
    if (elements.length === 0) {
        selectionState.selected = [];
        return;
    }

    overlay = new SelectionOverlay(svgElem, elements, selectionState.selected, onTransformCommit);
}

function destroyOverlay(): void {
    if (overlay) {
        overlay.destroy();
        overlay = null;
    }
}

export function refreshOverlay(): void {
    if (selectionState.selected.length > 0) {
        updateOverlay();
    }
}

function getSelectedElements(): SVGElement[] {
    const elems: SVGElement[] = [];
    for (const sel of selectionState.selected) {
        const el = document.getElementById(sel.id) as SVGElement | null;
        if (el) elems.push(el);
    }
    return elems;
}

function onTransformCommit(
    deltas: { entity: SelectedEntity; dx: number; dy: number; scale?: number }[],
): void {
    const projection = appState.projection!;

    for (const { entity, dx, dy, scale } of deltas) {
        if (entity.type === "shape") {
            const shapeDef = commonState.providedShapes[entity.index];
            if (!shapeDef) continue;
            const projected = projection(shapeDef.pos)!;
            const newPixel: [number, number] = [projected[0] + dx, projected[1] + dy];
            shapeDef.pos = projection.invert!(newPixel)!;
            if (scale != null) {
                shapeDef.scale *= scale;
            }
        } else if (entity.type === "path") {
            const pathDef = commonState.providedPaths[entity.index];
            if (!pathDef) continue;
            const parsed: ParsedPath = pathDef.d;
            pathDef.d = transformParsedPath(parsed, projection, dx, dy, scale);
        } else if (entity.type === "freehand") {
            const freehandGroup = commonState.providedFreeHand[entity.index];
            if (!freehandGroup) continue;
            commonState.providedFreeHand[entity.index] = freehandGroup.map((parsed) =>
                transformParsedPath(parsed, projection, dx, dy, scale),
            );
        }
    }
    saveState();
}

function transformParsedPath(
    parsed: ParsedPath,
    projection: d3.GeoProjection,
    dx: number,
    dy: number,
    scale?: number,
): ParsedPath {
    return parsed.map((group) => {
        const [instruction, ...data] = group;
        const newData: number[] = [];
        for (let i = 0; i < data.length; i += 2) {
            const projected = projection([data[i], data[i + 1]])!;
            let newX = projected[0] + dx;
            let newY = projected[1] + dy;
            // scale is not applied here for paths; resize is handled in overlay commit
            const inverted = projection.invert!([newX, newY])!;
            newData.push(inverted[0], inverted[1]);
        }
        return [instruction, ...newData];
    }) as ParsedPath;
}

// ======= Copy / Paste =======

function nextShapeId(prefix: string): string {
    return `${prefix}-${commonState.shapeCount++}`;
}

export function copySelected(): void {
    if (selectionState.selected.length === 0) return;
    const items: ClipboardItem[] = [];

    for (const sel of selectionState.selected) {
        if (sel.type === "shape") {
            const shapeDef = commonState.providedShapes[sel.index];
            if (!shapeDef) continue;
            items.push({
                type: "shape",
                data: cloneDeep(shapeDef),
                styles: commonState.inlineStyles[shapeDef.id]
                    ? { ...commonState.inlineStyles[shapeDef.id] }
                    : undefined,
            });
        } else if (sel.type === "path") {
            const pathDef = commonState.providedPaths[sel.index];
            if (!pathDef) continue;
            items.push({
                type: "path",
                data: cloneDeep(pathDef),
                styles: commonState.inlineStyles[sel.id]
                    ? { ...commonState.inlineStyles[sel.id] }
                    : undefined,
            });
        } else if (sel.type === "freehand") {
            const freehandGroup = commonState.providedFreeHand[sel.index];
            if (!freehandGroup) continue;
            items.push({
                type: "freehand",
                data: cloneDeep(freehandGroup),
                styles: commonState.inlineStyles[sel.id]
                    ? { ...commonState.inlineStyles[sel.id] }
                    : undefined,
            });
        }
    }
    selectionState.clipboard = items;
}

export function pasteFromClipboard(redrawCallback: () => void): void {
    if (!selectionState.clipboard || selectionState.clipboard.length === 0) return;
    const projection = appState.projection!;
    const OFFSET_PX = 15;

    const newEntities: SelectedEntity[] = [];

    for (const item of selectionState.clipboard) {
        if (item.type === "shape") {
            const shapeDef: ShapeDefinition = cloneDeep(item.data);
            const projected = projection(shapeDef.pos)!;
            shapeDef.pos = projection.invert!([projected[0] + OFFSET_PX, projected[1] + OFFSET_PX])!;
            const prefix = shapeDef.name ? shapeDef.name : "label";
            const newId = nextShapeId(prefix);
            if (item.styles) {
                commonState.inlineStyles[newId] = { ...item.styles };
            }
            shapeDef.id = newId;
            const newIndex = commonState.providedShapes.length;
            commonState.providedShapes.push(shapeDef);
            newEntities.push({ type: "shape", index: newIndex, id: newId });
        } else if (item.type === "path") {
            const pathDef: PathDef = cloneDeep(item.data);
            pathDef.d = offsetParsedPath(pathDef.d, projection, OFFSET_PX, OFFSET_PX);
            const newIndex = commonState.providedPaths.length;
            const newId = `path-${newIndex}`;
            if (item.styles) {
                commonState.inlineStyles[newId] = { ...item.styles };
            }
            commonState.providedPaths.push(pathDef);
            newEntities.push({ type: "path", index: newIndex, id: newId });
        } else if (item.type === "freehand") {
            const freehandGroup: ParsedPath[] = cloneDeep(item.data);
            const offsetGroup = freehandGroup.map((parsed) =>
                offsetParsedPath(parsed, projection, OFFSET_PX, OFFSET_PX),
            );
            const newIndex = commonState.providedFreeHand.length;
            const newId = `freehand-${newIndex}`;
            if (item.styles) {
                commonState.inlineStyles[newId] = { ...item.styles };
            }
            commonState.providedFreeHand.push(offsetGroup);
            newEntities.push({ type: "freehand", index: newIndex, id: newId });
        }
    }

    redrawCallback();
    selectionState.selected = newEntities;
    updateOverlay();
    saveState();
}

function offsetParsedPath(
    parsed: ParsedPath,
    projection: d3.GeoProjection,
    dx: number,
    dy: number,
): ParsedPath {
    return parsed.map((group) => {
        const [instruction, ...data] = group;
        const newData: number[] = [];
        for (let i = 0; i < data.length; i += 2) {
            const projected = projection([data[i], data[i + 1]])!;
            const inverted = projection.invert!([projected[0] + dx, projected[1] + dy])!;
            newData.push(inverted[0], inverted[1]);
        }
        return [instruction, ...newData];
    }) as ParsedPath;
}

// ======= Delete =======

export function deleteSelected(redrawCallback: () => void): void {
    if (selectionState.selected.length === 0) return;

    // Sort indices descending so splice doesn't shift indices
    const sorted = [...selectionState.selected].sort((a, b) => b.index - a.index);

    for (const sel of sorted) {
        if (sel.type === "shape") {
            delete commonState.inlineStyles[sel.id];
            commonState.providedShapes.splice(sel.index, 1);
        } else if (sel.type === "path") {
            delete commonState.inlineStyles[sel.id];
            commonState.providedPaths.splice(sel.index, 1);
        } else if (sel.type === "freehand") {
            delete commonState.inlineStyles[sel.id];
            commonState.providedFreeHand.splice(sel.index, 1);
        }
    }

    clearSelection();
    redrawCallback();
    saveState();
}
