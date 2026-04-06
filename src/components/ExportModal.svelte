<script lang="ts">
    import Modal from "./Modal.svelte";
    import { ExportFontChoice, type ExportOptions, type CustomAttribution } from "../svg/export";
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
    let fontUsedElsewhere = $state(false);
    let showAdvanced = $state(false);
    let minifyJs = $state(true);
    let customAttributions = $state<CustomAttribution[]>([]);
    const hasAnnotations = $derived(Object.keys(commonState.elementAnnotations ?? {}).length > 0);
    const fontUsedInAnnotations = $derived.by(() => {
        const annotations = commonState.elementAnnotations;
        if (!annotations) return false;
        const fontNames = commonState.providedFonts.map((f) => f.name);
        if (fontNames.length === 0) return false;
        for (const ann of Object.values(annotations)) {
            const html = (ann.tooltip || "") + (ann.popover || "");
            for (const name of fontNames) {
                if (html.includes(name)) return true;
            }
        }
        return false;
    });
    let sizeText = $state("");
    let isLargeExport = $state(false);
    let modalWidth = $state("600px");
    let previewContainer: HTMLDivElement;

    function getExportFontChoice(): ExportFontChoice {
        if (!inlineFontUsed) return ExportFontChoice.convertToPath;
        if (fontUsedElsewhere) return ExportFontChoice.noExport;
        if (fontUsedInAnnotations) return ExportFontChoice.embedFontFace;
        return ExportFontChoice.smallest;
    }

    function buildOptions(): ExportOptions {
        const validAttributions = customAttributions.filter((a) => a.text.trim());
        return {
            animate,
            useViewBox,
            frameShadow,
            exportFonts: getExportFontChoice(),
            minifyJs: mode === "macro" || hasAnnotations ? minifyJs : undefined,
            customAttributions: validAttributions.length > 0 ? validAttributions : undefined,
        };
    }

    async function updatePreview() {
        const validAttributions = customAttributions.filter((a) => a.text.trim());
        const options: ExportOptions = {
            animate,
            useViewBox,
            frameShadow,
            exportFonts: getExportFontChoice(),
            minifyJs,
            customAttributions: validAttributions.length > 0 ? validAttributions : undefined,
        };
        let svgString: string | void;
        if (mode === "macro") {
            const totalCss = computeMacroCss();
            svgString = await exportMacro(
                svgNode,
                macroState,
                commonState.providedFonts,
                false,
                totalCss,
                options,
                commonState.elementAnnotations,
            );
        } else {
            const microCss = exportStyleSheet("#micro .line") ?? "";
            svgString = await exportMicro(
                svgNode,
                microState,
                commonState.providedFonts,
                microCss,
                options,
                false,
                commonState.elementAnnotations,
            );
        }
        if (!svgString) return;

        const rawBytes = new TextEncoder().encode(svgString).byteLength;
        isLargeExport = rawBytes > 500 * 1024;
        const rawKB = (rawBytes / 1024).toFixed(1);
        const blob = new Blob([svgString]);
        const cs = new CompressionStream("gzip");
        const stream = blob.stream().pipeThrough(cs);
        const compressedBlob = await new Response(stream).blob();
        const gzKB = (compressedBlob.size / 1024).toFixed(1);
        sizeText = `${rawKB} KB (${gzKB} KB gzipped)`;

        await loadSvgString(svgString, previewContainer);
        const svgEl = previewContainer.querySelector("svg");
        let mapWidth = 0;
        if (svgEl) {
            const vb = svgEl.getAttribute("viewBox");
            const w = svgEl.getAttribute("width");
            if (vb) {
                mapWidth = +vb.split(/[\s,]+/)[2];
            } else if (w) {
                mapWidth = parseFloat(w);
            }
        }
        const overhead = 400;
        const needed = mapWidth + overhead;
        const maxWidth = window.innerWidth * 0.9;
        modalWidth = `${Math.max(600, Math.min(needed, maxWidth))}px`;
    }

    function onExportClicked() {
        onExport(buildOptions());
    }

    $effect(() => {
        // Re-run preview when options change (while open)
        if (open) {
            // Access reactive values to track them
            animate;
            useViewBox;
            frameShadow;
            minifyJs;
            JSON.stringify(customAttributions);
            updatePreview();
        }
    });
</script>

<Modal {open} {onClosed} {modalWidth}>
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
                    {#if isLargeExport}
                        <small class="perf-warning d-block ms-4"> Large file — will impact page performance </small>
                    {/if}
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
                        The map will fit its container instead of fixed width/height
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
                            {#if fontUsedInAnnotations}
                                <span class="text-muted small">&mdash; load fonts from the SVG</span>
                                <span
                                    class="help-tooltip fs-6"
                                    data-bs-toggle="tooltip"
                                    data-bs-title="The font is used in tooltips or popovers, so it will be loaded via @font-face for proper annotation rendering"
                                    >?</span
                                >
                            {:else}
                                <span class="text-muted small">&mdash; optimize fonts for smaller footprint</span>
                            {/if}
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
                        {#if mode === "macro" || (mode === "micro" && hasAnnotations)}
                            <div class="form-check form-switch mb-3">
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

                        <h6 class="mb-2">Custom attributions</h6>
                        {#each customAttributions as attr, i}
                            <div class="attribution-row mb-2">
                                <input
                                    type="text"
                                    class="form-control form-control-sm"
                                    placeholder="Text"
                                    bind:value={attr.text}
                                />
                                <input
                                    type="text"
                                    class="form-control form-control-sm"
                                    placeholder="Link (optional)"
                                    bind:value={attr.link}
                                />
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger remove-attr-btn"
                                    onclick={() => customAttributions.splice(i, 1)}
                                    title="Remove">&times;</button
                                >
                            </div>
                        {/each}
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-secondary"
                            onclick={() => customAttributions.push({ text: "", link: "" })}>+ Add attribution</button
                        >
                    </div>
                {/if}
            </div>

            <div class="export-preview">
                <h6 class="mb-2">
                    Preview {#if sizeText}<span class="size-text">{sizeText}</span>{/if}
                </h6>
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
        flex: 0 0 285px;
    }
    .export-preview {
        flex: 1;
        min-width: 0;
        position: relative;
    }
    .preview-container {
        padding: 1.5rem;
        overflow: auto;
    }
    .preview-container :global(svg) {
        max-width: 100%;
        height: auto;
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
    .size-text {
        font-weight: normal;
        color: var(--bs-secondary-color, #6c757d);
        font-size: 0.8em;
    }
    .perf-warning {
        color: #b45309;
        font-style: italic;
    }
    .attribution-row {
        display: flex;
        gap: 0.4rem;
        align-items: center;
    }
    .attribution-row input:first-child {
        flex: 1;
    }
    .attribution-row input:nth-child(2) {
        flex: 1.2;
    }
    .remove-attr-btn {
        padding: 0.1rem 0.4rem;
        line-height: 1;
    }
</style>
