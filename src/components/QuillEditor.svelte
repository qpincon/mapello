<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { processUploadedImage } from "../util/imageProcess";
    import Quill from "quill";
    import QuillResizeImage from "quill-resize-image";
    import "quill/dist/quill.snow.css";

    // Override Block to use <div> instead of <p>
    const Block = Quill.import("blots/block") as any;
    class DivBlock extends Block {
        static tagName = "div";
    }
    Quill.register(DivBlock, true);
    Quill.register("modules/resize", QuillResizeImage);

    interface Props {
        value: string;
        onchange?: () => void;
        hasError?: boolean;
        placeholder?: string;
    }

    let { value = $bindable(), onchange, hasError = false, placeholder = "Enter tooltip template using __column__ for variables..." }: Props = $props();

    let editorContainer: HTMLDivElement;
    let quillInstance: Quill | null = null;
    let isInternalUpdate = false;

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

    onMount(() => {
        quillInstance = new Quill(editorContainer, {
            theme: "snow",
            modules: {
                toolbar: {
                    container: [["bold", "italic", "underline"], ["image", "link"], ["clean"]],
                    handlers: {
                        image: imageHandler,
                    },
                },
                resize: {
                    locale: {},
                },
            },
            placeholder: placeholder,
        });

        // Add tooltips to toolbar buttons
        const tooltips: Record<string, string> = {
            bold: "Bold",
            italic: "Italic",
            underline: "Underline",
            image: "Insert image (PNG, JPG, SVG)",
            link: "Insert link",
            clean: "Clear formatting",
        };
        const toolbar = editorContainer.previousElementSibling;
        if (toolbar) {
            for (const [format, label] of Object.entries(tooltips)) {
                const btn = toolbar.querySelector(`.ql-${format}`);
                if (btn) btn.setAttribute("title", label);
            }
        }

        // Set initial content
        if (value) {
            quillInstance.root.innerHTML = value;
        }

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
</script>

<div class="quill-wrapper" class:is-invalid={hasError}>
    <div bind:this={editorContainer}></div>
</div>

<style>
    .quill-wrapper {
        background: white;
        border-radius: 0.375rem;
    }

    .quill-wrapper.is-invalid {
        border: 1px solid var(--bs-danger);
        border-radius: 0.375rem;
    }

    .quill-wrapper :global(.ql-container) {
        min-height: 120px;
    }

    .quill-wrapper :global(.ql-editor) {
        min-height: 120px;
    }

    .quill-wrapper :global(.ql-toolbar) {
        border-top-left-radius: 0.375rem;
        border-top-right-radius: 0.375rem;
    }

    .quill-wrapper :global(.ql-container) {
        border-bottom-left-radius: 0.375rem;
        border-bottom-right-radius: 0.375rem;
    }
</style>
