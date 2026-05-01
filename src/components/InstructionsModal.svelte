<script lang="ts">
    import Modal from "./Modal.svelte";
    import ExportInstructions from "./ExportInstructions.svelte";

    interface Props {
        open: boolean;
        onClosed: () => void;
    }

    let { open = $bindable(), onClosed }: Props = $props();
</script>

<Modal {open} {onClosed} modalWidth="640px">
    <div slot="header">
        <h2 class="fs-4 p-2 m-0">Instructions</h2>
    </div>
    <div slot="content" class="instructions-content">
        <section class="instructions-section">
            <h6 class="section-title">Tilt and rotate the map</h6>
            <p class="mb-2 small">
                In the <strong>satellite</strong> projection, hold <kbd>Ctrl</kbd>
                (or <kbd>⌘</kbd> on Mac) while dragging the map:
            </p>
            <ul class="tip-list">
                <li>Drag <strong>vertically</strong> to change the tilt</li>
                <li>Drag <strong>horizontally</strong> to rotate the view</li>
            </ul>
        </section>

        <section class="instructions-section">
            <h6 class="section-title">Multi-line labels</h6>
            <p class="mb-0 small">
                While editing a label, press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to insert a line break.
            </p>
        </section>

        <section class="instructions-section">
            <h6 class="section-title">Edit a hand-drawn path</h6>
            <ul class="tip-list">
                <li>Click and drag anywhere on the path to move the whole path</li>
                <li><kbd>Ctrl</kbd> + click anywhere on the path to add a point</li>
                <li>
                    <kbd>Ctrl</kbd> + click on a point to remove it.
                    Removing a point when there are only two will delete the path.
                </li>
            </ul>
        </section>

        <section class="instructions-section">
            <h6 class="section-title">Use your exported SVG in an HTML page</h6>
            <ExportInstructions />
        </section>
    </div>
    <div slot="footer" class="footer-row">
        <button type="button" class="btn btn-primary" onclick={onClosed}>OK</button>
    </div>
</Modal>

<style>
    .instructions-content {
        padding: 0.25rem 0.5rem;
        max-height: 70vh;
        overflow-y: auto;
    }
    .instructions-section {
        padding: 1rem 0;
        border-bottom: 1px solid #eef0f3;
    }
    .instructions-section:first-child {
        padding-top: 0.25rem;
    }
    .instructions-section:last-child {
        border-bottom: none;
        padding-bottom: 0.25rem;
    }
    .section-title {
        font-weight: 600;
        margin-bottom: 0.6rem;
        color: #1f2937;
    }
    .tip-list {
        padding-left: 1.25rem;
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.6;
    }
    .tip-list li {
        margin-bottom: 0.3rem;
    }
    .tip-list li:last-child {
        margin-bottom: 0;
    }
    .footer-row {
        display: flex;
        justify-content: flex-end;
        width: 100%;
    }
    kbd {
        background: #f3f4f6;
        border: 1px solid #d0d7de;
        border-bottom-width: 2px;
        border-radius: 4px;
        padding: 0.05em 0.4em;
        font-size: 0.82em;
        color: #1f2937;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
</style>
