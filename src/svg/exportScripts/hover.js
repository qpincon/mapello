// Hover state management for exported SVGs
// This script manages path hover states: moves hovered element to top, adds .hovered class
// Works standalone, optionally integrates with tooltip (calls onMouseMove/hideTooltip if defined)

let hoveredPath = null;
let originalIndex = null;

function clearHover() {
    if (!hoveredPath) return;
    hoveredPath.classList.remove('hovered');
    const parent = hoveredPath.parentNode;
    if (originalIndex !== null && parent) {
        parent.insertBefore(hoveredPath, parent.children[originalIndex]);
    }
    hoveredPath = null;
    originalIndex = null;
}

mapElement.addEventListener('mouseleave', () => {
    if (typeof hideTooltip === 'function') hideTooltip();
    clearHover();
});

mapElement.addEventListener('mousemove', (e) => {
    if (typeof onMouseMove === 'function') onMouseMove(e);

    const target = e.target;
    const parent = target.parentNode;

    if (target.tagName === 'path' && parent?.tagName === 'g') {
        if (hoveredPath !== target) {
            clearHover();
            originalIndex = Array.from(parent.children).indexOf(target);
            parent.append(target);
            target.classList.add('hovered');
            hoveredPath = target;
        }
    } else {
        clearHover();
    }
});
