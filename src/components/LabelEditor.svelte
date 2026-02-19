<script lang="ts">
    import { tick } from "svelte";
    import { saveState } from "../util/save";

    interface EditState {
        entityId: string;
        entityIndex: number;
        originalText: string;
    }

    interface Props {
        onCommit: (entityIndex: number, newText: string) => void;
        onCancel: () => void;
        onStyleEdit?: (entityId: string, x: number, y: number) => void;
    }

    let { onCommit, onCancel, onStyleEdit }: Props = $props();

    let editState: EditState | null = $state(null);
    let editorElem: HTMLTextAreaElement | null = $state(null);

    export async function enter(id: string, index: number, svgTextElem: SVGTextElement): Promise<void> {
        const currentText = svgTextElem.textContent ?? "";
        // Gather text from tspans if present
        const tspans = Array.from(svgTextElem.querySelectorAll("tspan"));
        const text = tspans.length > 0 ? tspans.map((t) => t.textContent ?? "").join("\n") : currentText;

        editState = { entityId: id, entityIndex: index, originalText: text };
        await tick();
        if (!editorElem) return;

        const rect = svgTextElem.getBoundingClientRect();
        const cs = window.getComputedStyle(svgTextElem);

        editorElem.style.left = rect.left + "px";
        editorElem.style.top = rect.top + "px";
        editorElem.style.width = Math.max(rect.width, 80) + "px";
        editorElem.style.height = Math.max(rect.height, 20) + "px";
        editorElem.style.fontSize = cs.fontSize;
        editorElem.style.fontFamily = cs.fontFamily;
        editorElem.style.fontWeight = cs.fontWeight;
        editorElem.style.letterSpacing = cs.letterSpacing;
        editorElem.style.color = cs.color;
        editorElem.value = text;

        svgTextElem.style.visibility = "hidden";
        editorElem.focus();
        editorElem.setSelectionRange(text.length, text.length);
    }

    export function isEditing(): boolean {
        return editState !== null;
    }

    export function exit(): void {
        if (!editState) return;
        const svgText = document.getElementById(editState.entityId);
        if (svgText) svgText.style.visibility = "";
        if (editorElem) editorElem.style.display = "none"; // hide immediately (e.g. when drag starts)
        editState = null;
    }

    function commit(): void {
        if (!editState) return;
        const state = editState;
        const newText = editorElem?.value ?? "";
        exit();
        if (newText !== state.originalText) {
            onCommit(state.entityIndex, newText);
        }
    }

    function cancel(): void {
        exit();
        onCancel();
    }

    function onKeydown(e: KeyboardEvent): void {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
        } else if (e.key === "Escape") {
            cancel();
        }
    }

    function onBlur(): void {
        commit();
    }
</script>

{#if editState}
    <textarea
        bind:this={editorElem}
        class="label-editor"
        onkeydown={onKeydown}
        onblur={onBlur}
        ondblclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = editState?.entityId;
            exit();
            if (id) onStyleEdit?.(id, e.pageX, e.pageY);
        }}
    ></textarea>
{/if}

<style>
    .label-editor {
        position: fixed;
        z-index: 9999;
        background: transparent;
        border: none;
        outline: none;
        resize: none;
        white-space: pre;
        overflow: hidden;
        pointer-events: all;
        padding: 0;
        margin: 0;
    }
</style>
