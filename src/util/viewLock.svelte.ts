import { commonState } from "../state.svelte";
import { track } from "./analytics";
import { saveState } from "./save";

/**
 * Map view lock: suppresses pan/zoom gestures on the map while leaving annotation editing
 * (shapes, labels, curves, freehand) untouched. `commonState.viewLocked` is the persisted
 * source of truth (saved with the project); everything else here is session-only.
 *
 * Auto-lock: committing the first annotation on an unlocked view locks it immediately. The
 * intent is "you've started annotating, so the framing is probably final now" — if that's
 * wrong, unlocking is one click (or a middle-drag) away.
 */

const FLASH_THROTTLE_MS = 1500;

export const viewLockUi = $state({
    // Bumped on every (throttled) blocked gesture attempt; the lock toggle watches this to
    // trigger its shake/hint animation.
    flashes: 0,
    // True once an auto-lock has happened and the "why did this lock?" bubble should show.
    autoLockNotice: false,
});

let lastFlashAt = 0;

export function isViewLocked(): boolean {
    return !!commonState.viewLocked;
}

/** The single predicate every gesture guard (macro d3 filters, micro forwarders) should use. */
export function isViewGestureBlocked(): boolean {
    return isViewLocked();
}

export function lockView(auto = false): void {
    if (isViewLocked()) return;
    commonState.viewLocked = true;
    if (auto) viewLockUi.autoLockNotice = true;
    track("view_lock", { locked: true, auto });
    saveState();
}

export function unlockView(manual = false): void {
    const wasLocked = isViewLocked();
    commonState.viewLocked = false;
    viewLockUi.autoLockNotice = false;
    if (wasLocked) {
        track("view_lock", { locked: false, auto: !manual });
        saveState();
    }
}

export function toggleViewLock(): void {
    if (isViewLocked()) {
        unlockView(true);
    } else {
        lockView(false);
        // An explicit manual lock isn't a heuristic guess, so there's nothing to explain.
        viewLockUi.autoLockNotice = false;
    }
}

/** Call whenever a shape/label/curve/freehand annotation is committed to the map. */
export function noteAnnotationAdded(): void {
    lockView(true);
}

/** Call when a gesture was rejected because the view is locked; throttled to avoid spamming. */
export function noteBlockedGesture(): void {
    const now = Date.now();
    if (now - lastFlashAt < FLASH_THROTTLE_MS) return;
    lastFlashAt = now;
    viewLockUi.flashes++;
}

/**
 * Call on project load / mode switch: clears the "why did this lock?" notice so a previous
 * project's explanation doesn't leak into the next one.
 * Does not change `commonState.viewLocked` itself — that's restored from the loaded state.
 */
export function resetViewLockSession(): void {
    viewLockUi.autoLockNotice = false;
}
