// Hover state management for exported SVGs
// This script manages path hover states: moves hovered element to top, adds .hovered class
// Works standalone, optionally integrates with tooltip (calls onMouseMove/hideTooltip if defined)

let hoveredPath = null;
let zOrderElem = null;
let originalIndex = null;

function clearHover() {
    if (!hoveredPath) return;
    hoveredPath.classList.remove('hovered');
    const parent = zOrderElem?.parentNode;
    if (originalIndex !== null && parent) {
        parent.insertBefore(zOrderElem, parent.children[originalIndex]);
    }
    hoveredPath = null;
    zOrderElem = null;
    originalIndex = null;
}

mapElement.addEventListener('mouseleave', () => {
    if (typeof hideTooltip === 'function') hideTooltip();
    clearHover();
});

mapElement.addEventListener('mousemove', (e) => {
    if (typeof onMouseMove === 'function') onMouseMove(e);

    const target = e.target;

    // Resolve pathElem and zElem regardless of whether target is <path> or <a>
    let pathElem, zElem;
    if (target.tagName === 'path') {
        pathElem = target;
        zElem = target.parentNode?.tagName?.toLowerCase() === 'a' ? target.parentNode : target;
    } else if (target.tagName?.toLowerCase() === 'a') {
        pathElem = target.querySelector('path');
        zElem = target;
    }

    const gParent = zElem?.parentNode;

    if (pathElem && gParent?.tagName === 'g') {
        if (hoveredPath !== pathElem) {
            clearHover();
            originalIndex = Array.from(gParent.children).indexOf(zElem);
            gParent.append(zElem);
            pathElem.classList.add('hovered');
            hoveredPath = pathElem;
            zOrderElem = zElem;
        }
    } else {
        clearHover();
    }
});
