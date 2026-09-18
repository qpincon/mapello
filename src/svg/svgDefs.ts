import { rgb} from 'd3-color';
import type {DefsSelection, SvgSelection} from '../types';
import type { GlowParams } from "src/params";
// import plaid from '../assets/img/plaid.jpg';

/** Returns the SVG filter element id for a given layer name (sanitized to be a valid XML/CSS id) */
export const glowFilterId = (layer: string) => `glow-${layer.replace(/[^a-zA-Z0-9]/g, '_')}`;

export function appendGlow(selection: SvgSelection, id = "glows", displaySource = false,
    {
        innerBlur, innerStrength, innerColor,
        outerBlur, outerStrength, outerColor,
    } : GlowParams
) {
    const colorInner = rgb(innerColor);
    const colorOuter = rgb(outerColor);
    const existing = selection.select(`#${id}`);
    if (!existing.empty()) existing.remove();
    let defs: DefsSelection = selection.select('defs');
    if (defs.empty()) defs = selection.append('defs');
    const filter = defs.append('filter').attr('id', id).attr('filterUnits', 'userSpaceOnUse');

    // OUTER GLOW
    let hasOuterGlow = false;
    if (outerStrength > 0) {
        hasOuterGlow = true;
        filter.append('feMorphology')
            .attr('in', 'SourceGraphic')
            .attr('radius', outerStrength)
            .attr('operator', 'dilate')
            .attr('result', 'MASK_OUTER');
        filter.append('feColorMatrix')
            .attr('in', 'MASK_OUTER')
            .attr('type', 'matrix')
            .attr('values', `0 0 0 0 ${colorOuter.r / 255} 0 0 0 0 ${colorOuter.g / 255} 0 0 0 0 ${colorOuter.b / 255} 0 0 0 ${colorOuter.opacity} 0`) // apply color
            .attr('result', 'OUTER_COLORED');
        filter.append('feGaussianBlur')
            .attr('in', 'OUTER_COLORED')
            .attr('stdDeviation', outerBlur)
            .attr('result', 'OUTER_BLUR');
        filter.append('feComposite')
            .attr('in', 'OUTER_BLUR')
            .attr('in2', 'SourceGraphic')
            .attr('operator', 'out')
            .attr('result', 'OUTGLOW');
    }

    // INNER GLOW
    let hasInnerGlow = false;
    if (innerStrength > 0) {
        hasInnerGlow = true;
        filter.append('feMorphology')
            .attr('in', 'SourceAlpha')
            .attr('radius', innerStrength)
            .attr('operator', 'erode')
            .attr('result', 'INNER_ERODED_A');
        filter.append('feComponentTransfer')
            .attr('in', 'INNER_ERODED_A')
            .attr('result', 'INNER_ERODED')
            .append('feFuncA')
            .attr('type', 'linear')
            .attr('slope', '1000')
            .attr('intercept', '0');
    
        filter.append('feGaussianBlur')
            .attr('in', 'INNER_ERODED')
            .attr('stdDeviation', innerBlur)
            .attr('result', 'INNER_BLURRED');
    
        filter.append('feColorMatrix')
            .attr('in', 'INNER_BLURRED')
            .attr('type', 'matrix')
            .attr('values', `0 0 0 0 ${colorInner.r / 255} 0 0 0 0 ${colorInner.g / 255} 0 0 0 0 ${colorInner.b / 255} 0 0 0 -1 ${colorInner.opacity}`) // inverse color
            .attr('result', 'INNER_COLOR');
    
        filter.append('feComposite')
            .attr('in', 'INNER_COLOR')
            .attr('in2', 'SourceGraphic')
            .attr('operator', 'in')
            .attr('result', 'INGLOW');
    }

    // Merge
    const merge = filter.append('feMerge');
    if (hasOuterGlow) merge.append('feMergeNode').attr('in', 'OUTGLOW');
    if (displaySource) merge.append('feMergeNode').attr('in', 'SourceGraphic');
    if (hasInnerGlow) merge.append('feMergeNode').attr('in', 'INGLOW');
}


export function appendClip(selection: SvgSelection, width: number, height: number, rx: number, x: number, y: number) {
    let defs:DefsSelection = selection.select('defs');
    if (defs.empty()) defs = selection.append('defs') ;
    const existing = selection.select('#clipMapBorder');
    if (!existing.empty()) existing.remove();
    const clip = defs.append('clipPath')
        .attr('id', "clipMapBorder")
        .attr('clipPathUnits', 'userSpaceOnUse');

    clip.append('rect')
        .attr('width', width)
        .attr('height', height)
        .attr('rx', rx)
        .attr('x', x)
        .attr('y', y);
}

/**
 * True when the projected `{type: "Sphere"}` outline has degenerated to a plain axis-aligned
 * rectangle — i.e. its own postclip bounds — meaning the view is zoomed in close enough that the
 * earth cap covers the whole clip area and no horizon curve is actually visible. d3-geo emits a
 * real horizon (circular or narrowed by tilt) as an adaptively-sampled polygon of many short line
 * segments, never as a bare 4-point rectangle, so matching that exact shape reliably tells the two
 * apart without any DOM/geometry work.
 */
function isPlainRectangleOutline(outlinePathD: string): boolean {
    return /^M-?[\d.]+,-?[\d.]+(?:L-?[\d.]+,-?[\d.]+){3}Z$/.test(outlinePathD);
}

/**
 * Clip path following the globe's horizon (the projected `{type: "Sphere"}` outline), used to
 * keep waterline rings (see appendWaterlines in contourMethods.ts) from bulging past the globe
 * in the satellite projection — unlike every other layer, they're built by stroke-dilating an
 * already-projected path in flat SVG space, so they aren't bounded by the projection's own
 * spherical preclip. Skips creating the clip (removing any existing one instead) when it would be
 * a no-op: `outlinePathD` is `null` outside the satellite projection, or the horizon curve isn't
 * actually visible (see isPlainRectangleOutline) — e.g. zoomed in close enough that the frame
 * shows only ground, no horizon.
 */
export function appendGlobeClip(selection: SvgSelection, outlinePathD: string | null) {
    let defs: DefsSelection = selection.select('defs');
    if (defs.empty()) defs = selection.append('defs');
    selection.select('#clipGlobe').remove();
    if (!outlinePathD || isPlainRectangleOutline(outlinePathD)) return;
    const clip = defs.append('clipPath')
        .attr('id', 'clipGlobe')
        .attr('clipPathUnits', 'userSpaceOnUse');

    clip.append('path').attr('d', outlinePathD);
}

// function frontFilter(selection) {
//     let defs = selection.select('defs');
//     if (defs.empty()) defs = selection.append('defs');
//     const filter = defs.append('filter').attr('id', 'front-filter')
//         .attr('x', '-50%')
//         .attr('y', '-50%')
//         .attr('width', '200%')
//         .attr('height', '200%');

//     filter.node().innerHTML = `
//     <feImage xlink:href="${plaid}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="BG"></feImage>
//     <feBlend in="BG" in2="SourceGraphic" mode="multiply" result="BLENDED_TEXT"></feBlend>
//     <!-- layer the text on top of the background image -->
//     `;
// }

// function frontFilterOld(selection) {
//     let defs = selection.select('defs');
//     if (defs.empty()) defs = selection.append('defs');
//     const filter = defs.append('filter').attr('id', 'front-filter')
//         .attr('x', '-50%')
//         .attr('y', '-50%')
//         .attr('width', '200%')
//         .attr('height', '200%');

//     filter.node().innerHTML = `<feImage xlink:href="${plaid}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none"></feImage>
//     <!-- desaturate the image -->
//     <feColorMatrix type="saturate" values="0" result="MAP"></feColorMatrix>
//     <!-- decrease level of details so the effect on text is more realistic -->
    
//     <!-- use the displacement map to distort the text -->
//     <feDisplacementMap in="SourceGraphic" in2="MAP" scale="15" xChannelSelector="R" yChannelSelector="R" result="TEXTURED_TEXT"></feDisplacementMap>
//     <!-- add the image as a background behind the text again -->
//     <feImage xlink:href="${plaid}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="BG"></feImage>
//     <feColorMatrix in="TEXTURED_TEXT" result="TEXTURED_TEXT_2" type="matrix" values="1 0 0 0 0 
//             0 1 0 0 0 
//             0 0 1 0 0 
//             0 0 0 .9 0"></feColorMatrix>
//     <!--  blend the text with the background image -->
//     <feBlend in="BG" in2="TEXTURED_TEXT_2" mode="multiply" result="BLENDED_TEXT"></feBlend>
//     <!-- layer the text on top of the background image -->
//     <feMerge>
//         <feMergeNode in="BG"></feMergeNode>
//         <feMergeNode in="BLENDED_TEXT"></feMergeNode>
//     </feMerge>`;
// }

// export function frontFilterTest(selection) {
//     let defs = selection.select('defs');
//     if (defs.empty()) defs = selection.append('defs');
//     const filter = defs.append('filter').attr('id', 'front-filter');

//     filter.node().innerHTML = `<feImage xlink:href="${plaid}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="IMAGE"></feImage>
//     <!-- desaturate the image -->
//     <feColorMatrix in="IMAGE" values=".33 .33 .33 0 0
//                             .33 .33 .33 0 0
//                             .33 .33 .33 0 0
//                             0   0   0  0.5 0"
//         result="DESATURATED"></feColorMatrix>
//     <feComposite in="SourceGraphic" in2="DESATURATED" operator="in"></feComposite>
// `;
// }
