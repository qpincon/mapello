<script lang="ts">
    import { createEventDispatcher } from "svelte";

    import RangeInput from "./RangeInput.svelte";
    import type { LegendDef } from "src/types";
    const dispatch = createEventDispatcher();

    interface Props {
        definition: LegendDef;
        categorical?: boolean;
        noDataActive?: boolean;
    }

    let { definition = $bindable(), categorical = false, noDataActive = false }: Props = $props();

    // dispatch event on each change
    function sendChange(e: Event) {
        const id = (e.target as HTMLElement).getAttribute("id");
        if (id === "vhSwitchV") {
            definition.rectHeight = 30;
            definition.rectWidth = 30;
        } else if (id === "vhSwitchH" && !categorical) {
            definition.rectHeight = 20;
            definition.rectWidth = 70;
        }
        dispatch("change", {});
    }
</script>

<form onchange={sendChange} class="m-2 mt-3">
    <div class="d-flex align-items-center">
        <div class="btn-group" role="group">
            <input
                type="radio"
                class="btn-check"
                name="vhSwitchGroup"
                id="vhSwitchH"
                bind:group={definition.direction}
                value="h"
                autocomplete="off"
            />
            <label class="btn btn-outline-primary" for="vhSwitchH">Horizontal</label>
            <input
                type="radio"
                class="btn-check"
                name="vhSwitchGroup"
                id="vhSwitchV"
                autocomplete="off"
                bind:group={definition.direction}
                value="v"
            />
            <label class="btn btn-outline-primary" for="vhSwitchV">Vertical</label>
        </div>
        {#if categorical || definition.direction === "v"}
            <div class="mx-2 form-check">
                <input
                    type="checkbox"
                    class="form-check-input"
                    id="labelOnLeft"
                    bind:checked={definition.labelOnLeft}
                />
                <label for="labelOnLeft" class="form-check-label"> Label on left </label>
            </div>
        {/if}
    </div>
    <div class="mt-2">
        {#if definition.direction === "h" && categorical}
            <RangeInput
                id="maxWidth"
                title="Max legend width"
                bind:value={definition.maxWidth}
                min={50}
                max={800}
                step={10}
            />
        {/if}
        {#if !categorical}
            <RangeInput
                id="significantDigits"
                title="Significant digits"
                bind:value={definition.significantDigits!}
                min={0}
                max={10}
                step={1}
            />
        {/if}
        <RangeInput
            id="rectWidth"
            title="Legend color width"
            bind:value={definition.rectWidth}
            min={10}
            max={100}
            step={1}
        />
        <RangeInput
            id="rectHeight"
            title="Legend color height"
            bind:value={definition.rectHeight}
            min={10}
            max={100}
            step={1}
        />
    </div>
    {#if noDataActive}
        <div class="form-check form-switch">
            <input
                type="checkbox"
                role="switch"
                class="form-check-input"
                id="noDataInLegend"
                bind:checked={definition.noDataInLegend}
            />
            <label for="noDataInLegend" class="form-check-label">No data in legend</label>
        </div>
        {#if definition.noDataInLegend}
            <div class="form-floating">
                <input
                    type="text"
                    class="form-control"
                    id="nodatatext"
                    placeholder="N/A"
                    bind:value={definition.noDataText}
                />
                <label for="nodatatext">No data text</label>
            </div>
        {/if}
    {/if}
</form>
