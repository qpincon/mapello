// Converts special g elements to images (requires imageFromSpecialGElem)
function gElemsToImages(transition) {
    const toTransformToImg = mapElement.querySelectorAll('g[image-class]');
    toTransformToImg.forEach(gElem => {
        const image = imageFromSpecialGElem(gElem);
        if (transition) {
            image.style.opacity = 0;
            image.style.willChange = 'transform';
            setTimeout(() => {
                image.style.opacity = 1;
            }, 0);
        }
        gElem.parentNode.append(image);
        if (transition) {
            setTimeout(() => {
                gElem.remove();
            }, 500);
        } else {
            gElem.remove();
        }
    });
    // The tooltip/popover foreignObject(s) (see tooltip.js / elementAnnotations.js) and the
    // attribution pill (see addAttribution in src/svg/export.ts) are all appended before this
    // runs — for an animated export in particular, gElemsToImages(true) only fires later, on
    // animationend, well after everything else already exists — so they'd otherwise end up
    // under the newly-appended contour images in paint order. Keep them on top.
    mapElement.querySelectorAll('foreignObject, #attribution').forEach(el => mapElement.append(el));
}
