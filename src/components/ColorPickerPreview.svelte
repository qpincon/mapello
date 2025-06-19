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
    let changedManually: boolean = $state(false);

    function _onChange(color: Color): void {
        onChange(color);
        changedManually = true;
    }

    // $effect(() => {
    //     if (value) {
    //         if (!changedManually && colorPicker) {
    //             setTimeout(() => {
    //                 if (colorPicker) colorPicker.init();
    //             }, 0);
    //         }
    //         changedManually = false;
    //     }
    // });
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
            style="background-color: {value};"
        >
            <ColorPicker
                bind:this={colorPicker}
                {value}
                onChange={(color: Color) => {
                    value = color;
                    _onChange(color);
                }}
                options={{ popup }}
            />
        </div>
        <input
            type="text"
            class="ms-2 form-control"
            {id}
            bind:value
            onchange={(e: Event) => onChange((e.target as HTMLInputElement).value as Color)}
        />
    </div>
</div>

<style>
    input {
        max-width: 8rem;
    }
</style>
