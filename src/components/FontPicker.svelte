<script lang="ts">
    import type { ProvidedFont } from "../types";
    import Modal from "./Modal.svelte";
    import Icon from "./Icon.svelte";
    import { icons } from "../shared/icons";

    interface Props {
        onFontSelected: (font: ProvidedFont) => void;
        existingFontNames: string[];
    }

    let { onFontSelected, existingFontNames }: Props = $props();

    let showModal = $state(false);
    let searchQuery = $state("");
    let selectedCategory = $state("all");
    let catalog: Record<string, any> | null = $state(null);
    let selectedWeights: Record<string, number> = $state({});
    let loading = $state(false);
    let error: string | null = $state(null);

    // Virtual scroll state
    const ROW_HEIGHT = 64;
    const OVERSCAN = 5;
    let scrollTop = $state(0);
    let containerEl: HTMLDivElement | undefined = $state();

    // Track loaded preview font CSS
    const loadedPreviewFonts = new Set<string>();

    const categories = [
        { id: "all", label: "All" },
        { id: "sans-serif", label: "Sans Serif" },
        { id: "serif", label: "Serif" },
        { id: "display", label: "Display" },
        { id: "handwriting", label: "Handwriting" },
        { id: "monospace", label: "Monospace" },
    ];

    let filteredFonts = $derived.by(() => {
        if (!catalog) return [];
        let fonts = Object.entries(catalog);
        if (selectedCategory !== "all") {
            fonts = fonts.filter(([_, data]) => data.category === selectedCategory);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            fonts = fonts.filter(([_, data]) => data.familyName.toLowerCase().includes(q));
        }
        return fonts;
    });

    // Virtual scroll derived values
    const CONTAINER_HEIGHT = 400;

    let visibleRange = $derived.by(() => {
        const totalCount = filteredFonts.length;
        const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
        const visibleCount = Math.ceil(CONTAINER_HEIGHT / ROW_HEIGHT) + 2 * OVERSCAN;
        const endIndex = Math.min(totalCount, startIndex + visibleCount);
        return { startIndex, endIndex };
    });

    let visibleFonts = $derived(filteredFonts.slice(visibleRange.startIndex, visibleRange.endIndex));
    let topSpacer = $derived(visibleRange.startIndex * ROW_HEIGHT);
    let bottomSpacer = $derived((filteredFonts.length - visibleRange.endIndex) * ROW_HEIGHT);

    // Reset scroll when filters change
    $effect(() => {
        // Access reactive deps
        searchQuery;
        selectedCategory;
        if (containerEl) {
            containerEl.scrollTop = 0;
            scrollTop = 0;
        }
    });

    // Load font CSS for visible fonts
    $effect(() => {
        for (const [slug, data] of visibleFonts) {
            const weight = getWeightForFont(slug, data);
            ensureFontLoaded(slug, weight);
        }
    });

    function ensureFontLoaded(slug: string, weight: number): void {
        const key = `${slug}:${weight}`;
        if (loadedPreviewFonts.has(key)) return;
        loadedPreviewFonts.add(key);
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `https://fonts.bunny.net/css?family=${slug}:${weight}`;
        link.dataset.fontPickerPreview = "";
        document.head.appendChild(link);
    }

    function cleanupPreviewFonts(): void {
        document.querySelectorAll("link[data-font-picker-preview]").forEach((el) => el.remove());
        loadedPreviewFonts.clear();
    }

    async function fetchCatalog(): Promise<void> {
        if (catalog) return;
        loading = true;
        error = null;
        try {
            const res = await fetch("https://fonts.bunny.net/list");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            catalog = await res.json();
        } catch (e: any) {
            error = e.message || "Failed to load font catalog";
        } finally {
            loading = false;
        }
    }

    function openPicker(): void {
        showModal = true;
        fetchCatalog();
    }

    function closePicker(): void {
        showModal = false;
        cleanupPreviewFonts();
    }

    function getWeightForFont(slug: string, data: any): number {
        if (selectedWeights[slug] !== undefined) return selectedWeights[slug];
        const weights: number[] = data.weights ?? [];
        return weights.includes(400) ? 400 : (weights[0] ?? 400);
    }

    function addFont(slug: string, data: any): void {
        const familyName: string = data.familyName;
        if (existingFontNames.includes(familyName)) return;

        const weight = getWeightForFont(slug, data);
        const weights: number[] = data.weights ?? [];
        if (weights.length > 0 && !weights.includes(weight)) return;

        const defSubset = data.defSubset || "latin";
        const font: ProvidedFont = {
            name: familyName,
            slug,
            weight,
            style: "normal",
            defSubset,
        };
        onFontSelected(font);
    }

    function isAlreadyAdded(familyName: string): boolean {
        return existingFontNames.includes(familyName);
    }

    function onScroll(e: Event): void {
        scrollTop = (e.currentTarget as HTMLDivElement).scrollTop;
    }
</script>

<button class="navbar-btn" onclick={openPicker}>
    <Icon svg={icons["font"]} /> Add font
</button>

<Modal open={showModal} onClosed={closePicker} modalWidth="600px">
    <div slot="header">
        <h2 class="fs-4 p-2 m-0">Font picker</h2>
    </div>
    <div slot="content">
        {#if loading}
            <div class="text-center py-4">Loading font catalog...</div>
        {:else if error}
            <div class="text-danger py-4">Error: {error}</div>
        {:else}
            <input
                type="text"
                class="form-control form-control-sm mb-2"
                placeholder="Search fonts..."
                bind:value={searchQuery}
            />
            <div class="d-flex flex-wrap gap-1 mb-2">
                {#each categories as cat (cat.id)}
                    <button
                        class="btn btn-sm"
                        class:btn-primary={selectedCategory === cat.id}
                        class:btn-outline-secondary={selectedCategory !== cat.id}
                        onclick={() => (selectedCategory = cat.id)}
                    >
                        {cat.label}
                    </button>
                {/each}
            </div>
            <span class="text-muted small mb-2">{filteredFonts.length} fonts</span>
            <div
                class="font-list"
                style="height: {CONTAINER_HEIGHT}px; overflow-y: auto;"
                bind:this={containerEl}
                onscroll={onScroll}
            >
                <div style="height: {topSpacer}px"></div>
                {#each visibleFonts as [slug, data] (slug)}
                    {@const added = isAlreadyAdded(data.familyName)}
                    {@const fontWeights = data.weights ?? []}
                    {@const currentWeight = getWeightForFont(slug, data)}
                    <div
                        class="d-flex align-items-center justify-content-between px-2 border-bottom"
                        style="height: {ROW_HEIGHT}px;"
                    >
                        <div>
                            <div>
                                <span class="fw-medium">{data.familyName}</span>
                                <span class="text-muted small ms-1">({data.category})</span>
                            </div>
                            <div
                                class="text-muted text-truncate"
                                style="font-family: '{data.familyName}'; font-weight: {currentWeight}; font-size: 20px;"
                            >
                                The quick brown fox
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-1 flex-shrink-0">
                            {#if fontWeights.length > 1}
                                <select
                                    class="form-select form-select-sm"
                                    style="width: 80px;"
                                    value={currentWeight}
                                    onchange={(e) => {
                                        selectedWeights[slug] = Number(e.currentTarget.value);
                                    }}
                                    disabled={added}
                                >
                                    {#each fontWeights as w (w)}
                                        <option value={w}>{w}</option>
                                    {/each}
                                </select>
                            {/if}
                            <button
                                class="btn btn-sm"
                                class:btn-outline-primary={!added}
                                class:btn-secondary={added}
                                disabled={added}
                                onclick={() => addFont(slug, data)}
                            >
                                {added ? "Added" : "Add"}
                            </button>
                        </div>
                    </div>
                {/each}
                <div style="height: {bottomSpacer}px"></div>
                {#if filteredFonts.length === 0 && catalog}
                    <div class="text-muted text-center py-3">No fonts found matching your criteria</div>
                {/if}
            </div>
        {/if}
    </div>
</Modal>
