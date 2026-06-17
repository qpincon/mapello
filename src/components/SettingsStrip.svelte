<script lang="ts">
    import { commonState, macroState, microState } from '../state.svelte';
    import RangeInput from './RangeInput.svelte';
    import ColorPickerPreview from './ColorPickerPreview.svelte';
    import { paramDefs, type RangeDefinition, type SelectDefinition } from '../params';
    import { handleChangeProp } from '../macro/drawing';

    interface Props {
        draw: (simplified?: boolean) => void;
    }
    let { draw }: Props = $props();

    let open = $state(false);
    let panelTop = $state(0);
    let panelLeft = $state(0);
    const PANEL_WIDTH = 310;

    let isSatellite = $derived(macroState.macroParams.General.projection === 'satellite');

    let drawTimeoutId = 0;
    function drawSimplifyThenReal() {
        draw(true);
        clearTimeout(drawTimeoutId);
        drawTimeoutId = window.setTimeout(() => draw(false), 500);
    }

    function onMacroChange(prop: string) {
        handleChangeProp(prop, drawSimplifyThenReal);
    }

    function toggle(e: MouseEvent) {
        e.stopPropagation();
        if (!open) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            panelTop = rect.bottom + 4;
            const left = rect.left;
            panelLeft = Math.min(left, window.innerWidth - PANEL_WIDTH - 8);
        }
        open = !open;
    }

    function closePanel() { open = false; }

    const r = (key: string) => paramDefs[key] as RangeDefinition;
    const s = (key: string) => paramDefs[key] as SelectDefinition;
</script>

<svelte:document onclick={closePanel} />

<button class="navbar-btn" onclick={toggle}>
    Map settings
    <svg class="chevron" class:open width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
</button>

{#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="settings-panel"
        style="top: {panelTop}px; left: {panelLeft}px; width: {PANEL_WIDTH}px;"
        onclick={(e) => e.stopPropagation()}
        onkeydown={() => {}}
        role="dialog"
    >
        {#if commonState.currentMode === 'macro'}

            <p class="section-label">Canvas</p>
            <div class="section-card">
                <div class="field">
                    <RangeInput id="sp-width" title="Width"
                        bind:value={macroState.macroParams.General.width}
                        min={r('width').min} max={r('width').max} step={r('width').step ?? 1}
                        onChange={() => onMacroChange('width')} />
                </div>
                <div class="field">
                    <RangeInput id="sp-height" title="Height"
                        bind:value={macroState.macroParams.General.height}
                        min={r('height').min} max={r('height').max} step={r('height').step ?? 1}
                        onChange={() => onMacroChange('height')} />
                </div>
                <div class="field row align-items-center">
                    <label class="col-4 col-form-label" for="sp-projection">Projection</label>
                    <select id="sp-projection" class="form-select form-select-sm col"
                        bind:value={macroState.macroParams.General.projection}
                        onchange={() => onMacroChange('projection')}>
                        {#each s('projection').choices as opt}
                            <option value={opt}>{opt}</option>
                        {/each}
                    </select>
                </div>
                {#if isSatellite}
                    <div class="field">
                        <RangeInput id="sp-fov" title="Field of view"
                            bind:value={macroState.macroParams.General.fieldOfView}
                            min={r('fieldOfView').min} max={r('fieldOfView').max} step={r('fieldOfView').step ?? 1}
                            onChange={() => onMacroChange('fieldOfView')} />
                    </div>
                {/if}
                <div class="field">
                    <RangeInput id="sp-altitude" title={isSatellite ? 'Altitude' : 'Scale'}
                        bind:value={macroState.macroParams.General.altitude}
                        min={r('altitude').min} max={r('altitude').max} step={r('altitude').step ?? 1}
                        onChange={() => onMacroChange('altitude')} />
                </div>
            </div>

            <p class="section-label">Border</p>
            <div class="section-card">
                <div class="field">
                    <RangeInput id="sp-bdr" title="Radius"
                        bind:value={macroState.macroParams.Border.borderRadius}
                        min={r('borderRadius').min} max={r('borderRadius').max} step={r('borderRadius').step ?? 1}
                        onChange={() => onMacroChange('borderRadius')} />
                </div>
                <div class="field">
                    <RangeInput id="sp-bw" title="Width"
                        bind:value={macroState.macroParams.Border.borderWidth}
                        min={r('borderWidth').min} max={r('borderWidth').max} step={r('borderWidth').step ?? 1}
                        onChange={() => onMacroChange('borderWidth')} />
                </div>
                <div class="field">
                    <ColorPickerPreview id="sp-bc" title="Color"
                        value={macroState.macroParams.Border.borderColor}
                        onChange={(c) => { macroState.macroParams.Border.borderColor = c; drawSimplifyThenReal(); }} />
                </div>
            </div>

            <p class="section-label">Background</p>
            <div class="section-card">
                <div class="field">
                    <ColorPickerPreview id="sp-sea" title="Sea color"
                        value={macroState.macroParams.Background.seaColor}
                        onChange={(c) => { macroState.macroParams.Background.seaColor = c; drawSimplifyThenReal(); }} />
                </div>
                <div class="field form-check form-switch ps-0 d-flex align-items-center justify-content-between">
                    <label class="form-check-label" for="sp-grat">Graticule</label>
                    <input class="form-check-input" type="checkbox" role="switch" id="sp-grat"
                        bind:checked={macroState.macroParams.Background.showGraticule}
                        onchange={() => drawSimplifyThenReal()} />
                </div>
                {#if macroState.macroParams.Background.showGraticule}
                    <div class="field">
                        <RangeInput id="sp-gstep" title="Step"
                            bind:value={macroState.macroParams.Background.graticuleStep}
                            min={r('graticuleStep').min} max={r('graticuleStep').max} step={r('graticuleStep').step ?? 1}
                            onChange={() => drawSimplifyThenReal()} />
                    </div>
                    <div class="field">
                        <ColorPickerPreview id="sp-gcol" title="Color"
                            value={macroState.macroParams.Background.graticuleColor}
                            onChange={(c) => { macroState.macroParams.Background.graticuleColor = c; drawSimplifyThenReal(); }} />
                    </div>
                    <div class="field">
                        <RangeInput id="sp-gw" title="Width"
                            bind:value={macroState.macroParams.Background.graticuleWidth}
                            min={r('graticuleWidth').min} max={r('graticuleWidth').max} step={r('graticuleWidth').step ?? 1}
                            onChange={() => drawSimplifyThenReal()} />
                    </div>
                {/if}
            </div>

        {:else}

            <p class="section-label">Canvas</p>
            <div class="section-card">
                <div class="field">
                    <RangeInput id="sp-mw" title="Width"
                        bind:value={microState.microParams.General.width}
                        min={r('width').min} max={r('width').max} step={r('width').step ?? 1}
                        onChange={() => draw()} />
                </div>
                <div class="field">
                    <RangeInput id="sp-mh" title="Height"
                        bind:value={microState.microParams.General.height}
                        min={r('height').min} max={r('height').max} step={r('height').step ?? 1}
                        onChange={() => draw()} />
                </div>
            </div>

            <p class="section-label">Border</p>
            <div class="section-card">
                <div class="field">
                    <RangeInput id="sp-mbdr" title="Radius"
                        bind:value={microState.microParams.Border.borderRadius}
                        min={r('borderRadius').min} max={r('borderRadius').max} step={r('borderRadius').step ?? 1}
                        onChange={() => draw()} />
                </div>
                <div class="field">
                    <RangeInput id="sp-mpad" title="Padding"
                        bind:value={microState.microParams.Border.borderPadding}
                        min={r('borderPadding').min} max={r('borderPadding').max} step={r('borderPadding').step ?? 1}
                        onChange={() => draw()} />
                </div>
                <div class="field">
                    <RangeInput id="sp-mbw" title="Width"
                        bind:value={microState.microParams.Border.borderWidth}
                        min={r('borderWidth').min} max={r('borderWidth').max} step={r('borderWidth').step ?? 1}
                        onChange={() => draw()} />
                </div>
                <div class="field">
                    <ColorPickerPreview id="sp-mbc" title="Color"
                        value={microState.microParams.Border.borderColor}
                        onChange={(c) => { microState.microParams.Border.borderColor = c; draw(); }} />
                </div>
            </div>

        {/if}
    </div>
{/if}

<style lang="scss">
.chevron {
    opacity: 0.5;
    transition: transform 0.15s;
    &.open { transform: rotate(180deg); }
}

.settings-panel {
    position: fixed;
    z-index: 1050;
    background: white;
    border: 1px solid #c8d4e3;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.14);
    padding: 10px 12px;
    max-height: 70vh;
    overflow-y: auto;
}

.section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #5a7a9a;
    margin: 14px 0 5px;
    padding-left: 8px;
    border-left: 3px solid #4a7fa5;

    &:first-child { margin-top: 2px; }
}

.section-card {
    background: #f4f7fa;
    border-radius: 6px;
    padding: 6px 8px 2px;
}

.field {
    margin-bottom: 4px;
}
</style>
