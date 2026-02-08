import { additionnalCssExport, changeIdAndReferences, ExportFontChoice, inlineFontVsPath, rgb2hex, type ExportOptions } from 'src/svg/export';
import type { ProvidedFont, StateMacro, SvgSelection, TooltipDefs, ZonesData } from 'src/types';
import { DOM_PARSER, fontsToCss, getUsedInlineFonts, reportStyle } from 'src/util/dom';
import svgoConfig from '../svgoExport.config';
import type { Config } from 'svgo/browser';
import { discriminateCssForExport, download, htmlToElement, indexBy, pick } from 'src/util/common';
import { encodeSVGDataImageStr, imageFromSpecialGElemStr } from 'src/svg/contourMethods';

// Import export-only scripts as raw strings
import hoverScript from 'src/svg/exportScripts/hover.js?raw';
import tooltipScript from 'src/svg/exportScripts/tooltip.js?raw';
import duplicateContoursScript from 'src/svg/exportScripts/duplicateContours.js?raw';
import gElemsToImagesScript from 'src/svg/exportScripts/gElemsToImages.js?raw';
import onResizeScript from 'src/svg/exportScripts/onResize.js?raw';
import intersectionObserverScript from 'src/svg/exportScripts/intersectionObserver.js?raw';

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
    options: ExportOptions = {}
): Promise<string | void> {
    const {
        exportFonts = ExportFontChoice.convertToPath,
        hideOnResize = false,
        minifyJs = false
    } = options;

    const fo = svg.select('foreignObject').node();
    // remove foreign object from dom when exporting
    if (fo) document.body.append(fo as Node);
    const svgNode = svg.node()!;

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
        pathIsBetter = await inlineFontVsPath(optimizedSVG.firstChild as SVGElement, providedFonts, exportFonts);
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
            const id = child.getAttribute('id');
            if (!id || !indexed[id]) continue;
            finalData[id] = pick(indexed[id], usedVars);
        }
        finalDataByGroup.data[groupId] = finalData;
    });

    console.log(finalDataByGroup)
    // Build tooltip code by replacing placeholders with actual values
    const tooltipCode = tooltipEnabled
        ? tooltipScript
            .replaceAll('__WIDTH__', stateMacro.macroParams.General.width.toString())
            .replaceAll('__HEIGHT__', stateMacro.macroParams.General.height.toString())
            .replaceAll('__DATA_BY_GROUP__', JSON.stringify(finalDataByGroup))
        : '';

    // Build intersection observer code with animation end handler
    const animationCode = stateMacro.macroParams.General.animate
        ? intersectionObserverScript.replaceAll('__ON_ANIMATION_END__', 'gElemsToImages(true);')
        : 'gElemsToImages();';

    let finalScript = `
    (function() {
        const allScripts = document.getElementsByTagName('script');
        const scriptTag = allScripts[allScripts.length - 1];
        const mapElement = scriptTag.parentNode;

        ${encodeSVGDataImageStr}
        ${imageFromSpecialGElemStr}
        ${duplicateContoursScript}
        ${gElemsToImagesScript}
        ${hideOnResize ? onResizeScript : ''}
        ${tooltipCode}
        ${hoverScript}
        ${animationCode}
    })()
        `;

    // === Styling ===
    const styleElem = document.createElementNS("http://www.w3.org/2000/svg", 'style');
    const renderedCss = commonCss.replaceAll(/rgb\(.*?\)/g, rgb2hex) + additionnalCssExport;
    const { mapId, finalCss } = discriminateCssForExport(renderedCss);
    (optimizedSVG.firstChild as Element).setAttribute('id', mapId);
    changeIdAndReferences(optimizedSVG.firstChild as Element, mapId);
    // === End styling ===

    styleElem.innerHTML = pathIsBetter ? finalCss : finalCss + fontsToCss(usedProvidedFonts);
    (optimizedSVG.firstChild as Element)!.append(styleElem);
    (optimizedSVG.firstChild as Element).classList.remove('animate-transition');
    (optimizedSVG.firstChild as Element).classList.add('cartosvg');

    if (!downloadExport) return (optimizedSVG.firstChild as Element).outerHTML;

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
    (optimizedSVG.firstChild as Element)!.append(scriptElem);
    download((optimizedSVG.firstChild as Element).outerHTML, 'text/plain', 'cartosvg-export.svg');
}

export function getFinalTooltipTemplate(groupId: string, tooltipDefs: TooltipDefs): string {
    const finalReference = htmlToElement(tooltipDefs[groupId].content!)!;
    const finalTemplate = finalReference.cloneNode(true) as Element;
    finalTemplate.innerHTML = tooltipDefs[groupId].template;
    reportStyle(finalReference, finalTemplate);
    return finalTemplate.outerHTML;
}
