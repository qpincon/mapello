<script lang="ts">
    import Picker, { type Options, type Color as ColorInternal } from "vanilla-picker";

    import { onMount, onDestroy } from "svelte";
    import type { Color } from "src/types";

    interface ExtendedPicker extends Picker {
        __originalOpenHandler?: () => void;
        openHandler: () => void;
    }

    interface Props {
        value: Color;
        options?: Options;
        onChange: (newColor: Color, oldColor?: Color) => void;
    }

    let { value, options = {}, onChange }: Props = $props();

    let self: HTMLElement | null = $state(null);
    let pickerElem: ExtendedPicker | null = $state(null);
    let isInternalChange = false;

    $effect(() => {
        if (!pickerElem && self) {
            options.onChange = (col) => {
                setValue(col.hex as Color);
            };
            pickerElem = new Picker({
                parent: self,
                color: value,
                ...options,
            }) as ExtendedPicker;
            pickerElem.__originalOpenHandler = pickerElem.openHandler;
            pickerElem.openHandler = function () {
                _onOpen();
                this.__originalOpenHandler?.();
            };
        }
    });

    $effect(() => {
        if (pickerElem && value.length && isHexColor(value) && !isInternalChange) {
            pickerElem.setColor(value, true);
        }
    });

    export function setColor(hexString: Color): void {
        if (!isHexColor(hexString)) return;
        if (pickerElem) pickerElem.setColor(hexString, true);
    }

    export function open(): void {
        if (pickerElem) {
            pickerElem.show();
            pickerElem.openHandler();
        }
    }

    function isHexColor(hex: Color): boolean {
        const raw = typeof hex === "string" && hex.startsWith('#') ? hex.slice(1) : hex;
        return typeof raw === "string" && (raw.length === 8 || raw.length === 6) && !isNaN(Number("0x" + raw));
    }

    function setValue(val: Color): void {
        if (val === value) return;
        isInternalChange = true;
        onChange(val, value);
        value = val;
        queueMicrotask(() => { isInternalChange = false; });
    }

    onDestroy(() => {
        if (pickerElem) {
            pickerElem.destroy();
        }
    });

    function _onOpen(): void {
        // Handler for when picker opens
    }
</script>

<div bind:this={self} style="position: absolute;"></div>
