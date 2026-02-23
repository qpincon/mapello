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

function constructTooltip(data, templateStr, shapeId) {
    if (!data) return;
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
}

function onMouseMove(e) {
    let parent = e.target.parentNode;
    while (parent && !parent.hasAttribute?.('id')) {
        parent = parent.parentNode;
    }
    if (!parent) return hideTooltip();

    const groupId = parent.getAttribute('id');
    if (!(groupId in dataByGroup.data)) return hideTooltip();

    let shapeElem = e.target;
    if (!shapeElem.getAttribute?.('id') && shapeElem.tagName?.toLowerCase() === 'a') {
        shapeElem = shapeElem.querySelector('[id]') ?? shapeElem;
    }
    const shapeId = shapeElem.getAttribute?.('id') ?? null;
    if (!shapeId) return hideTooltip();
    if (_annotationIds.has(shapeId)) return hideTooltip();

    const mapBounds = mapElement.querySelector('#frame').getBoundingClientRect();
    const scaleX = width / mapBounds.width;
    const scaleY = height / mapBounds.height;
    const ttBounds = tooltip.element.firstChild?.firstChild?.getBoundingClientRect?.();

    let posX = (e.clientX - mapBounds.left + 10) * scaleX;
    let posY = (e.clientY - mapBounds.top + 10) * scaleY;
    if (ttBounds?.width > 0) {
        if (mapBounds.right - ttBounds.width < e.clientX + 10) {
            posX = (e.clientX - mapBounds.left - ttBounds.width - 20) * scaleX;
        }
        if (mapBounds.bottom - ttBounds.height < e.clientY + 10) {
            posY = (e.clientY - mapBounds.top - ttBounds.height - 20) * scaleY;
        }
    }

    if (tooltip.shapeId === shapeId) {
        tooltip.element.setAttribute('x', posX);
        tooltip.element.setAttribute('y', posY);
        tooltip.element.style.display = 'block';
        tooltip.element.style.opacity = 1;
    } else {
        const data = dataByGroup.data[groupId][shapeId];
        if (!data) return hideTooltip();
        const tt = constructTooltip(data, dataByGroup.tooltips[groupId], shapeId);
        tooltip.element.replaceWith(tt);
        tooltip.element = tt;
        tooltip.shapeId = shapeId;
        tooltip.element.setAttribute('x', posX);
        tooltip.element.setAttribute('y', posY);
        tooltip.element.style.display = 'block';
        tooltip.element.style.opacity = 1;
    }
}
