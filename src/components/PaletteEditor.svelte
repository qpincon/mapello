<script lang="ts">
    import Icon from "./Icon.svelte";
    import ColorPicker from "./ColorPicker.svelte";
    import addIcon from "../assets/img/add.svg?raw";
    import { debounce } from "lodash-es";
    import type { Color } from "src/types";

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

    let colorPickers: (ColorPicker | null)[] = $state([]);
    let hoveringColor: number | null = $state(null);
    let dragStartIndex: number | null = $state(null);

    $effect(() => {
        if (colorPickers.length !== palette.length) {
            colorPickers = palette.map(() => null);
        }
    });

    function _onChange(): void {
        if (onChange) onChange();
    }

    let _onChangeDebounced = $derived(debounce(_onChange, 300));

    function findMatchedValues(color: string): string | null {
        if (!mapping || !(color in mapping)) return null;
        return [...mapping[color]].map((name) => `"${name}"`).join(", ");
    }

    function dropColor(event: DragEvent, target: number): void {
        event.preventDefault();
        if (dragStartIndex === null || dragStartIndex === target) {
            hoveringColor = null;
            dragStartIndex = null;
            return;
        }
        const item = palette.splice(dragStartIndex, 1)[0];
        palette.splice(target, 0, item);
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
    <small class="text-muted d-block mb-2">
        Drag and drop to reorder colors.
    </small>

    <div class="color-list">
        {#each palette as color, i}
            <div
                class="color-row d-flex align-items-center gap-2 px-2 py-1 rounded-2"
                class:is-dnd-hovering-top={hoveringColor === i && dragStartIndex !== null && i < dragStartIndex}
                class:is-dnd-hovering-bottom={hoveringColor === i && dragStartIndex !== null && i > dragStartIndex}
                draggable="true"
                role="listitem"
                ondragstart={(event) => {
                    event.dataTransfer!.effectAllowed = "move";
                    event.dataTransfer!.dropEffect = "move";
                    dragStartIndex = i;
                }}
                ondragover={(event) => event.preventDefault()}
                ondragenter={() => (hoveringColor = i)}
                ondrop={(event) => dropColor(event, i)}
                ondragend={() => {
                    hoveringColor = null;
                    dragStartIndex = null;
                }}
            >
                <span class="drag-handle" title="Drag to reorder">☰</span>
                <div
                    class="color-swatch border border-primary rounded-1"
                    style={`background-color: ${color};`}
                    onclick={() => colorPickers[i]?.open()}
                    role="button"
                >
                    <ColorPicker
                        bind:this={colorPickers[i]}
                        value={color as Color}
                        onChange={(c: string) => {
                            palette[i] = c;
                            _onChangeDebounced();
                        }}
                    />
                </div>
                <code class="color-hex">{color.substring(0, 7)}</code>
                {#if mode === "categorical"}
                    {@const matched = findMatchedValues(color)}
                    {#if matched}
                        <span class="matched-values text-muted" title={matched}>
                            {matched}
                        </span>
                    {/if}
                {/if}
                <button
                    class="btn btn-sm btn-close ms-auto"
                    aria-label="Remove color"
                    onclick={() => {
                        palette.splice(i, 1);
                        palette = palette;
                        _onChangeDebounced();
                    }}
                ></button>
            </div>
        {/each}
    </div>

    <button
        class="btn btn-outline-secondary btn-sm mt-2 d-flex align-items-center gap-1"
        onclick={() => {
            palette.push("#aaaaaaff");
            palette = palette;
            _onChangeDebounced();
        }}
    >
        <Icon width="1.2rem" height="1.2rem" fillColor="none" svg={addIcon} />
        Add color
    </button>

    {#if mode === "continuous" && palette.length >= 2}
        <div class="mt-3">
            <small class="text-muted">
                {palette.length} anchor color{palette.length !== 1 ? "s" : ""} → {nbBreaks} interpolated colors
            </small>
            <div
                class="gradient-preview rounded-2 mt-1"
                style={`background: ${gradientCss(palette)};`}
            ></div>
        </div>
    {/if}
</div>

<style>
    .palette-editor {
        padding-bottom: 50px;
    }
    :global(.modal-content:has(.palette-editor)) {
        overflow: visible !important;
    }
    .color-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .color-row {
        cursor: grab;
        transition: background-color 0.1s;
    }
    .color-row:hover {
        background-color: rgba(0, 0, 0, 0.04);
    }
    .drag-handle {
        cursor: grab;
        color: #999;
        user-select: none;
        font-size: 0.9rem;
    }
    .color-swatch {
        width: 2rem;
        height: 2rem;
        flex-shrink: 0;
        cursor: pointer;
    }
    .color-hex {
        font-size: 0.8rem;
        white-space: nowrap;
    }
    .matched-values {
        font-size: 0.75rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 15rem;
    }
    .is-dnd-hovering-top {
        border-top: 2px solid var(--bs-primary) !important;
    }
    .is-dnd-hovering-bottom {
        border-bottom: 2px solid var(--bs-primary) !important;
    }
    .gradient-preview {
        height: 1.5rem;
        border: 1px solid #ccc;
    }
</style>
