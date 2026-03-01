import { addAttribution, additionnalCssExport, changeIdAndReferences, ExportFontChoice, inlineFontVsPath, rgb2hex, type ExportOptions } from 'src/svg/export';
import type { ElementAnnotations, ProvidedFont, StateMacro, SvgSelection, TooltipDefs, ZonesData } from 'src/types';
import { DOM_PARSER, fontsToCss, fontsToCssEmbed, getUsedInlineFonts, reportStyle } from 'src/util/dom';
import svgoConfig from '../svgoExport.config';
import type { Config } from 'svgo/browser';
import { discriminateCssForExport, download, htmlToElement, indexBy, pick, randomString, xhtmlifyHtml } from 'src/util/common';
import { encodeSVGDataImageStr, imageFromSpecialGElemStr } from 'src/svg/contourMethods';
import { transitionCssMacro } from 'src/svg/transition';

// Import export-only scripts as raw strings
import hoverScript from 'src/svg/exportScripts/hover.js?raw';
import tooltipScript from 'src/svg/exportScripts/tooltip.js?raw';
import duplicateContoursScript from 'src/svg/exportScripts/duplicateContours.js?raw';
import gElemsToImagesScript from 'src/svg/exportScripts/gElemsToImages.js?raw';
import intersectionObserverScript from 'src/svg/exportScripts/intersectionObserver.js?raw';
import elementAnnotationsScript from 'src/svg/exportScripts/elementAnnotations.js?raw';

interface FinalDataByGroup {
    data: { [groupId: string]: { [shapeId: string]: any } };
    tooltips: { [groupId: string]: string };
}

export async function exportMacro(
    svg: SvgSelection,
    stateMacro: StateMacro,
    providedFonts: ProvidedFont[],
    downloadExport: boolean = true,
    commonCss: string,
    options: ExportOptions = {},
    elementAnnotations?: ElementAnnotations,
): Promise<string | void> {
    const {
        exportFonts = ExportFontChoice.convertToPath,
        minifyJs = false,
        animate = false,
        useViewBox = false,
        frameShadow = false,
    } = options;
    // console.log('options', options);
    const fo = svg.select('foreignObject').node();
    // remove foreign object from dom when exporting
    if (fo) document.body.append(fo as Node);
    const svgNode = svg.node()!;

    // Remove selection overlay from export
    const selectionOverlay = svgNode.querySelector('#selection-overlay');
    if (selectionOverlay) selectionOverlay.remove();

    // === Remove contours images (keep only <g> element to duplicate afterwards) ==
    let contours = Array.from(svgNode.querySelectorAll('image.contour-to-dup'));
    const contoursWithParents: [Element, Element][] = contours.map(el => {
        const parent = el.parentNode as Element;
        document.body.append(el);
        return [el, parent];
    });

    /** Add an element using the SVG filter, otherwise it gets removed by SVGO as it's never used directly but later in JS*/
    svgNode.querySelectorAll('[image-filter-name]').forEach(elem => {
        const filterName = elem.getAttribute('image-filter-name');
        if (filterName) {
            const emptyElementTrickSvgo = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            emptyElementTrickSvgo.classList.add('svgo-trick');
            emptyElementTrickSvgo.setAttribute('filter', `url(#${filterName})`);
            svgNode.append(emptyElementTrickSvgo);
        }
    });
    // === End remove contours ==

    const usedFonts = getUsedInlineFonts(svgNode);
    const usedProvidedFonts = providedFonts.filter(font => usedFonts.has(font.name));

    const SVGO = await import('svgo/browser');

    // Optimize whole SVG
    const finalSvg = SVGO.optimize(svgNode.outerHTML, svgoConfig as Config).data;

    // === re-insert tooltip and contours ===
    if (fo) svg.node()!.append(fo as Node);
    contoursWithParents.forEach(([el, parent]) => {
        parent.insertBefore(el, parent.firstChild);
    });
    svgNode.querySelectorAll('.svgo-trick').forEach(el => el.remove());
    // === End re-insertion === 

    const optimizedSVG = DOM_PARSER.parseFromString(finalSvg, 'image/svg+xml');
    optimizedSVG.querySelectorAll('.svgo-trick').forEach(el => el.remove());

    let pathIsBetter = false;
    if (exportFonts === ExportFontChoice.smallest || exportFonts === ExportFontChoice.convertToPath) {
        pathIsBetter = await inlineFontVsPath(optimizedSVG.firstChild as SVGElement, usedProvidedFonts, exportFonts);
    } else if (exportFonts === ExportFontChoice.noExport) {
        pathIsBetter = true;
    }

    const finalDataByGroup: FinalDataByGroup = { data: {}, tooltips: {} };
    let tooltipEnabled = false;

    [...stateMacro.chosenCountriesAdm, 'countries'].forEach(groupId => {
        const group = optimizedSVG.getElementById(groupId);
        if (!group || !stateMacro.tooltipDefs[groupId]?.enabled) return;

        tooltipEnabled = true;
        const ttTemplate = getFinalTooltipTemplate(groupId, stateMacro.tooltipDefs);
        let usedVars = [...ttTemplate.matchAll(/__(\w+)__/g)].map(group => group[1]);
        usedVars = [...new Set(usedVars)];
        usedVars = usedVars.filter(v => v !== 'name');

        let functionStr = ttTemplate.replaceAll(/__(\w+)__/gi, '${data.$1}');
        functionStr = functionStr.replace('data.name', 'shapeId');
        finalDataByGroup.tooltips[groupId] = functionStr;

        const zonesDataDup = JSON.parse(JSON.stringify(stateMacro.zonesData[groupId].data));
        stateMacro.zonesData[groupId].numericCols.forEach(colDef => {
            const col = colDef.column;
            zonesDataDup.forEach((row: any) => {
                row[col] = stateMacro.zonesData[groupId].formatters![col](row[col]);
            });
        });

        const indexed = indexBy(zonesDataDup, 'name');
        const finalData: { [shapeId: string]: any } = {};

        for (const child of group.children) {
            // If the child is an <a> link wrapper, look inside for the actual element
            const elem = child.tagName.toLowerCase() === 'a' ? child.firstElementChild : child;
            const id = elem?.getAttribute('id');
            if (!id || !indexed[id]) continue;
            finalData[id] = pick(indexed[id], usedVars);
        }
        finalDataByGroup.data[groupId] = finalData;
    });

    // Build tooltip code by replacing placeholders with actual values
    const annotationTooltipIds = elementAnnotations
        ? Object.entries(elementAnnotations).filter(([, v]) => v.tooltip).map(([k]) => k)
        : [];
    const tooltipCode = tooltipEnabled
        ? tooltipScript
            .replaceAll('__WIDTH__', stateMacro.macroParams.General.width.toString())
            .replaceAll('__HEIGHT__', stateMacro.macroParams.General.height.toString())
            .replaceAll('__DATA_BY_GROUP__', JSON.stringify(finalDataByGroup))
            .replaceAll('__ANNOTATION_IDS__', JSON.stringify(annotationTooltipIds))
        : '';

    // Build intersection observer code with animation end handler
    const animationCode = animate
        ? intersectionObserverScript.replaceAll('__ON_ANIMATION_END__', 'gElemsToImages(true);')
        : 'gElemsToImages();';

    const hasAnnotations = elementAnnotations && Object.keys(elementAnnotations).length > 0;

    // === Styling ===
    const mapId = randomString(5);
    const styleElem = document.createElementNS("http://www.w3.org/2000/svg", 'style');
    const renderedCss = commonCss.replaceAll(/rgb\(.*?\)/g, rgb2hex) + additionnalCssExport;
    const animateCss = animate ? transitionCssMacro : '';
    const finalCss = discriminateCssForExport(renderedCss + animateCss, mapId);
    (optimizedSVG.firstChild as Element).setAttribute('id', mapId);
    changeIdAndReferences(optimizedSVG.firstChild as Element, mapId);
    // === End styling ===

    // Build annotation code after changeIdAndReferences so #paths element IDs are correctly resolved
    let annotationCode = '';
    if (hasAnnotations) {
        const resolvedAnnotations: Record<string, { tooltip?: string; popover?: string }> = {};
        for (const [id, ann] of Object.entries(elementAnnotations!)) {
            // #paths elements get their IDs prefixed by changeIdAndReferences; try both
            const resolvedId = optimizedSVG.getElementById(id) ? id : `${mapId}-${id}`;
            if (optimizedSVG.getElementById(resolvedId)) {
                resolvedAnnotations[resolvedId] = {
                    tooltip: ann.tooltip ? xhtmlifyHtml(ann.tooltip) : undefined,
                    popover: ann.popover ? xhtmlifyHtml(ann.popover) : undefined,
                };
            }
        }
        if (Object.keys(resolvedAnnotations).length > 0) {
            annotationCode = elementAnnotationsScript.replaceAll(
                '__ELEMENT_ANNOTATIONS__',
                JSON.stringify(resolvedAnnotations)
            );
        }
    }

    let finalScript = `
    (function() {
        const mapElement = document.currentScript.parentNode;

        ${encodeSVGDataImageStr}
        ${imageFromSpecialGElemStr}
        ${duplicateContoursScript}
        ${gElemsToImagesScript}
        ${tooltipCode}
        ${hoverScript}
        ${annotationCode}
        ${animationCode}
    })()
        `;

    let fontCss = '';
    if (!pathIsBetter) {
        if (exportFonts === ExportFontChoice.embedFontFace || exportFonts === ExportFontChoice.smallest) {
            fontCss = fontsToCss(usedProvidedFonts);
        } else {
            fontCss = await fontsToCssEmbed(usedProvidedFonts);
        }
    }
    styleElem.innerHTML = finalCss + fontCss;
    const svgElement = optimizedSVG.firstChild as Element;
    svgElement.append(styleElem);
    svgElement.classList.remove('animate-transition');
    svgElement.classList.add('cartosvg');

    if (frameShadow) {
        svgElement.setAttribute('filter', 'drop-shadow(2px 2px 8px rgba(0,0,0,.2))');
    }

    if (useViewBox) {
        const w = svgElement.getAttribute('width');
        const h = svgElement.getAttribute('height');
        if (w && h) {
            svgElement.setAttribute('viewBox', `0 0 ${w} ${h}`);
            svgElement.removeAttribute('width');
            svgElement.removeAttribute('height');
        }
    }

    if (minifyJs !== false) {
        const terser = await import('terser');
        const minified = await terser.minify(finalScript, {
            toplevel: true,
            mangle: { eval: true, reserved: ['data', 'shapeId'] }
        });
        finalScript = minified.code || finalScript;
    }

    const scriptElem = document.createElementNS("http://www.w3.org/2000/svg", 'script');
    const scriptContent = document.createTextNode(finalScript);
    scriptElem.appendChild(scriptContent);
    svgElement.append(scriptElem);

    addAttribution(svgElement, stateMacro.macroParams.General.width, stateMacro.macroParams.General.height, 'macro');

    if (!downloadExport) return svgElement.outerHTML;
    download(svgElement.outerHTML, 'text/plain', 'cartosvg-export.svg');
}

export function getFinalTooltipTemplate(groupId: string, tooltipDefs: TooltipDefs): string {
    const finalReference = htmlToElement(tooltipDefs[groupId].content!)!;
    const finalTemplate = finalReference.cloneNode(true) as Element;
    finalTemplate.innerHTML = tooltipDefs[groupId].template;
    reportStyle(finalReference, finalTemplate);
    return finalTemplate.outerHTML;
}
