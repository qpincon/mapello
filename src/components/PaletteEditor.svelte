<script lang="ts">
    import Icon from "./Icon.svelte";
    import StyleColorPicker from "./StyleColorPicker.svelte";
    import addIcon from "../assets/img/add.svg?raw";
    import { debounce } from "lodash-es";

    interface Props {
        palette: string[];
        onChange?: () => void;
        mapping?: Record<string, Set<string>>;
        mode?: "categorical" | "continuous";
        nbBreaks?: number;
    }

    let {
        palette,
        onChange = () => {},
        mapping = {},
        mode = "categorical",
        nbBreaks = 5,
    }: Props = $props();

    let hoveringColor: number | null = $state(null);
    let dragStartIndex: number | null = $state(null);

    const _onChangeDebounced = $derived(debounce(() => onChange(), 300));

    function findMatchedValues(color: string): string | null {
        const matched = mapping[color] ?? null;
        if (!matched || matched.size === 0) return null;
        return Array.from(matched).join(", ");
    }

    function dropColor(event: DragEvent, targetIndex: number): void {
        event.preventDefault();
        if (dragStartIndex === null || dragStartIndex === targetIndex) return;
        const moved = palette.splice(dragStartIndex, 1)[0];
        palette.splice(targetIndex, 0, moved);
        palette = palette;
        hoveringColor = null;
        dragStartIndex = null;
        _onChangeDebounced();
    }

    function gradientCss(colors: string[]): string {
        return `linear-gradient(to right, ${colors.join(", ")})`;
    }
</script>

<div class="palette-editor">
    <small class="text-muted d-block mb-2">Drag and drop to reorder colors.</small>

    <div class="color-list">
        {#each palette as color, i}
            <div
                class="color-row d-flex align-items-center gap-2 px-2 py-1 rounded-2"
                class:is-dnd-hovering-top={hoveringColor === i && dragStartIndex !== null && i < dragStartIndex}
                class:is-dnd-hovering-bottom={hoveringColor === i && dragStartIndex !== null && i > dragStartIndex}
                draggable="true"
                role="listitem"
                ondragstart={(e) => { e.dataTransfer!.effectAllowed = "move"; dragStartIndex = i; }}
                ondragover={(e) => e.preventDefault()}
                ondragenter={() => (hoveringColor = i)}
                ondrop={(e) => dropColor(e, i)}
                ondragend={() => { hoveringColor = null; dragStartIndex = null; }}
            >
                <span class="drag-handle" title="Drag to reorder">☰</span>
                <StyleColorPicker
                    value={color}
                    onChange={(c) => { palette[i] = c; _onChangeDebounced(); }}
                />
                <code class="color-hex">{color.substring(0, 7)}</code>
                {#if mode === "categorical"}
                    {@const matched = findMatchedValues(color)}
                    {#if matched}
                        <span class="matched-values text-muted" title={matched}>{matched}</span>
                    {/if}
                {/if}
                <button
                    class="btn btn-sm btn-close ms-auto"
                    aria-label="Remove color"
                    onclick={() => { palette.splice(i, 1); palette = palette; _onChangeDebounced(); }}
                ></button>
            </div>
        {/each}
    </div>

    <button
        class="btn btn-outline-secondary btn-sm mt-2 d-flex align-items-center gap-1"
        onclick={() => { palette.push("#aaaaaaff"); palette = palette; _onChangeDebounced(); }}
    >
        <Icon width="1.2rem" height="1.2rem" fillColor="none" svg={addIcon} />
        Add color
    </button>

    {#if mode === "continuous" && palette.length >= 2}
        <div class="mt-3">
            <small class="text-muted">
                {palette.length} anchor color{palette.length !== 1 ? "s" : ""} → {nbBreaks} interpolated colors
            </small>
            <div class="gradient-preview rounded-2 mt-1" style={`background: ${gradientCss(palette)};`}></div>
        </div>
    {/if}
</div>

<style>
    .palette-editor { padding-bottom: 50px; }
    :global(.modal-content:has(.palette-editor)) { overflow: visible !important; }
    .color-list { display: flex; flex-direction: column; gap: 2px; }
    .color-row { cursor: grab; transition: background-color 0.1s; }
    .color-row:hover { background-color: rgba(0, 0, 0, 0.04); }
    .drag-handle { cursor: grab; color: #999; user-select: none; font-size: 0.9rem; }
    .color-hex { font-size: 0.75rem; }
    .matched-values { font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 8rem; }
    .gradient-preview { height: 2rem; }
    .is-dnd-hovering-top { border-top: 2px solid #506784; }
    .is-dnd-hovering-bottom { border-bottom: 2px solid #506784; }
</style>
