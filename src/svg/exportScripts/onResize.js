// Hides SVG during resize to prevent layout issues
let resizeTimeout;
window.addEventListener('resize', e => {
    mapElement.style.display = 'none';
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        mapElement.style.display = 'block';
    }, 300);
});
