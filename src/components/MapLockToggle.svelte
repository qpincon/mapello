<script lang="ts">
    interface Props {
        locked: boolean;
        onToggle: () => void;
        // Bumped by the app every time a pan/zoom gesture was rejected because the view is
        // locked. Watched (not read once) so repeated blocked attempts keep re-triggering
        // the shake, even while a previous one is still playing.
        flashes: number;
        // True right after the view auto-locked itself, until dismissed.
        showNotice: boolean;
        onDismissNotice: () => void;
    }
    let { locked, onToggle, flashes, showNotice, onDismissNotice }: Props = $props();

    // The explanation bubble only needs to be seen once, ever — after that the locked pill
    // itself is enough of a reminder. A silent auto-lock would just reintroduce the original
    // "why won't the map move?" confusion, so the first time still gets an explicit callout.
    const NOTICE_SEEN_KEY = "mapello-view-lock-notice-seen";

    function hasSeenNotice(): boolean {
        try {
            return localStorage.getItem(NOTICE_SEEN_KEY) === "1";
        } catch {
            return false;
        }
    }
    function markNoticeSeen(): void {
        try {
            localStorage.setItem(NOTICE_SEEN_KEY, "1");
        } catch {
            // ignore (private browsing, storage disabled, etc.)
        }
    }

    let noticeVisible = $state(false);

    $effect(() => {
        if (!showNotice) {
            noticeVisible = false;
            return;
        }
        if (hasSeenNotice()) {
            // Already explained once before; don't nag again, just clear the flag upstream.
            onDismissNotice();
            return;
        }
        markNoticeSeen();
        noticeVisible = true;
        const t = setTimeout(dismissNotice, 5000);
        return () => clearTimeout(t);
    });

    function dismissNotice(): void {
        noticeVisible = false;
        onDismissNotice();
    }

    let flashMessageVisible = $state(false);
    $effect(() => {
        if (flashes === 0) return;
        flashMessageVisible = true;
        const t = setTimeout(() => (flashMessageVisible = false), 2200);
        return () => clearTimeout(t);
    });
</script>

<div class="map-lock-area">
    {#key flashes}
        <button
            class="lock-toggle"
            class:locked
            class:shake={flashes > 0}
            type="button"
            aria-pressed={locked}
            onclick={onToggle}
            title={locked
                ? "Map view is locked — click to unlock"
                : "Lock map view — prevents accidental panning"}
        >
            {#if locked}
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2.5" y="6.5" width="9" height="6" rx="1"/>
                    <path d="M4.5 6.5V4.2a2.5 2.5 0 0 1 5 0V6.5"/>
                </svg>
                <span>View locked</span>
            {:else}
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2.5" y="6.5" width="9" height="6" rx="1"/>
                    <path d="M4.5 6.5V4.2a2.5 2.5 0 0 1 4.9-.6"/>
                </svg>
            {/if}
        </button>
    {/key}

    {#if flashMessageVisible}
        <div class="lock-bubble lock-flash-bubble">Map view is locked — click to unlock</div>
    {:else if noticeVisible}
        <div class="lock-bubble lock-notice-bubble">
            Locked the view so you don't move the map by accident — click to unlock
            <button class="lock-notice-dismiss" type="button" onclick={dismissNotice} aria-label="Dismiss">×</button>
        </div>
    {/if}
</div>

<style lang="scss">
.map-lock-area {
    position: absolute;
    top: 8px;
    right: 12px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
}

.lock-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px;
    background: white;
    border: 1px solid #c8d4e3;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: #506784;
    opacity: 0.45;
    cursor: pointer;
    white-space: nowrap;
    transition: box-shadow 0.12s, border-color 0.12s, background 0.12s, color 0.12s, opacity 0.12s;

    svg {
        flex-shrink: 0;
    }

    &:hover {
        opacity: 1;
        border-color: #9ab0ca;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
        color: #2a3d5c;
    }

    &.locked {
        opacity: 1;
        padding: 4px 10px;
        background: #e8f0fb;
        border-color: #4a7fc1;
        color: #1e4d8c;
        box-shadow: inset 0 1px 3px rgba(74, 127, 193, 0.18);
    }

    &.shake {
        animation: lock-shake 0.4s ease;
    }
}

@keyframes lock-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-3px); }
    40% { transform: translateX(3px); }
    60% { transform: translateX(-2px); }
    80% { transform: translateX(2px); }
}

.lock-bubble {
    max-width: 240px;
    padding: 7px 10px;
    background: #2a3d5c;
    color: white;
    font-size: 11.5px;
    line-height: 1.4;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    text-align: right;
}

.lock-notice-bubble {
    position: relative;
    padding-right: 22px;
    text-align: left;
}

.lock-notice-dismiss {
    position: absolute;
    top: 3px;
    right: 5px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.75);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    padding: 2px;

    &:hover {
        color: white;
    }
}
</style>
