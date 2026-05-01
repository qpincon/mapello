// Converts special g elements to images (requires imageFromSpecialGElem, duplicateContours)
function gElemsToImages(transition) {
    const toTransformToImg = mapElement.querySelectorAll('g[image-class]');
    toTransformToImg.forEach(gElem => {
        const image = imageFromSpecialGElem(gElem);
        gElem.parentNode.append(image);
        if (transition) {
            setTimeout(() => {
                gElem.remove();
            }, 500);
        } else {
            gElem.remove();
        }
    });
    duplicateContours(mapElement, transition);
}
