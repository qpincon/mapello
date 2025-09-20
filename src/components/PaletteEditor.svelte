<script lang="ts">
    import Icon from "./Icon.svelte";
    import ColorPicker from "./ColorPicker.svelte";
    import addIcon from "../assets/img/add.svg?raw";
    import { debounce } from "lodash-es";
    import type { Color } from "src/types";

    interface Props {
        customCategoricalPalette: string[];
        onChange?: () => void;
        mapping?: Record<string, Set<string>>;
    }

    let { customCategoricalPalette, onChange = () => {}, mapping = {} }: Props = $props();

    let colorPickers: (ColorPicker | null)[] = $state([]);
    let hoveringColor: number | null = $state(null);
    let dragStartIndex: number | null = $state(null);

    $effect(() => {
        if (colorPickers.length !== customCategoricalPalette.length) {
            colorPickers = customCategoricalPalette.map(() => null);
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

    function getColors(x: Record<string, Set<string>>, y: string[]): string[] {
        return customCategoricalPalette;
    }
</script>

<span> Tip: it is possible to re-order dragging and dropping the colors.</span>
<div class="custom-palette-menu d-flex flex-wrap">
    {#each getColors(mapping, customCategoricalPalette) as color, i}
        <div
            class="position-relative d-flex flex-column justify-content-center p-4 m-2 color-container border rounded-3"
            role="button"
        >
            <span
                class="close-btn"
                onclick={() => {
                    customCategoricalPalette.splice(i, 1);
                    customCategoricalPalette = customCategoricalPalette;
                    _onChangeDebounced();
                }}>✕</span
            >
            <div
                class="border border border-primary rounded-1 color-preview"
                style={`background-color: ${color};`}
                onclick={(e: MouseEvent) => {
                    colorPickers[i]!.open();
                }}
            >
                <ColorPicker
                    bind:this={colorPickers[i]}
                    value={color as Color}
                    onChange={(c: string) => {
                        customCategoricalPalette[i] = c;
                        _onChangeDebounced();
                    }}
                />
            </div>
            <span> {color} </span>
            <span> {findMatchedValues(color) ?? ""}</span>
        </div>
    {/each}
    <div
        class="add-color d-flex align-items-center"
        role="button"
        onclick={() => {
            customCategoricalPalette.push("#aaaaaa");
            customCategoricalPalette = customCategoricalPalette;
            _onChangeDebounced();
        }}
    >
        <Icon width="3rem" height="3rem" fillColor="none" svg={addIcon} />
    </div>
</div>

<style>
    .color-preview {
        width: 5rem;
        height: 5rem;
    }
    .add-color {
        height: 10rem;
    }
    .custom-palette-menu {
        height: max-content;
        padding-bottom: 300px;
    }
    .color-container {
        height: max-content;
    }
    .close-btn {
        position: absolute;
        top: 3px;
        right: 5px;
        color: #808080;
    }
</style>
