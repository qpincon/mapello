<script lang="ts">
    import type { Color } from "src/types";

    interface Props {
        svg: string;
        fillColor?: Color;
        strokeColor?: Color;
        width?: string;
        height?: string;
        marginRight?: string;
        className?: string;
    }

    let {
        svg,
        fillColor = "currentColor",
        strokeColor = "currentColor",
        width = "1.4rem",
        height = width,
        marginRight = "5px",
        className = "",
    }: Props = $props();

    function constructSvg(svg: string, fillColor: Color, strokeColor: Color, width: string, height: string) {
        const styleStr = `style="width: ${width}; height: ${height}; fill: ${fillColor}; stroke: ${strokeColor}; margin-right: ${marginRight};"`;
        return `${svg.slice(0, 4)} ${styleStr} class="${className}" ${svg.slice(4)}`;
    }
    let constructedSvg: string = $derived(constructSvg(svg, fillColor, strokeColor, width, height));
</script>

{@html constructedSvg}
