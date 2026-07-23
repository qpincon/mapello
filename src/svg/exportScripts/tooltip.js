// Tooltip functionality for exported SVGs
// Placeholders: __WIDTH__, __HEIGHT__, __DATA_BY_GROUP__, __ANNOTATION_IDS__

const parser = new DOMParser();
const width = __WIDTH__, height = __HEIGHT__;
const dataByGroup = __DATA_BY_GROUP__;
const _annotationIds = new Set(__ANNOTATION_IDS__);
const TT_OFFSET = 10;
const tooltip = { shapeId: null };

// Reads the map's own size and viewBox origin in its local (viewBox / user-unit)
// coordinate system. Falls back to the placeholder width/height when there's no viewBox
// (in that case user units == CSS px, so they're equivalent).
function _ttSvgSize() {
    var vb = (mapElement.getAttribute('viewBox') || '').split(/[\s,]+/);
    if (vb.length >= 4) return { minX: parseFloat(vb[0]) || 0, minY: parseFloat(vb[1]) || 0, w: parseFloat(vb[2]), h: parseFloat(vb[3]) };
    return { minX: 0, minY: 0, w: width, h: height };
}

// Single reusable host: one full-size <foreignObject> (so Safari doesn't clip content
// overflowing a tightly-sized foreignObject) containing one absolutely-positioned XHTML
// <div> moved via a CSS transform. Mirrors elementAnnotations.js's tooltip host.
const _ttInitialSize = _ttSvgSize();
const ttFO = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
ttFO.setAttribute('x', '0');
ttFO.setAttribute('y', '0');
ttFO.setAttribute('width', _ttInitialSize.w);
ttFO.setAttribute('height', _ttInitialSize.h);
ttFO.style.cssText = 'overflow:visible;pointer-events:none';
mapElement.append(ttFO);
const ttDiv = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
ttDiv.classList.add('body');
ttDiv.style.cssText = 'position:absolute;left:0;top:0;width:max-content;opacity:0;pointer-events:none;transform-origin:0 0;will-change:transform,opacity;overflow-wrap:break-word';
ttFO.appendChild(ttDiv);

function buildTooltipHtml(rawData, templateStr, shapeId) {
    if (!rawData) return;
    // Check if all data values are empty/zero — if so, don't show tooltip
    const dataKeys = Object.keys(rawData);
    if (dataKeys.length > 0 && dataKeys.every(k => !rawData[k] && rawData[k] !== false)) return;
    // Replace undefined/null/empty values with N/A for display
    const data = {};
    for (const k in rawData) {
        data[k] = (!rawData[k] && rawData[k] !== false && rawData[k] !== 0) ? 'N/A' : rawData[k];
    }
    // shapeId is referenced by `eval` below: export.ts rewrites the template's __NAME__
    // placeholder to a bare `shapeId` identifier (not `data.name`), so it must be in scope here.
    const parsed = parser.parseFromString(eval('`' + templateStr + '`'), 'text/html').querySelector('body');
    return parsed.firstChild ? parsed.firstChild.outerHTML : undefined;
}

function hideTooltip() {
    ttDiv.style.opacity = 0;
    tooltip.shapeId = null;
}

function positionTooltip(clientX, clientY) {
    // Scale and screen-origin are derived entirely from getBoundingClientRect() + the
    // viewBox — not from mapElement.getScreenCTM(). WebKit has been observed to report a
    // getScreenCTM() that doesn't match the SVG's actual render size/position (both the
    // e/f translation and the a/d scale), which pushed tooltips off from the cursor and,
    // when the SVG was CSS-stretched to a much larger size (only a viewBox, no width/height
    // attributes), shrank the tooltip and dampened how far it tracked the cursor.
    // getBoundingClientRect() is immune to this: the root <svg> is only ever scaled (never
    // rotated/skewed), so renderedSize/viewBoxSize is exactly the scale getScreenCTM() would
    // give in a bug-free browser.
    var rect = mapElement.getBoundingClientRect();
    var svgSize = _ttSvgSize();
    var sx = svgSize.w > 0 ? rect.width / svgSize.w : 1;
    var sy = svgSize.h > 0 ? rect.height / svgSize.h : 1;
    var invSx = 1 / sx;
    var invSy = 1 / sy;
    var svgLeft = rect.left - sx * svgSize.minX;
    var svgTop = rect.top - sy * svgSize.minY;
    var posX = clientX - svgLeft + TT_OFFSET;
    var posY = clientY - svgTop + TT_OFFSET;
    if (ttDiv.offsetWidth > 0) {
        if (posX + ttDiv.offsetWidth > rect.width) posX = clientX - svgLeft - ttDiv.offsetWidth - TT_OFFSET;
        if (posY + ttDiv.offsetHeight > rect.height) posY = clientY - svgTop - ttDiv.offsetHeight - TT_OFFSET;
    }
    ttDiv.style.transform = 'matrix(' + invSx + ',0,0,' + invSy + ',' + (posX * invSx) + ',' + (posY * invSy) + ')';
}

function onMouseMove(e) {
    var parent = e.target.parentNode;
    while (parent && !parent.hasAttribute?.('id')) {
        parent = parent.parentNode;
    }
    if (!parent) return hideTooltip();

    var groupId = parent.getAttribute('id');
    if (!(groupId in dataByGroup.data)) return hideTooltip();

    var shapeElem = e.target;
    if (!shapeElem.getAttribute?.('id') && shapeElem.tagName?.toLowerCase() === 'a') {
        shapeElem = shapeElem.querySelector('[id]') ?? shapeElem;
    }
    var shapeId = shapeElem.getAttribute?.('id') ?? null;
    if (!shapeId || _annotationIds.has(shapeId)) return hideTooltip();

    if (tooltip.shapeId === shapeId) {
        // Reposition — tooltip is already showing the right content
        if (tooltip.measuring) return;
        positionTooltip(e.clientX, e.clientY);
        ttDiv.style.opacity = 1;
    } else {
        // New tooltip — fill content hidden, measure via rAF, then reveal at correct position
        var data = dataByGroup.data[groupId][shapeId];
        if (!data) return hideTooltip();
        var html = buildTooltipHtml(data, dataByGroup.tooltips[groupId], shapeId);
        if (!html) return hideTooltip();
        ttDiv.innerHTML = html;
        tooltip.shapeId = shapeId;
        ttDiv.style.opacity = 0;
        tooltip.measuring = true;
        positionTooltip(e.clientX, e.clientY);
        requestAnimationFrame(function () {
            tooltip.measuring = false;
            positionTooltip(e.clientX, e.clientY);
            ttDiv.style.opacity = 1;
        });
    }
}
