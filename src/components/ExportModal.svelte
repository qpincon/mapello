<script lang="ts">
    import Modal from "./Modal.svelte";
    import { ExportFontChoice, type ExportOptions } from "../svg/export";
    import { exportMacro } from "../macro/export";
    import { exportMicro } from "../micro/drawing";
    import { commonState, macroState, microState } from "../state.svelte";
    import { exportStyleSheet } from "../util/dom";
    import type { SvgSelection } from "../types";
    import { loadSvgString } from "../svg/svg";

    interface Props {
        open: boolean;
        mode: "macro" | "micro";
        svgNode: SvgSelection;
        inlineFontUsed: boolean;
        computeMacroCss: () => string;
        onExport: (options: ExportOptions) => void;
        onClosed: () => void;
    }

    let { open = $bindable(), mode, svgNode, inlineFontUsed, computeMacroCss, onExport, onClosed }: Props = $props();

    let animate = $state(false);
    let useViewBox = $state(false);
    let frameShadow = $state(true);
    let fontUsedElsewhere = $state(true);
    let showAdvanced = $state(false);
    let minifyJs = $state(true);
    let previewContainer: HTMLDivElement;

    function getExportFontChoice(): ExportFontChoice {
        if (!inlineFontUsed) return ExportFontChoice.convertToPath;
        return fontUsedElsewhere ? ExportFontChoice.noExport : ExportFontChoice.embedFontFace;
    }

    function buildOptions(): ExportOptions {
        return {
            animate,
            useViewBox,
            frameShadow,
            exportFonts: getExportFontChoice(),
            minifyJs: mode === "macro" ? minifyJs : undefined,
        };
    }

    async function updatePreview() {
        const options: ExportOptions = {
            animate,
            useViewBox,
            frameShadow,
            exportFonts: getExportFontChoice(),
        };
        let svgString: string | void;
        if (mode === "macro") {
            const totalCss = computeMacroCss();
            svgString = await exportMacro(svgNode, macroState, commonState.providedFonts, false, totalCss, options);
        } else {
            const microCss = exportStyleSheet("#micro .line") ?? "";
            svgString = await exportMicro(svgNode, microState, commonState.providedFonts, microCss, options, false);
        }
        if (!svgString) return;
        loadSvgString(svgString, previewContainer);
    }

    function onExportClicked() {
        onExport(buildOptions());
    }

    function onModalOpened() {
        updatePreview();
    }

    $effect(() => {
        // Re-run preview when animate or useViewBox changes (while open)
        if (open) {
            // Access reactive values to track them
            animate;
            useViewBox;
            frameShadow;
            updatePreview();
        }
    });
</script>

<Modal {open} {onClosed} onOpened={onModalOpened} modalWidth="70%">
    <div slot="header">
        <h2 class="fs-3 p-2 m-0">Export options</h2>
    </div>
    <div slot="content">
        <div class="export-layout">
            <div class="export-options">
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input
                            class="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="export-animate"
                            bind:checked={animate}
                        />
                        <label class="form-check-label" for="export-animate">Animate</label>
                    </div>
                    <small class="text-muted d-block ms-4"> The map will animate when entering the viewport </small>
                </div>

                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input
                            class="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="export-viewbox"
                            bind:checked={useViewBox}
                        />
                        <label class="form-check-label" for="export-viewbox">Use viewBox</label>
                    </div>
                    <small class="text-muted d-block ms-4">
                        SVG will fit its container instead of fixed width/height
                    </small>
                </div>

                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input
                            class="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="export-frame-shadow"
                            bind:checked={frameShadow}
                        />
                        <label class="form-check-label" for="export-frame-shadow">Frame shadow</label>
                    </div>
                    <small class="text-muted d-block ms-4"> Add a drop shadow around the map frame </small>
                </div>

                {#if inlineFontUsed}
                    <hr />
                    <h6 class="mb-2">Font</h6>
                    <p class="text-muted small mb-2">Will the font be used elsewhere on your page?</p>
                    <div class="form-check">
                        <input
                            class="form-check-input"
                            type="radio"
                            name="fontChoice"
                            id="fontYes"
                            checked={fontUsedElsewhere}
                            onchange={() => (fontUsedElsewhere = true)}
                        />
                        <label class="form-check-label" for="fontYes">
                            Yes
                            <span class="text-muted small">&mdash; don't embed font in SVG</span>
                        </label>
                    </div>
                    <div class="form-check">
                        <input
                            class="form-check-input"
                            type="radio"
                            name="fontChoice"
                            id="fontNo"
                            checked={!fontUsedElsewhere}
                            onchange={() => (fontUsedElsewhere = false)}
                        />
                        <label class="form-check-label" for="fontNo">
                            No
                            <span class="text-muted small">&mdash; embed @font-face URLs</span>
                        </label>
                    </div>
                {/if}

                <hr />
                <button
                    class="btn btn-sm btn-link p-0 text-decoration-none advanced-toggle"
                    type="button"
                    onclick={() => (showAdvanced = !showAdvanced)}
                >
                    <svg class="chevron" class:open={showAdvanced} width="12" height="12" viewBox="0 0 12 12">
                        <path
                            d="M4 2 L8 6 L4 10"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                    Advanced
                </button>

                {#if showAdvanced}
                    <div class="mt-2">
                        {#if mode === "macro"}
                            <div class="form-check form-switch">
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id="export-minify"
                                    bind:checked={minifyJs}
                                />
                                <label class="form-check-label" for="export-minify"> Minify JavaScript </label>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="export-preview">
                <h6 class="mb-2">Preview</h6>
                <div class="preview-container" bind:this={previewContainer}></div>
            </div>
        </div>
    </div>
    <div slot="footer" class="d-flex justify-content-end">
        <button type="button" class="btn btn-success" onclick={onExportClicked}>Export</button>
    </div>
</Modal>

<style>
    .export-layout {
        display: flex;
        gap: 1.5rem;
        min-height: 300px;
    }
    .export-options {
        flex: 0 0 35%;
        min-width: 200px;
    }
    .export-preview {
        flex: 1;
        min-width: 0;
        position: relative;
    }
    .preview-container {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        margin: 2rem;
    }
    .advanced-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
    }
    .chevron {
        transition: transform 0.2s ease;
    }
    .chevron.open {
        transform: rotate(90deg);
    }
</style>
