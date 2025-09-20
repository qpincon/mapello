<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { quintOut } from "svelte/easing";
    import { initTooltips } from "../util/common";

    // Types
    interface EventRemover {
        remove: () => void;
    }

    type NoopFunction = () => void;

    const noop: NoopFunction = () => {};

    interface Props {
        open: boolean;
        dialogClasses?: string;
        modalWidth?: string;
        backdrop?: boolean;
        ignoreBackdrop?: boolean;
        keyboard?: boolean;
        describedby?: string;
        labelledby?: string;
        onOpened?: NoopFunction;
        onClosed?: NoopFunction;
    }

    let {
        open,
        dialogClasses = "",
        modalWidth = "50%",
        backdrop = true,
        ignoreBackdrop = false,
        keyboard = true,
        describedby = "",
        labelledby = "",
        onOpened = noop,
        onClosed = noop,
    }: Props = $props();

    let _keyboardEvent: EventRemover | null = null;

    function attachEvent(
        target: EventTarget,
        type: string,
        listener: EventListener,
        options?: boolean | AddEventListenerOptions,
    ): EventRemover {
        target.addEventListener(type, listener, options);
        return {
            remove: () => target.removeEventListener(type, listener, options),
        };
    }

    function checkClass(className: string): boolean {
        return document.body.classList.contains(className);
    }

    function modalOpen(): void {
        if (!checkClass("modal-open")) {
            document.body.classList.add("modal-open");
        }
    }

    function modalClose(): void {
        if (checkClass("modal-open")) {
            document.body.classList.remove("modal-open");
        }
    }

    function handleBackdrop(event: MouseEvent): void {
        if (event.target !== event.currentTarget) {
            return;
        }
        if (backdrop && !ignoreBackdrop) {
            event.stopPropagation();
            open = false;
        }
    }

    function onModalOpened(): void {
        if (keyboard) {
            _keyboardEvent = attachEvent(document, "keydown", (e: Event) => {
                const keyboardEvent = e as KeyboardEvent;
                if (keyboardEvent.key === "Escape") {
                    open = false;
                }
            });
        }
        initTooltips();
        onOpened();
    }

    function onModalClosed(): void {
        if (_keyboardEvent) {
            _keyboardEvent.remove();
            _keyboardEvent = null;
        }
        onClosed();
    }

    $effect(() => {
        if (open) {
            modalOpen();
        } else {
            modalClose();
        }
    });
</script>

{#if open}
    <div
        class="modal show"
        tabindex="-1"
        role="dialog"
        aria-labelledby={labelledby}
        aria-describedby={describedby}
        aria-modal="true"
        onclick={handleBackdrop}
        onintroend={onModalOpened}
        onoutroend={onModalClosed}
        transition:fade
        style:--bs-modal-width={modalWidth}
    >
        <div
            class="modal-dialog {dialogClasses}"
            role="document"
            in:fly={{ y: -50, duration: 300 }}
            out:fly={{ y: -50, duration: 300, easing: quintOut }}
        >
            <div class="modal-content">
                <div class="modal-header p-3">
                    <slot name="header" />
                    <button
                        type="button"
                        class="btn-close me-2"
                        data-bs-dismiss="modal"
                        aria-label="Close"
                        onclick={() => (open = false)}
                    ></button>
                </div>
                <div class="modal-body p-3">
                    <slot name="content" />
                </div>
                <div class="modal-footer">
                    <slot name="footer" />
                </div>
            </div>
        </div>
    </div>
    {#if open}
        <div class="modal-backdrop show" transition:fade={{ duration: 150 }}></div>
    {/if}
{/if}

<style>
    .modal {
        display: block;
    }
    .modal-header {
        background-color: #f7f7f7;
    }
    .modal-dialog {
        min-width: 10rem;
    }
    .modal-content {
        overflow-x: scroll;
    }
</style>
