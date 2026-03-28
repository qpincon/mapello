<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { processUploadedImage } from "../util/imageProcess";
    import Quill from "quill";
    import { StyleAttributor, Scope } from "parchment";
    import QuillResizeImage from "quill-resize-image";
    import "quill/dist/quill.snow.css";
    import ColorPicker from "./ColorPicker.svelte";
    import type { Color } from "src/types";

    // Override Block to use <div> instead of <p>
    const Block = Quill.import("blots/block") as any;
    class DivBlock extends Block {
        static tagName = "div";
    }
    Quill.register(DivBlock, true);
    Quill.register("modules/resize", QuillResizeImage);

    // Use inline style="text-align: ..." instead of class="ql-align-..."
    const AlignStyle = Quill.import("attributors/style/align") as any;
    Quill.register(AlignStyle, true);

    // Register style attributors for inline styles instead of classes
    const ColorStyle = Quill.import("attributors/style/color") as any;
    const BackgroundStyle = Quill.import("attributors/style/background") as any;
    const FontStyle = Quill.import("attributors/style/font") as any;
    const SizeStyle = Quill.import("attributors/style/size") as any;
    Quill.register(ColorStyle, true);
    Quill.register(BackgroundStyle, true);
    Quill.register(FontStyle, true);
    Quill.register(SizeStyle, true);

    // Custom block-level attributors
    const BorderBottomStyle = new StyleAttributor("borderBottom", "border-bottom", { scope: Scope.BLOCK });
    const BlockBorderStyle = new StyleAttributor("blockBorder", "border", { scope: Scope.BLOCK });
    const BlockPaddingStyle = new StyleAttributor("blockPadding", "padding", { scope: Scope.BLOCK });
    Quill.register(BorderBottomStyle, true);
    Quill.register(BlockBorderStyle, true);
    Quill.register(BlockPaddingStyle, true);

    const sizeValues = ["10px", "12px", "14px", "16px", "18px", "24px", "32px"];
    const defaultFonts = ["serif", "sans-serif", "monospace"];

    // SVG icons for custom toolbar buttons (18x18 viewBox to match Quill's icon style)
    const toolbarIcons: Record<string, string> = {
        "container-bg": `<svg viewBox="0 0 18 18" width="18" height="18"><rect x="2" y="2" width="14" height="14" rx="2" fill="currentColor" opacity="0.3" stroke="currentColor" stroke-width="1"/></svg>`,
        "container-border": `<svg viewBox="0 0 18 18" width="18" height="18"><rect x="2" y="2" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
        "container-radius": `<svg viewBox="0 0 18 18" width="18" height="18"><path d="M2 12V6a4 4 0 0 1 4-4h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 6v6a4 4 0 0 1-4 4H6" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-dasharray="2 2"/></svg>`,
        blockBorder: `<svg viewBox="0 0 18 18" width="18" height="18"><rect x="3" y="3" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="7" x2="12" y2="7" stroke="currentColor" stroke-width="1" opacity="0.5"/><line x1="6" y1="11" x2="12" y2="11" stroke="currentColor" stroke-width="1" opacity="0.5"/></svg>`,
        borderBottom: `<svg viewBox="0 0 18 18" width="18" height="18"><line x1="6" y1="7" x2="12" y2="7" stroke="currentColor" stroke-width="1" opacity="0.4"/><line x1="6" y1="11" x2="12" y2="11" stroke="currentColor" stroke-width="1" opacity="0.4"/><line x1="3" y1="15" x2="15" y2="15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
        blockPadding: `<svg viewBox="0 0 18 18" width="18" height="18"><rect x="2" y="2" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 1"/><rect x="5" y="5" width="8" height="8" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="0.5"/></svg>`,
        "text-color": `<svg viewBox="0 0 18 18" width="18" height="18"><path d="M5 14l4-10 4 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="6.5" y1="10" x2="11.5" y2="10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="3" y1="16" x2="15" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        "text-bg": `<svg viewBox="0 0 18 18" width="18" height="18"><rect x="2" y="2" width="14" height="12" rx="1" fill="currentColor" opacity="0.2"/><path d="M6 12l3-8 3 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="7" y1="9.5" x2="11" y2="9.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
    };

    interface Props {
        value: string;
        onchange?: () => void;
        hasError?: boolean;
        placeholder?: string;
        fonts?: string[];
        containerStyle?: Record<string, string>;
    }

    let {
        value = $bindable(),
        onchange,
        hasError = false,
        placeholder = "Enter tooltip template using __column__ for variables...",
        fonts = [],
        containerStyle = $bindable(),
    }: Props = $props();

    let editorContainer: HTMLDivElement;
    let quillInstance: Quill | null = null;
    let isInternalUpdate = false;

    // ColorPicker instances for toolbar buttons that need color selection
    let containerBgPicker: ColorPicker | null = $state(null);
    let containerBorderPicker: ColorPicker | null = $state(null);
    let blockBorderPicker: ColorPicker | null = $state(null);
    let borderBottomPicker: ColorPicker | null = $state(null);
    let textColorPicker: ColorPicker | null = $state(null);
    let textBgPicker: ColorPicker | null = $state(null);

    // Current color values for the pickers
    let containerBgColor = $state<Color>("#ffffffff");
    let containerBorderColor = $state<Color>("#000000ff");
    let blockBorderColor = $state<Color>("#000000ff");
    let borderBottomColor = $state<Color>("#000000ff");
    let textColorValue = $state<Color>("#000000ff");
    let textBgValue = $state<Color>("#ffffffff");

    function extractColorFromBorder(border?: string): Color {
        if (!border) return "#000000ff" as Color;
        const match = border.match(/#[0-9a-fA-F]{3,8}/i);
        const hex = match ? match[0] : "#000000";
        return (hex.length === 7 ? hex + "ff" : hex) as Color;
    }

    function hexToShort(hex: string): string {
        // Strip trailing "ff" alpha for CSS usage
        if (hex.length === 9 && hex.toLowerCase().endsWith("ff")) return hex.slice(0, 7);
        return hex;
    }

    function imageHandler(): void {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml";
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file || !quillInstance) return;
            let dataUrl: string;
            try {
                dataUrl = await processUploadedImage(file);
            } catch (err) {
                alert((err as Error).message);
                return;
            }
            const range = quillInstance!.getSelection(true);
            quillInstance!.insertEmbed(range.index, "image", dataUrl);
            quillInstance!.setSelection(range.index + 1);
        };
        input.click();
    }

    // --- Container style toolbar handlers ---
    function containerBgHandler(): void {
        if (!containerStyle) return;
        containerBgColor = (containerStyle["background-color"]
            ? (containerStyle["background-color"].length === 7 ? containerStyle["background-color"] + "ff" : containerStyle["background-color"])
            : "#ffffffff") as Color;
        containerBgPicker?.open();
    }

    function onContainerBgChange(color: Color): void {
        if (!containerStyle) return;
        containerStyle["background-color"] = hexToShort(color);
        applyContainerStyleToEditor();
        onchange?.();
    }

    function containerBorderHandler(): void {
        if (!containerStyle) return;
        containerBorderColor = extractColorFromBorder(containerStyle["border"]);
        containerBorderPicker?.open();
    }

    function onContainerBorderChange(color: Color): void {
        if (!containerStyle) return;
        const width = containerStyle["border"]?.match(/\d+px/)?.[0] || "1px";
        containerStyle["border"] = `${width} solid ${hexToShort(color)}`;
        applyContainerStyleToEditor();
        onchange?.();
    }

    function containerRadiusHandler(): void {
        if (!containerStyle) return;
        const presets = ["0px", "4px", "8px", "12px", "16px"];
        const current = containerStyle["border-radius"] || "4px";
        const idx = presets.indexOf(current);
        containerStyle["border-radius"] = presets[(idx + 1) % presets.length];
        applyContainerStyleToEditor();
        onchange?.();
    }

    // --- Block border toolbar handlers ---
    function blockBorderHandler(): void {
        if (!quillInstance) return;
        const format = quillInstance.getFormat();
        if (format.blockBorder) {
            quillInstance.format("blockBorder", false);
        } else {
            blockBorderPicker?.open();
        }
    }

    function onBlockBorderChange(color: Color): void {
        setTimeout(() => quillInstance?.format("blockBorder", `1px solid ${hexToShort(color)}`), 0);
    }

    function borderBottomHandler(): void {
        if (!quillInstance) return;
        const format = quillInstance.getFormat();
        if (format.borderBottom) {
            quillInstance.format("borderBottom", false);
        } else {
            borderBottomPicker?.open();
        }
    }

    function onBorderBottomChange(color: Color): void {
        setTimeout(() => quillInstance?.format("borderBottom", `1px solid ${hexToShort(color)}`), 0);
    }

    // --- Block padding handler ---
    function blockPaddingHandler(): void {
        if (!quillInstance) return;
        const format = quillInstance.getFormat();
        const current = format.blockPadding as string || "";
        const presets = ["", "2px", "4px", "8px", "12px"];
        const idx = presets.indexOf(current);
        const next = presets[(idx + 1) % presets.length];
        quillInstance.format("blockPadding", next || false);
    }

    // --- Text color / background handlers ---
    function textColorHandler(): void {
        if (!quillInstance) return;
        const format = quillInstance.getFormat();
        const current = (format.color as string) || "#000000";
        textColorValue = (current.length === 7 ? current + "ff" : current) as Color;
        textColorPicker?.open();
    }

    function onTextColorChange(color: Color): void {
        setTimeout(() => quillInstance?.format("color", hexToShort(color)), 0);
    }

    function textBgHandler(): void {
        if (!quillInstance) return;
        const format = quillInstance.getFormat();
        const current = (format.background as string) || "#ffffff";
        textBgValue = (current.length === 7 ? current + "ff" : current) as Color;
        textBgPicker?.open();
    }

    function onTextBgChange(color: Color): void {
        setTimeout(() => quillInstance?.format("background", hexToShort(color)), 0);
    }

    function applyContainerStyleToEditor(): void {
        if (!editorContainer || !containerStyle) return;
        const editor = editorContainer.querySelector(".ql-editor") as HTMLElement;
        if (!editor) return;
        // Reset first
        editor.style.cssText = "";
        for (const [prop, val] of Object.entries(containerStyle)) {
            if (prop === "z-index" || prop === "will-change") continue; // skip non-visual runtime props
            if (prop === "max-width" || prop === "width") continue; // skip sizing constraints — they apply to the rendered output, not the editor
            editor.style.setProperty(prop, val);
        }
        // Ensure min-height is preserved
        editor.style.minHeight = "120px";
    }

    onMount(() => {
        const allFonts = [...defaultFonts, ...fonts];
        FontStyle.whitelist = allFonts;
        SizeStyle.whitelist = sizeValues;

        const hasContainerStyle = !!containerStyle;

        // Build toolbar — container settings first (own row), then text formatting
        const toolbarConfig: any[][] = [];
        if (hasContainerStyle) {
            toolbarConfig.push(["container-bg", "container-border", "container-radius"]);
        }
        toolbarConfig.push(
            ["bold", "italic", "underline"],
            ["text-color", "text-bg"],
            [{ font: allFonts }, { size: sizeValues }],
            [{ align: [] }],
        );
        if (hasContainerStyle) {
            toolbarConfig.push(["blockBorder", "borderBottom", "blockPadding"]);
        }
        toolbarConfig.push(["image", "link"], ["clean"]);

        const handlers: Record<string, () => void> = {
            image: imageHandler,
            "text-color": textColorHandler,
            "text-bg": textBgHandler,
        };

        if (hasContainerStyle) {
            handlers["container-bg"] = containerBgHandler;
            handlers["container-border"] = containerBorderHandler;
            handlers["container-radius"] = containerRadiusHandler;
            handlers["blockBorder"] = blockBorderHandler;
            handlers["borderBottom"] = borderBottomHandler;
            handlers["blockPadding"] = blockPaddingHandler;
        }

        quillInstance = new Quill(editorContainer, {
            theme: "snow",
            modules: {
                toolbar: {
                    container: toolbarConfig,
                    handlers,
                },
                resize: {
                    locale: {},
                },
            },
            placeholder: placeholder,
        });

        const toolbar = editorContainer.previousElementSibling;
        if (toolbar) {
            // Inject SVG icons into custom toolbar buttons
            for (const [cls, svg] of Object.entries(toolbarIcons)) {
                const btn = toolbar.querySelector(`.ql-${cls}`);
                if (btn) btn.innerHTML = svg;
            }

            // Force container toolbar group onto its own line by inserting a flex line-break after it
            if (hasContainerStyle) {
                const firstFormats = toolbar.querySelector(".ql-formats");
                if (firstFormats) {
                    const lineBreak = document.createElement("div");
                    lineBreak.className = "ql-toolbar-line-break";
                    firstFormats.after(lineBreak);
                }
            }

            // Fix font picker: set data-label and font-family on each item
            toolbar.querySelectorAll(".ql-font .ql-picker-item").forEach((item) => {
                const val = item.getAttribute("data-value");
                if (val) {
                    item.setAttribute("data-label", val);
                    (item as HTMLElement).style.fontFamily = val;
                } else {
                    item.setAttribute("data-label", "Default");
                }
            });
            const fontLabel = toolbar.querySelector(".ql-font .ql-picker-label");
            if (fontLabel && !fontLabel.getAttribute("data-value")) {
                fontLabel.setAttribute("data-label", "Default");
            }

            // Fix size picker: set data-label on each item
            toolbar.querySelectorAll(".ql-size .ql-picker-item").forEach((item) => {
                const val = item.getAttribute("data-value");
                if (val) {
                    item.setAttribute("data-label", val);
                } else {
                    item.setAttribute("data-label", "Default");
                }
            });
            const sizeLabel = toolbar.querySelector(".ql-size .ql-picker-label");
            if (sizeLabel && !sizeLabel.getAttribute("data-value")) {
                sizeLabel.setAttribute("data-label", "Default");
            }

            // Add tooltips to toolbar buttons
            const tooltips: Record<string, string> = {
                bold: "Bold",
                italic: "Italic",
                underline: "Underline",
                image: "Insert image (PNG, JPG, SVG)",
                link: "Insert link",
                clean: "Clear formatting",
                "text-color": "Text color",
                "text-bg": "Text background",
                font: "Font family",
                size: "Font size",
                blockBorder: "Block border (toggle)",
                borderBottom: "Border bottom (toggle)",
                "container-bg": "Container background",
                "container-border": "Container border color",
                "container-radius": "Container border radius",
                blockPadding: "Block padding (cycle)",
            };
            for (const [format, label] of Object.entries(tooltips)) {
                const btn = toolbar.querySelector(`.ql-${format}`);
                if (btn) btn.setAttribute("title", label);
            }
            const alignBtn = toolbar.querySelector(".ql-align");
            if (alignBtn) alignBtn.setAttribute("title", "Text alignment");
        }

        // Set initial content
        if (value) {
            quillInstance.root.innerHTML = value;
        }

        // Apply container style to editor for WYSIWYG
        if (hasContainerStyle) {
            applyContainerStyleToEditor();
        }

        // Intercept image drop so files go through processUploadedImage.
        // Use capture phase on the container so we fire before Quill's own drop handler.
        editorContainer.addEventListener("drop", (e: DragEvent) => {
            const files = e.dataTransfer?.files;
            if (!files || !files.length) return;
            const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"));
            if (!imageFile) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            (async () => {
                let dataUrl: string;
                try {
                    dataUrl = await processUploadedImage(imageFile);
                } catch (err) {
                    alert((err as Error).message);
                    return;
                }
                const range = quillInstance!.getSelection(true);
                quillInstance!.insertEmbed(range.index, "image", dataUrl);
                quillInstance!.setSelection(range.index + 1);
            })();
        }, true);

        // Listen for text changes
        quillInstance.on("text-change", () => {
            if (isInternalUpdate) return;

            const html = quillInstance!.root.innerHTML;
            // Quill uses <div><br></div> for empty content (with our custom block)
            value = html === "<div><br></div>" ? "" : html;
            onchange?.();
        });
    });

    onDestroy(() => {
        quillInstance = null;
    });

    export function focus(): void {
        quillInstance?.focus();
    }

    // Update editor when value changes externally
    $effect(() => {
        if (quillInstance && value !== quillInstance.root.innerHTML) {
            isInternalUpdate = true;
            quillInstance.root.innerHTML = value || "";
            isInternalUpdate = false;
        }
    });

    // Apply container style reactively when it changes externally
    $effect(() => {
        if (containerStyle && quillInstance) {
            applyContainerStyleToEditor();
        }
    });
</script>

<div class="quill-wrapper" class:is-invalid={hasError}>
    <div bind:this={editorContainer}></div>
    <!-- Hidden ColorPicker instances used by toolbar handlers -->
    <div class="color-pickers-container">
        <ColorPicker bind:this={textColorPicker} value={textColorValue} onChange={onTextColorChange} />
        <ColorPicker bind:this={textBgPicker} value={textBgValue} onChange={onTextBgChange} />
        {#if containerStyle}
            <ColorPicker bind:this={containerBgPicker} value={containerBgColor} onChange={onContainerBgChange} />
            <ColorPicker bind:this={containerBorderPicker} value={containerBorderColor} onChange={onContainerBorderChange} />
            <ColorPicker bind:this={blockBorderPicker} value={blockBorderColor} onChange={onBlockBorderChange} />
            <ColorPicker bind:this={borderBottomPicker} value={borderBottomColor} onChange={onBorderBottomChange} />
        {/if}
    </div>
</div>

<style>
    .quill-wrapper {
        background: white;
        border-radius: 0.375rem;
        position: relative;
    }

    .quill-wrapper.is-invalid {
        border: 1px solid var(--bs-danger);
        border-radius: 0.375rem;
    }

    .color-pickers-container {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
    }
    .color-pickers-container :global(div) {
        pointer-events: auto;
    }

    .quill-wrapper :global(.ql-container) {
        min-height: 120px;
    }

    .quill-wrapper :global(.ql-editor) {
        min-height: 120px;
    }

    .quill-wrapper :global(.ql-editor img) {
        max-width: 100%;
        height: auto;
    }

    .quill-wrapper :global(.ql-toolbar) {
        border-top-left-radius: 0.375rem;
        border-top-right-radius: 0.375rem;
        padding: 4px 6px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
    }

    .quill-wrapper :global(.ql-container) {
        border-bottom-left-radius: 0.375rem;
        border-bottom-right-radius: 0.375rem;
    }

    .quill-wrapper :global(.ql-toolbar .ql-formats) {
        margin-right: 8px;
    }

    /* Force a line break after the container toolbar group */
    .quill-wrapper :global(.ql-toolbar-line-break) {
        flex-basis: 100%;
        height: 0;
    }

    /* Use data-label for font/size picker items (overrides Snow theme defaults) */
    .quill-wrapper :global(.ql-font .ql-picker-item[data-label]:not([data-label=""])::before),
    .quill-wrapper :global(.ql-font .ql-picker-label[data-label]:not([data-label=""])::before) {
        content: attr(data-label) !important;
    }
    .quill-wrapper :global(.ql-size .ql-picker-item[data-label]:not([data-label=""])::before),
    .quill-wrapper :global(.ql-size .ql-picker-label[data-label]:not([data-label=""])::before) {
        content: attr(data-label) !important;
    }

    /* Custom toolbar buttons: ensure SVG icons display properly */
    .quill-wrapper :global(.ql-container-bg),
    .quill-wrapper :global(.ql-container-border),
    .quill-wrapper :global(.ql-container-radius),
    .quill-wrapper :global(.ql-blockBorder),
    .quill-wrapper :global(.ql-borderBottom),
    .quill-wrapper :global(.ql-blockPadding),
    .quill-wrapper :global(.ql-text-color),
    .quill-wrapper :global(.ql-text-bg) {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
    }
    .quill-wrapper :global(.ql-container-bg svg),
    .quill-wrapper :global(.ql-container-border svg),
    .quill-wrapper :global(.ql-container-radius svg),
    .quill-wrapper :global(.ql-blockBorder svg),
    .quill-wrapper :global(.ql-borderBottom svg),
    .quill-wrapper :global(.ql-blockPadding svg),
    .quill-wrapper :global(.ql-text-color svg),
    .quill-wrapper :global(.ql-text-bg svg) {
        width: 18px;
        height: 18px;
    }
</style>
