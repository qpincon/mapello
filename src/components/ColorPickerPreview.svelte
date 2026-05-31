<script lang="ts">
    import StyleColorPicker from "./StyleColorPicker.svelte";
    import type { Color } from "src/types";

    interface Props {
        value: Color;
        title: string;
        id: string;
        onChange: (newCol: Color) => void;
        additionalClasses?: string;
        labelAbove?: boolean;
        popup?: string; // kept for API compat — ignored (StyleColorPicker uses fixed positioning)
    }

    let { value, title, id, onChange, additionalClasses = "", labelAbove = false }: Props = $props();

    // Display the color as a short hex string (strip opaque alpha suffix)
    function toDisplay(v: Color): string {
        if (!v || v === "none") return "";
        const s = String(v);
        if (s.length === 9 && s.toLowerCase().endsWith("ff")) return s.slice(0, 7);
        if (s.startsWith("rgba")) {
            const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (m) return "#" + [m[1], m[2], m[3]].map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
        }
        return s;
    }

    let displayValue = $state(toDisplay(value));
    $effect(() => { displayValue = toDisplay(value); });
</script>

<div class="{labelAbove ? 'd-flex flex-column justify-content-center' : 'row'} input-type {additionalClasses}">
    <label for={id} class="col-form-label {labelAbove ? 'p-0' : 'col-4'}">{title}</label>
    <div class="d-flex align-items-center {labelAbove ? '' : 'col'}">
        <StyleColorPicker value={String(value)} onChange={(col) => onChange(col as Color)} />
        <input
            type="text"
            class="ms-2 form-control"
            {id}
            value={displayValue}
            onchange={(e) => onChange((e.target as HTMLInputElement).value as Color)}
        />
    </div>
</div>

<style>
    input { max-width: 8rem; }
</style>
