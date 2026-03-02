<script lang="ts">
    import type { Options } from "vanilla-picker";
    import ColorPicker from "./ColorPicker.svelte";
    import type { Color } from "src/types";

    interface Props {
        value: Color;
        title: string;
        id: string;
        onChange: (newCol: Color) => void;
        additionalClasses?: string;
        labelAbove?: boolean;
        popup: Options["popup"];
    }

    let { value, title, id, onChange, additionalClasses, labelAbove, popup }: Props = $props();
    let colorPicker: ColorPicker | null = $state(null);

    function trimAlpha(v: Color): string {
        return v?.length === 9 && v.endsWith("ff") ? v.slice(0, 7) : (v ?? "");
    }

    let displayValue = $state(trimAlpha(value));
    $effect(() => {
        displayValue = trimAlpha(value);
    });

    function _onChange(color: Color): void {
        onChange(color);
    }
</script>

<div class="{labelAbove ? 'd-flex flex-column justify-content-center' : 'row'} input-type {additionalClasses}">
    <label for={id} class="col-form-label col-4 {labelAbove ? 'p-0' : ''}">
        {title}
    </label>
    <div class="d-flex align-items-center col">
        <div
            class="color-preview border border-primary rounded-1"
            onclick={() => {
                colorPicker!.open();
            }}
            style="background-color: {displayValue};"
        >
            <ColorPicker
                bind:this={colorPicker}
                {value}
                onChange={(color: Color) => {
                    const reallyChanged = value !== color && color !== value + "ff";
                    value = color;
                    if (reallyChanged) _onChange(color);
                }}
                options={{ popup }}
            />
        </div>
        <input
            type="text"
            class="ms-2 form-control"
            {id}
            bind:value={displayValue}
            onchange={(e: Event) => onChange((e.target as HTMLInputElement).value as Color)}
        />
    </div>
</div>

<style>
    input {
        max-width: 8rem;
    }
</style>
