<script lang="ts">
    import { tapHold } from "../util/common";

    interface Props {
        value: number;
        title: string;
        min: number | string;
        max: number | string;
        step?: number | string;
        onChange?: (newVal: number) => void;
        id: string;
        helpText?: string | null;
        labelAbove?: boolean;
    }

    let { value = $bindable(), title, min, max, step = 1, onChange, id, helpText, labelAbove }: Props = $props();

    let _step: number = $derived(parseFloat(step as string));
    let _min: number = $derived(parseFloat(min as string));
    let _max: number = $derived(parseFloat(max as string));

    let slider: HTMLElement | undefined = $state();
    /** This is to enable onchange event propagation when the increment / decrement counters are clicked
     * (for when RangeInput is used in a <form> that globally listens for "onchange" )*/
    const changeEvent = new Event("change", {
        bubbles: true,
        cancelable: true,
        composed: true,
    });

    function countDecimals(val: number): number {
        if (Math.floor(val.valueOf()) === val.valueOf()) return 0;
        return val.toString().split(".")[1]?.length || 0;
    }

    let nbDecimals: number = $derived(countDecimals(_step));

    const increment = (e?: MouseEvent): void => {
        if (e) e.stopPropagation();
        if (value === null) value = _step;
        else if (value === _max) return;
        else value += _step;
        if (onChange) onChange!(value);
        slider?.dispatchEvent(changeEvent);
        console.log(value);
    };

    const decrement = (e?: MouseEvent): void => {
        if (e) e.stopPropagation();
        if (value === null) value = _min;
        else if (value === _min) return;
        else value -= _step;
        if (onChange) onChange!(value);
        slider?.dispatchEvent(changeEvent);
    };
</script>

<div
    bind:this={slider}
    class="{labelAbove ? 'd-flex flex-column justify-content-center' : 'row align-items-center'}  w-100"
>
    <label for={id} class="text-nowrap d-flex col-4 col-form-label align-items-center {labelAbove ? 'p-0' : ''}">
        <span> {title}</span>
        {#if helpText}
            <span class="help-tooltip fs-6" data-bs-toggle="tooltip" data-bs-title={helpText}>?</span>
        {/if}
    </label>

    <div class="p-0 d-flex align-items-center col">
        <input
            type="range"
            class="form-range"
            {id}
            bind:value
            min={_min}
            max={_max}
            step={_step}
            onchange={(e) => {
                console.log("slider change", e);
                if (e.target && e.target instanceof HTMLInputElement) {
                    if (onChange) onChange!(parseFloat(e.target.value));
                }
            }}
        />
        <div class="d-flex align-items-center">
            <span class="text-center d-flex text-primary mx-1 text-opacity-75 fs-6">
                {value?.toFixed(nbDecimals) ?? "0"}
            </span>
            <div class="arrows">
                <div class="numeric-input">
                    <svg
                        width="10"
                        height="10"
                        fill="currentColor"
                        viewBox="3 3 18 18"
                        use:tapHold={increment}
                        onclick={increment}><path d="M7,15L12,10L17,15H7Z" /></svg
                    >
                </div>
                <div class="numeric-input">
                    <svg
                        width="10"
                        height="10"
                        fill="currentColor"
                        viewBox="3 3 18 18"
                        use:tapHold={decrement}
                        onclick={decrement}><path d="M7,10L12,15L17,10H7Z" /></svg
                    >
                </div>
            </div>
        </div>
    </div>
</div>

<style lang="scss" scoped>
    * {
        box-sizing: content-box !important;
    }
    .arrows {
        display: inline-block;
        max-height: 25px;
        margin-left: 6px;
        margin-right: 12px;
        vertical-align: middle;
        box-sizing: border-box;
    }
    .numeric-input {
        cursor: pointer;
        background-color: #f3f6fa;
        border: 1px solid #c8d4e3;
        border-radius: 1px;
        line-height: 6px;
        text-align: center;
        max-height: 10px;
        & > svg {
            fill: #506784 !important;
        }
        &:first-child {
            margin-bottom: 2px;
        }
    }
</style>
