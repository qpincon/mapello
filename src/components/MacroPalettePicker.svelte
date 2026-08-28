<script lang="ts">
    import { camelCaseToSentence } from "../util/common";
    import type { MacroPalette } from "src/types";

    interface Props {
        palettes: Record<string, MacroPalette>;
        currentPaletteId?: string;
        onPaletteChange?: (paletteId: string) => void;
    }

    let { palettes, currentPaletteId = "", onPaletteChange = () => {} }: Props = $props();

    let paletteOpen = $state(false);
    let paletteDropdownEl: HTMLElement | null = $state(null);

    function stripColors(p: MacroPalette): string[] {
        return [p.background.seaColor, p.land.fillColor, p.land.strokeColor, p.country.fill];
    }

    function paletteChanged(paletteId: string) {
        onPaletteChange(paletteId);
        paletteOpen = false;
    }

    function handleWindowClick(e: MouseEvent) {
        if (paletteOpen && paletteDropdownEl && !paletteDropdownEl.contains(e.target as Node)) {
            paletteOpen = false;
        }
    }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="row my-3 mx-1 align-items-center">
    <label class="col-4 col-form-label">Color palette</label>
    <div class="col position-relative palette-dropdown-wrapper" bind:this={paletteDropdownEl}>
        <button
            type="button"
            class="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center gap-2 palette-trigger"
            onclick={() => (paletteOpen = !paletteOpen)}
            aria-haspopup="listbox"
            aria-expanded={paletteOpen}
        >
            {#if currentPaletteId && palettes[currentPaletteId]}
                <span class="palette-strip">
                    {#each stripColors(palettes[currentPaletteId]) as c}
                        <span style="background-color: {c};"></span>
                    {/each}
                </span>
                <span class="palette-name">{camelCaseToSentence(currentPaletteId)}</span>
            {:else}
                <span class="palette-name text-muted">Custom</span>
            {/if}
            <span class="toggle ms-auto flex-shrink-0" class:opened={paletteOpen}></span>
        </button>
        {#if paletteOpen}
            <ul class="palette-menu list-unstyled mb-0" role="listbox">
                {#each Object.keys(palettes) as paletteId}
                    <li
                        class="palette-menu-item"
                        class:active={paletteId === currentPaletteId}
                        role="option"
                        aria-selected={paletteId === currentPaletteId}
                        onclick={() => paletteChanged(paletteId)}
                    >
                        <span class="palette-strip">
                            {#each stripColors(palettes[paletteId]) as c}
                                <span style="background-color: {c};"></span>
                            {/each}
                        </span>
                        <span>{camelCaseToSentence(paletteId)}</span>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</div>

<style lang="scss">
    .palette-trigger {
        text-align: left;
        min-height: 2.1rem;
        padding-top: 0.25rem;
        padding-bottom: 0.25rem;
    }

    .palette-strip {
        width: 2rem;
        height: 1.4rem;
        flex: 0 0 2rem;
        border-radius: 3px;
        overflow: hidden;
        display: inline-flex;

        span {
            flex: 1;
            height: 100%;
        }
    }

    .palette-menu .palette-strip {
        width: 3rem;
        height: 1.8rem;
        flex: 0 0 3rem;
    }

    .palette-name {
        flex: 1;
        text-align: left;
        font-size: 0.82rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .palette-menu {
        position: absolute;
        top: calc(100% + 3px);
        left: 0;
        right: 0;
        z-index: 1050;
        background: #fff;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 5px;
        max-height: 340px;
        overflow-y: auto;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.13);
        padding: 3px 0;
    }

    .palette-menu-item {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.4rem 0.6rem;
        cursor: pointer;
        font-size: 0.85rem;
        border-radius: 3px;
        margin: 1px 3px;

        &:hover {
            background-color: rgba(13, 110, 253, 0.08);
        }

        &.active {
            background-color: rgba(13, 110, 253, 0.13);
            font-weight: 500;
        }
    }

    .toggle {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
        background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%32dee2e6'><path fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/></svg>");
        &.opened {
            transform: rotate(180deg);
        }
    }
</style>
