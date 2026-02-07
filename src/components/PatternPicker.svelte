<script lang="ts">
    import { onMount } from "svelte";
    import { HatchPatternGenerator, patternGenerator } from "../svg/patternGenerator";

    interface Props {
        hatch: string;
        onChange: (hatch: string) => void;
    }

    let { hatch, onChange }: Props = $props();

    const PATTERNS = HatchPatternGenerator.PATTERNS;
    const PREVIEW_COLOR = "#506784";

    let defsEl: SVGDefsElement;
    let open = $state(false);
    let dropdownEl: HTMLDivElement;

    onMount(() => {
        for (const p of PATTERNS) {
            const id = `preview-${p.id}`;
            const patternEl = patternGenerator.updateOrCreatePattern({
                hatch: p.char,
                id,
                color: PREVIEW_COLOR,
                strokeWidth: 2,
                scale: 1,
            });
            defsEl.appendChild(patternEl);
        }

        function handleClickOutside(e: MouseEvent) {
            if (open && dropdownEl && !dropdownEl.contains(e.target as Node)) {
                open = false;
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    });

    function isActive(char: string): boolean {
        return hatch.includes(char);
    }

    function toggle(char: string) {
        let newHatch: string;
        if (hatch.includes(char)) {
            newHatch = hatch.split("").filter((c) => c !== char).join("");
        } else {
            newHatch = hatch + char;
        }
        onChange(newHatch);
    }

    let summary = $derived(
        PATTERNS.filter((p) => hatch.includes(p.char))
            .map((p) => p.label)
            .join(", ") || "None",
    );
</script>

<div class="pattern-picker mx-2" bind:this={dropdownEl}>
    <label class="form-label mb-1">Pattern</label>
    <svg width="0" height="0" style="position:absolute">
        <defs bind:this={defsEl}></defs>
    </svg>
    <button
        type="button"
        class="dropdown-trigger"
        onclick={() => (open = !open)}
    >
        {summary}
    </button>
    {#if open}
        <div class="dropdown-panel">
            {#each PATTERNS as p}
                <button
                    type="button"
                    class="dropdown-option"
                    class:active={isActive(p.char)}
                    onclick={() => toggle(p.char)}
                >
                    <svg width="20" height="20" viewBox="0 0 20 20">
                        <rect
                            width="20"
                            height="20"
                            rx="2"
                            fill="url(#preview-{p.id})"
                            stroke="none"
                        />
                    </svg>
                    <span>{p.label}</span>
                </button>
            {/each}
        </div>
    {/if}
</div>

<style lang="scss">
    .pattern-picker {
        flex: 1 0 100%;
        position: relative;
    }

    .dropdown-trigger {
        display: block;
        width: 100%;
        padding: 0.25rem 2rem 0.25rem 0.5rem;
        font-size: 0.875rem;
        font-weight: 400;
        line-height: 1.5;
        color: #212529;
        background-color: #fff;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 0.5rem center;
        background-size: 12px 9px;
        border: 1px solid #dee2e6;
        border-radius: 0.25rem;
        appearance: none;
        text-align: left;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        &:focus {
            border-color: #86b7fe;
            outline: 0;
            box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
        }
    }

    .dropdown-panel {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 1050;
        background: #fff;
        border: 1px solid #dee2e6;
        border-radius: 0.25rem;
        box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.15);
        max-height: 240px;
        overflow-y: auto;
        margin-top: 2px;
    }

    .dropdown-option {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 4px 8px;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 0.8rem;
        text-align: left;

        &:hover {
            background: #f0f6ff;
        }

        &.active {
            background: #e7f1ff;
        }

        svg {
            flex-shrink: 0;
            border-radius: 2px;
            background: #f8f9fa;
        }
    }
</style>
