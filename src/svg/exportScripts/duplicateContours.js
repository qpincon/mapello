// Duplicates contour elements with filters applied
function duplicateContours(svgElem, transition) {
    Array.from(svgElem.querySelectorAll('.contour-to-dup')).forEach(el => {
        if (!el.hasAttribute('filter-name')) return;
        const clone = el.cloneNode();
        clone.setAttribute('href', el.getAttribute('href').replace("fill='none'", ''));
        clone.setAttribute('filter', 'url(#' + el.getAttribute('filter-name') + ')');
        if (transition) {
            clone.style.opacity = 0;
            setTimeout(() => {
                clone.style.opacity = 1;
            }, 0);
        }
        el.parentNode.insertBefore(clone, el);
    });
}
