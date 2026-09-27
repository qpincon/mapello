// Tooltip functionality for exported SVGs
// Placeholders (double-underscore wrapped, substituted in src/macro/export.ts): DATA_BY_GROUP,
// ANNOTATION_IDS. Deliberately NOT written out in full here: the substitution is a global regex
// that runs after the optional minify step, so with minifyJs off (the default) a literal token
// in a comment gets the whole JSON payload injected into it too, silently doubling the tooltip
// data in every exported file.
// Depends on overlay.js (createOverlayHost, placeOverlay), concatenated before this script.

const parser = new DOMParser();
const dataByGroup = __DATA_BY_GROUP__;
const _annotationIds = new Set(__ANNOTATION_IDS__);
const tooltip = { shapeId: null };

const ttHost = createOverlayHost(mapElement);

// Mirrors escapeHtml() in src/util/common.ts — duplicated because this script runs standalone
// in the exported SVG with no build step / imports.
function _escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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
    // __name__ refers to the shape's own id/name (not part of `data` — see export.ts's usedVars
    // filter), everything else is looked up in `data`. Substituted values are HTML-escaped since
    // they come from user-imported spreadsheet data; the surrounding template markup is the
    // author's own and is left untouched.
    const html = templateStr.replace(/__(\w+)__/g, (_, key) => {
        const val = key === 'name' ? shapeId : data[key];
        return _escapeHtml(val == null ? '' : String(val));
    });
    const parsed = parser.parseFromString(html, 'text/html').querySelector('body');
    if (!parsed.firstChild) return undefined;
    // XMLSerializer, not .outerHTML — outerHTML uses HTML serialization rules, which drop the
    // self-closing slash off void elements like <img>. That breaks ttHost.div.innerHTML = ... once
    // the exported file is opened standalone (an XML document, which requires well-formed
    // markup); XMLSerializer always keeps void elements self-closed.
    return new XMLSerializer().serializeToString(parsed.firstChild)
        .replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
}

function hideTooltip() {
    ttHost.div.style.opacity = 0;
    tooltip.shapeId = null;
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
        placeOverlay(ttHost, mapElement, e.clientX, e.clientY);
        ttHost.div.style.opacity = 1;
    } else {
        // New tooltip — fill content hidden, measure via rAF, then reveal at correct position
        var data = dataByGroup.data[groupId][shapeId];
        if (!data) return hideTooltip();
        var html = buildTooltipHtml(data, dataByGroup.tooltips[groupId], shapeId);
        if (!html) return hideTooltip();
        ttHost.div.innerHTML = html;
        tooltip.shapeId = shapeId;
        ttHost.div.style.opacity = 0;
        tooltip.measuring = true;
        placeOverlay(ttHost, mapElement, e.clientX, e.clientY);
        requestAnimationFrame(function () {
            tooltip.measuring = false;
            placeOverlay(ttHost, mapElement, e.clientX, e.clientY);
            ttHost.div.style.opacity = 1;
        });
    }
}
