export const transitionCssMacro = `
#static-svg-map.animate-transition path, #static-svg-map.animate-transition #graticule, #static-svg-map.animate-transition #outline, #static-svg-map.animate-transition image, #static-svg-map.animate-transition text, #static-svg-map.animate-transition #points-labels, #static-svg-map.animate-transition #svg-map-legend *, #static-svg-map.animate-transition #path-images {
    transition-property: fill-opacity, opacity;
    transition-duration: 1s;
    transition-timing-function: ease;
}
#static-svg-map.animate-transition #graticule, #static-svg-map.animate-transition #outline {
    transition-delay: 0.5s;
}
#static-svg-map.animate path, #static-svg-map.animate rect, #static-svg-map.animate circle {
    stroke-dasharray: 1 !important;
    fill-opacity: 0 !important;
    stroke-dashoffset: 1;
}
#static-svg-map.animate text, #static-svg-map.animate image, #static-svg-map.animate #points-labels, #static-svg-map.animate #path-images, #static-svg-map.animate #graticule {
    opacity: 0 !important;
}
#static-svg-map.animate #frame{
    animation: dash 3s ease 0s forwards;
}
#static-svg-map.animate #land path, #static-svg-map.animate #paths path, #static-svg-map.animate .country-img path {
    animation: dash 3s ease 0.5s forwards;
}
#static-svg-map.animate .country, #static-svg-map.animate .adm, #static-svg-map.animate #svg-map-legend * {
    animation: dash 3s ease 1s forwards;
}

@keyframes dash {
    from {
      stroke-dashoffset: 1;
    }
    to {
      stroke-dashoffset: 0;
    }
}
`;

export const transitionCssMicro = `
#static-svg-map.animate-transition path, #static-svg-map.animate-transition text, #static-svg-map.animate-transition #points-labels {
    transition-property: fill-opacity, opacity;
    transition-duration: 1s;
    transition-timing-function: ease;
}

#static-svg-map.animate path, #static-svg-map.animate #frame {
    stroke-dasharray: 1 !important;
    fill-opacity: 0 !important;
    stroke-dashoffset: 1;
}

#static-svg-map.animate #micro .line { stroke-opacity: 0; }
#static-svg-map.animate text, #static-svg-map.animate #points-labels, #static-svg-map.animate #path-images {
    opacity: 0 !important;
}
#static-svg-map.animate #frame{
    animation: dash 3.5s ease 0s forwards;
}
#static-svg-map.animate #micro .poly {
    animation: dash 2.5s ease 0.5s forwards;
}
#static-svg-map.animate #micro .line, #static-svg-map.animate #paths path {
    animation: dash 2s ease 1.5s forwards;
}
#static-svg-map.animate #buildings .wall {
    opacity: 0;
}
#static-svg-map.animate #buildings .roof {
    stroke-dasharray: 1 !important;
    fill-opacity: 0 !important;
    stroke-dashoffset: 1;
    animation: dash 2.5s ease 0.5s forwards;
}
#static-svg-map.animate-transition #buildings .wall {
    transition-property: opacity;
    transition-duration: 0.5s;
}

@keyframes dash {
    from {
        stroke-opacity: 1;
        stroke-dashoffset: 1;
    }
    to {
        stroke-opacity: 1;
        stroke-dashoffset: 0;
    }
}
`
