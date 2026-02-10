import { commonState, macroState } from "src/state.svelte";

const MAX_HISTORY = 50;
let undoStack: string[] = [];
let redoStack: string[] = [];
let isRestoring = false;

function serializeDrawingState(): string {
    return JSON.stringify({
        providedShapes: commonState.providedShapes,
        providedPaths: commonState.providedPaths,
        providedFreeHand: commonState.providedFreeHand,
        inlineStyles: commonState.inlineStyles,
        shapeCount: commonState.shapeCount,
        lastUsedLabelProps: commonState.lastUsedLabelProps,
    });
}

/** Called from saveState(). Pushes a snapshot if drawing state changed. */
export function recordIfChanged(): void {
    if (isRestoring) return;
    const snapshot = serializeDrawingState();
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === snapshot) return;
    undoStack.push(snapshot);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
}

/** Returns the previous drawing-state snapshot, or null if nothing to undo. */
export function undo(): string | null {
    if (undoStack.length <= 1) return null;
    const current = undoStack.pop()!;
    redoStack.push(current);
    return undoStack[undoStack.length - 1];
}

/** Returns the next drawing-state snapshot, or null if nothing to redo. */
export function redo(): string | null {
    if (redoStack.length === 0) return null;
    const snapshot = redoStack.pop()!;
    undoStack.push(snapshot);
    return snapshot;
}

export function setRestoring(v: boolean): void {
    isRestoring = v;
}

export function clearHistory(): void {
    undoStack = [];
    redoStack = [];
}
