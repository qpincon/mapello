// Tooltip functionality for exported SVGs
// Placeholders: __WIDTH__, __HEIGHT__, __DATA_BY_GROUP__, __ANNOTATION_IDS__

const parser = new DOMParser();
const width = __WIDTH__, height = __HEIGHT__;
const dataByGroup = __DATA_BY_GROUP__;
const _annotationIds = new Set(__ANNOTATION_IDS__);
const tooltip = { shapeId: null, element: null };

tooltip.element = constructTooltip({}, '', '');
mapElement.append(tooltip.element);
tooltip.element.style.display = 'none';

function constructTooltip(rawData, templateStr, shapeId) {
    if (!rawData) return;
    // Check if all data values are empty/zero — if so, don't show tooltip
    const dataKeys = Object.keys(rawData);
    if (dataKeys.length > 0 && dataKeys.every(k => !rawData[k] && rawData[k] !== false)) return;
    // Replace undefined/null/empty values with N/A for display
    const data = {};
    for (const k in rawData) {
        data[k] = (!rawData[k] && rawData[k] !== false && rawData[k] !== 0) ? 'N/A' : rawData[k];
    }
    const elem = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    elem.setAttribute('width', 1);
    elem.setAttribute('height', 1);
    elem.style.overflow = 'visible';
    const parsed = parser.parseFromString(eval('`' + templateStr + '`'), 'text/html').querySelector('body');
    const container = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    container.classList.add('body');
    container.append(parsed.firstChild);
    elem.appendChild(container);
    return elem;
}

function hideTooltip() {
    tooltip.element.style.display = 'none';
    tooltip.element.style.opacity = 0;
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

    var mapBounds = mapElement.querySelector('#frame').getBoundingClientRect();
    var scaleX = width / mapBounds.width;
    var scaleY = height / mapBounds.height;
    var posX = (e.clientX - mapBounds.left + 10) * scaleX;
    var posY = (e.clientY - mapBounds.top + 10) * scaleY;

    if (tooltip.shapeId === shapeId) {
        // Reposition — tooltip is visible, bounds are available for edge correction
        if (tooltip.measuring) return;
        var ttBounds = tooltip.element.firstChild?.firstChild?.getBoundingClientRect?.();
        if (ttBounds && ttBounds.width > 0) {
            if (mapBounds.right - ttBounds.width < e.clientX + 10) posX = (e.clientX - mapBounds.left - ttBounds.width - 20) * scaleX;
            if (mapBounds.bottom - ttBounds.height < e.clientY + 10) posY = (e.clientY - mapBounds.top - ttBounds.height - 20) * scaleY;
        }
        tooltip.element.setAttribute('x', posX);
        tooltip.element.setAttribute('y', posY);
        tooltip.element.style.display = 'block';
        tooltip.element.style.opacity = 1;
    } else {
        // New tooltip — create hidden, measure via rAF, then reveal at correct position
        var data = dataByGroup.data[groupId][shapeId];
        if (!data) return hideTooltip();
        var tt = constructTooltip(data, dataByGroup.tooltips[groupId], shapeId);
        if (!tt) return hideTooltip();
        tooltip.element.replaceWith(tt);
        tooltip.element = tt;
        tooltip.shapeId = shapeId;
        tooltip.element.setAttribute('x', posX);
        tooltip.element.setAttribute('y', posY);
        tooltip.element.style.display = 'block';
        tooltip.element.style.opacity = 0;
        tooltip.measuring = true;
        requestAnimationFrame(function () {
            tooltip.measuring = false;
            var nb = tooltip.element.firstChild?.firstChild?.getBoundingClientRect?.();
            if (nb && nb.width > 0) {
                if (mapBounds.right - nb.width < e.clientX + 10) posX = (e.clientX - mapBounds.left - nb.width - 20) * scaleX;
                if (mapBounds.bottom - nb.height < e.clientY + 10) posY = (e.clientY - mapBounds.top - nb.height - 20) * scaleY;
                tooltip.element.setAttribute('x', posX);
                tooltip.element.setAttribute('y', posY);
            }
            tooltip.element.style.opacity = 1;
        });
    }
}
