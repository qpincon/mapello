// Intersection observer for animation triggering
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.3,
};
mapElement.style.visibility = 'hidden';
let rendered = false;

function intersectionCallback(entries) {
    if (rendered || !entries[0].isIntersecting) return;
    rendered = true;
    // add some delay to ensure the map is in the viewport
    setTimeout(() => {
        mapElement.style.visibility = 'visible';
        mapElement.classList.add('animate');
        mapElement.querySelectorAll('path, #frame').forEach(pathElem => {
            pathElem.setAttribute('pathLength', 1);
        });
        setTimeout(() => {
            mapElement.classList.add('animate-transition');
        }, 1000);
        mapElement.querySelector('#frame').addEventListener('animationend', () => {
            mapElement.classList.remove('animate');
            __ON_ANIMATION_END__
            mapElement.querySelectorAll('path[pathLength]').forEach(el => {
                el.removeAttribute('pathLength');
            });
            setTimeout(() => {
                mapElement.classList.remove('animate-transition');
            }, 1000);
        });
    }, 500);
}

const observer = new IntersectionObserver(intersectionCallback, observerOptions);
observer.observe(mapElement);
