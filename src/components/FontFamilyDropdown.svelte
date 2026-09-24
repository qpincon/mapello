<script lang="ts">
    import { onMount } from "svelte";

    interface Props {
        /** Current font name; "" = none/default. */
        value: string;
        /** Fonts added by the user (e.g. commonState.providedFonts names). Listed first. */
        availableFonts?: string[];
        /** Extra fonts appended after the system font list (e.g. Quill's generic families). */
        extraFonts?: string[];
        /** CSS font stack used to render the trigger button's label; defaults to `value`. */
        buttonFont?: string;
        /** Trigger text when value is empty. */
        placeholder?: string;
        /** Tighter styling, for use inside the Quill toolbar. */
        compact?: boolean;
        /** Prevent the trigger/items from stealing focus on mousedown (needed inside Quill so the
         *  text selection survives the click). */
        preserveFocus?: boolean;
        onSelect: (name: string) => void;
        onOpenFontPicker?: () => void;
    }

    let {
        value, availableFonts = [], extraFonts = [], buttonFont, placeholder = "—",
        compact = false, preserveFocus = false, onSelect, onOpenFontPicker,
    }: Props = $props();

    const SYSTEM_FONTS = [
        "Arial", "Verdana", "Helvetica", "Tahoma", "Trebuchet MS",
        "Georgia", "Palatino Linotype", "Times New Roman", "Courier New", "Impact",
    ];

    const allFonts = $derived([
        ...availableFonts.filter((f) => !SYSTEM_FONTS.includes(f)),
        ...SYSTEM_FONTS,
        ...extraFonts,
    ]);

    let open = $state(false);
    let dropEl: HTMLDivElement | null = $state(null);

    function preventFocusSteal(e: MouseEvent) {
        if (preserveFocus) e.preventDefault();
    }

    function select(name: string) {
        open = false;
        onSelect(name);
    }

    // Activate on Enter/Space, mirroring native <button> behavior — needed because the trigger
    // and items are plain divs (see note on the markup below for why).
    function onKeydownActivate(e: KeyboardEvent, action: () => void) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            action();
        }
    }

    onMount(() => {
        function handleDocMousedown(e: MouseEvent) {
            const t = e.target as Node;
            if (open && !dropEl?.contains(t)) open = false;
        }
        document.addEventListener("mousedown", handleDocMousedown);
        return () => document.removeEventListener("mousedown", handleDocMousedown);
    });
</script>

<!--
    Trigger and items are plain divs (role="button"), not <button> elements: when this dropdown
    is compact (used inside the Quill toolbar), it sits inside .ql-toolbar.ql-snow, and Quill's
    own stylesheet has a bare `.ql-snow .ql-toolbar button { background:none; width:28px; ... }`
    reset that outranks Bootstrap's .dropdown-item/.btn rules by specificity — most visibly, it
    wins the background-color fight against `.dropdown-item.active`, leaving the active item's
    (Bootstrap-white) text invisible against a see-through background until :hover repaints it.
    Avoiding the <button> tag sidesteps that element selector entirely.
-->
<div class="dropdown" class:flex-grow-1={!compact} class:font-family-dropdown-compact={compact} bind:this={dropEl}>
    <div role="button" tabindex="0" class="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center gap-1 text-start"
        style="font-family:{buttonFont ?? value ?? 'inherit'}"
        onmousedown={preventFocusSteal}
        onclick={() => (open = !open)}
        onkeydown={(e) => onKeydownActivate(e, () => (open = !open))}>
        <span class="flex-grow-1" style="font-size:12px">{value || placeholder}</span>
        <span class="text-muted" style="font-size:10px">▾</span>
    </div>
    {#if open}
        <ul class="dropdown-menu show w-100 overflow-y-auto py-1" style="max-height:280px">
            {#if onOpenFontPicker}
                <li><div role="button" tabindex="0" class="dropdown-item small fw-medium text-teal"
                    onmousedown={preventFocusSteal}
                    onclick={() => { open = false; onOpenFontPicker?.(); }}
                    onkeydown={(e) => onKeydownActivate(e, () => { open = false; onOpenFontPicker?.(); })}>More fonts…</div></li>
                <li><hr class="dropdown-divider my-1"></li>
            {/if}
            {#each allFonts as font}
                <li><div role="button" tabindex="0" class="dropdown-item small"
                    class:active={value === font}
                    style="font-family:'{font}'"
                    onmousedown={preventFocusSteal}
                    onclick={() => select(font)}
                    onkeydown={(e) => onKeydownActivate(e, () => select(font))}>{font}</div></li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .font-family-dropdown-compact {
        min-width: 120px;
    }
</style>
