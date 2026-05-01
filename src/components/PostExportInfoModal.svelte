<script lang="ts">
    import Modal from "./Modal.svelte";
    import ExportInstructions from "./ExportInstructions.svelte";

    interface Props {
        open: boolean;
        onClosed: () => void;
    }

    let { open = $bindable(), onClosed }: Props = $props();

    function dismiss() {
        onClosed();
    }

    function dontShowAgain() {
        localStorage.setItem("mapello-hide-post-export-info", "1");
        onClosed();
    }
</script>

<Modal {open} {onClosed} modalWidth="520px">
    <div slot="header">
        <h2 class="fs-4 p-2 m-0">Your map is ready</h2>
    </div>
    <div slot="content" class="post-export-content">
        <p class="text-muted mb-3">Here's how to use it in an HTML page.</p>
        <ExportInstructions />
    </div>
    <div slot="footer" class="footer-row">
        <button type="button" class="btn btn-link text-muted dont-show-btn" onclick={dontShowAgain}>
            Don't show again
        </button>
        <button type="button" class="btn btn-primary" onclick={dismiss}>OK</button>
    </div>
</Modal>

<style>
    .post-export-content {
        padding: 0.25rem 0.5rem;
    }
    .footer-row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        width: 100%;
    }
    .dont-show-btn {
        margin-right: auto;
        font-size: 0.85rem;
        text-decoration: none;
    }
    .dont-show-btn:hover {
        text-decoration: underline;
    }
</style>
