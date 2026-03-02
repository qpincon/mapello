<script lang="ts">
    import ColorPickerPreview from "./ColorPickerPreview.svelte";
    import PatternPicker from "./PatternPicker.svelte";
    import RangeInput from "./RangeInput.svelte";
    import { camelCaseToSentence, initTooltips, pascalCaseToSentence } from "../util/common";
    import type { Color, MicroLayerId, MicroPalette, MicroPaletteWithBorder } from "src/types";

    interface Props {
        layerDefinitions: MicroPalette;
        onUpdate?: (layer: MicroLayerId, key: string | string[], value: number | Color | string | boolean) => void;
        onPaletteChange?: (paletteId: string) => void;
        availablePalettes?: Record<string, MicroPaletteWithBorder>;
        currentPaletteId?: string;
    }

    let {
        layerDefinitions = $bindable(),
        onUpdate = () => {},
        onPaletteChange = () => {},
        availablePalettes = {},
        currentPaletteId = "",
    }: Props = $props();

    let layers: [string, any][] = $derived(
        Object.entries(layerDefinitions).filter(([layerId, _]) => layerId !== "borderParams"),
    );
    function updated(layer: MicroLayerId, key: string | string[], value: number | Color | string | boolean) {
        console.log(layer, key, value);
        onUpdate(layer, key, value);
        if (key[0] === "active") {
            layerDefinitions[layer].menuOpened = layerDefinitions[layer].active;
        }
        if (key[1] === "active") {
            layerDefinitions[layer].pattern!.menuOpened = layerDefinitions[layer].pattern!.active;
        }
        initTooltips();
    }

    function paletteChanged(paletteId: string) {
        onPaletteChange(paletteId);
    }

    function collapseLayer(layer: MicroLayerId) {
        layerDefinitions[layer].menuOpened = !layerDefinitions[layer].menuOpened;
        setTimeout(() => initTooltips(), 0);
    }

    function collapseLayerPattern(layer: MicroLayerId) {
        layerDefinitions[layer].pattern!.menuOpened = !layerDefinitions[layer].pattern!.menuOpened;
        layerDefinitions = layerDefinitions;
        setTimeout(() => initTooltips(), 0);
    }
</script>

<div class="py-2 mb-4 pe-2 border rounded-1 bg-light">
    <div class="row my-3 mx-1">
        <label class="col-4 col-form-label" for="palette-select"> Preset palette</label>
        <select
            id="palette-select"
            class="form-select form-select-sm me-4 col"
            value={currentPaletteId}
            onchange={(e) => {
                const val = (e.target as HTMLSelectElement).value;
                if (val) paletteChanged(val);
            }}
        >
            <option value="">Custom</option>
            {#each Object.keys(availablePalettes) as paletteId}
                <option value={paletteId}> {camelCaseToSentence(paletteId)} </option>
            {/each}
        </select>
    </div>

    {#each layers as [title, def], i (title)}
        <div class="d-flex align-items-center">
            <div class="mx-2 form-check form-switch">
                <input
                    type="checkbox"
                    role="switch"
                    class="form-check-input"
                    disabled={def.disabled}
                    id={title}
                    bind:checked={def.active}
                    onchange={() => updated(title as MicroLayerId, ["active"], def.active!)}
                />
                <label for={title} class="form-check-label">
                    {pascalCaseToSentence(title)}
                </label>
            </div>
            {#if def.active}
                <div
                    class="toggle"
                    class:opened={def.menuOpened === true}
                    onclick={() => collapseLayer(title as MicroLayerId)}
                ></div>
            {/if}
        </div>

        {#if def.menuOpened}
            <div class="layer-params ps-2 ms-4 border-start border-1">
                <div class="wrap-params d-flex flex-wrap">
                    {#if def.fill != null}
                        <ColorPickerPreview
                            labelAbove={true}
                            additionalClasses="mx-2 mb-1"
                            id={`${title}-def-fill`}
                            popup="right"
                            title="Fill"
                            value={def.fill}
                            onChange={(col) => {
                                def.fill = col;
                                updated(title as MicroLayerId, ["fill"], col);
                            }}
                        />
                    {/if}
                    {#if def.fills != null}
                        <div class="d-flex three-dimensions">
                            <div class="mx-2 form-check form-switch">
                                <input
                                    type="checkbox"
                                    role="switch"
                                    class="form-check-input"
                                    id="3d-buidlings"
                                    bind:checked={def["3dBuildings"]}
                                    onchange={() =>
                                        updated(title as MicroLayerId, ["3dBuildings"], def["3dBuildings"]!)}
                                />
                                <label for="3d-buidlings" class="form-check-label"> 3D building </label>
                            </div>
                            {#if def["3dBuildings"]}
                                <RangeInput
                                    labelAbove={true}
                                    title="Default height"
                                    helpText="Height in meters for buildings without height data"
                                    id={`${title}-default-building-height`}
                                    bind:value={def.defaultBuildingHeight!}
                                    min={1}
                                    max={10}
                                    step={0.5}
                                    onChange={(val) => {
                                        def.defaultBuildingHeight = val;
                                        updated(title as MicroLayerId, ["defaultBuildingHeight"], val);
                                    }}
                                />
                            {/if}
                        </div>
                        {#each def.fills as fill, fillIndex}
                            <ColorPickerPreview
                                labelAbove={true}
                                additionalClasses="mx-2 mb-1"
                                id={`${title}-def-fill-${fillIndex}`}
                                popup="right"
                                title={`Fill ${fillIndex}`}
                                value={fill}
                                onChange={(col) => {
                                    def.fills![fillIndex] = col;
                                    updated(title as MicroLayerId, ["fills", "0"], col);
                                }}
                            />
                        {/each}
                    {/if}
                    {#if def.stroke != null}
                        <ColorPickerPreview
                            labelAbove={true}
                            additionalClasses="mx-2 mb-1"
                            id={`${title}-def-stroke`}
                            popup="right"
                            title="Stroke"
                            value={def.stroke}
                            onChange={(col) => {
                                def.stroke = col;
                                updated(title as MicroLayerId, ["stroke"], col);
                            }}
                        />
                    {/if}
                </div>

                <!-- SVG PATTERN -->
                {#if def.pattern}
                    <div class="d-flex align-items-center">
                        <div class="mx-2 form-check form-switch">
                            <input
                                type="checkbox"
                                role="switch"
                                class="form-check-input"
                                id={`input-${def.pattern.id}`}
                                bind:checked={def.pattern.active}
                                onchange={() =>
                                    updated(title as MicroLayerId, ["pattern", "active"], def.pattern!.active!)}
                            />
                            <label for={`input-${def.pattern.id}`} class="form-check-label"> Pattern </label>
                        </div>
                        {#if def.pattern.active}
                            <div
                                class="toggle"
                                class:opened={def.pattern.menuOpened === true}
                                onclick={() => collapseLayerPattern(title as MicroLayerId)}
                            ></div>
                        {/if}
                    </div>
                    {#if def.pattern.menuOpened}
                        <div class="wrap-params ps-2 ms-4 border-start border-1 d-flex flex-wrap">
                            <PatternPicker
                                hatch={def.pattern.hatch ?? ""}
                                onChange={(val) => {
                                    def.pattern!.hatch = val;
                                    updated(title as MicroLayerId, ["pattern", "hatch"], val);
                                }}
                            />
                            <ColorPickerPreview
                                labelAbove={true}
                                additionalClasses="mx-2 mb-1"
                                id={`${def.pattern.id}-color`}
                                popup="right"
                                title="Color"
                                value={def.pattern.color}
                                onChange={(col) => {
                                    def.pattern!.color = col;
                                    updated(title as MicroLayerId, ["pattern", "color"], col);
                                }}
                            />
                            <RangeInput
                                labelAbove={true}
                                title="Weight"
                                id={`${def.pattern.id}-strokeWidth`}
                                bind:value={def.pattern.strokeWidth!}
                                min={0.2}
                                max={5}
                                step={0.2}
                                onChange={(val) => {
                                    def.pattern!.strokeWidth = val;
                                    updated(title as MicroLayerId, ["pattern", "strokeWidth"], val);
                                }}
                            />
                            <RangeInput
                                labelAbove={true}
                                title="Pattern density"
                                id={`${def.pattern.id}-scale`}
                                bind:value={def.pattern.scale!}
                                min={0.1}
                                max={3}
                                step={0.1}
                                onChange={(val) => {
                                    def.pattern!.scale = val;
                                    updated(title as MicroLayerId, ["pattern", "scale"], val);
                                }}
                            />
                        </div>
                    {/if}
                {/if}
            </div>
        {/if}
    {/each}
</div>

<style lang="scss">
    .toggle {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
        background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%32dee2e6'><path fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/></svg>");
        &.opened {
            transform: rotate(180deg);
        }
    }

    :global(.wrap-params > div) {
        flex: 1 0 9rem;
    }

    .three-dimensions {
        flex: 1 0 100%;
        & > div {
            flex-basis: 50%;
        }
    }
</style>
