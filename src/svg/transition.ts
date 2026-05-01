export const transitionCssMacro = `
#static-svg-map.mapanimate-transition path, #static-svg-map.mapanimate-transition #graticule, #static-svg-map.mapanimate-transition #outline, #static-svg-map.mapanimate-transition image, #static-svg-map.mapanimate-transition text, #static-svg-map.mapanimate-transition #points-labels, #static-svg-map.mapanimate-transition #svg-map-legend *, #static-svg-map.mapanimate-transition #path-images {
    transition-property: fill-opacity, opacity;
    transition-duration: 1s;
    transition-timing-function: ease;
}
#static-svg-map.mapanimate-transition #graticule, #static-svg-map.mapanimate-transition #outline {
    transition-delay: 0.5s;
}
#static-svg-map.mapanimate path, #static-svg-map.mapanimate rect, #static-svg-map.mapanimate circle {
    stroke-dasharray: 1 !important;
    fill-opacity: 0 !important;
    stroke-dashoffset: 1;
}
#static-svg-map.mapanimate text, #static-svg-map.mapanimate image, #static-svg-map.mapanimate #points-labels, #static-svg-map.mapanimate #path-images, #static-svg-map.mapanimate #graticule, #static-svg-map.mapanimate #attribution {
    opacity: 0 !important;
}
#static-svg-map.mapanimate #frame{
    animation: dash 3s ease 0s forwards;
}
#static-svg-map.mapanimate #land path, #static-svg-map.mapanimate #paths path, #static-svg-map.mapanimate .country-img path {
    animation: dash 3s ease 0.5s forwards;
}
#static-svg-map.mapanimate .country, #static-svg-map.mapanimate .adm, #static-svg-map.mapanimate #svg-map-legend * {
    animation: dash 3s ease 1s forwards;
}
#static-svg-map.mapanimate.no-frame #land path, #static-svg-map.mapanimate.no-frame #paths path, #static-svg-map.mapanimate.no-frame .country-img path {
    animation: dash 3s ease 0s forwards;
}
#static-svg-map.mapanimate.no-frame .country, #static-svg-map.mapanimate.no-frame .adm, #static-svg-map.mapanimate.no-frame #svg-map-legend * {
    animation: dash 3s ease 0.5s forwards;
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
`;

export const transitionCssMicro = `
#static-svg-map.mapanimate-transition path, #static-svg-map.mapanimate-transition text, #static-svg-map.mapanimate-transition #points-labels {
    transition-property: fill-opacity, opacity;
    transition-duration: 1s;
    transition-timing-function: ease;
}

#static-svg-map.mapanimate path, #static-svg-map.mapanimate #frame {
    stroke-dasharray: 1 !important;
    fill-opacity: 0 !important;
    stroke-dashoffset: 1;
}

#static-svg-map.mapanimate #micro .line { stroke-opacity: 0; }
#static-svg-map.mapanimate text, #static-svg-map.mapanimate #points-labels, #static-svg-map.mapanimate #path-images, #static-svg-map.mapanimate #attribution {
    opacity: 0 !important;
}
#static-svg-map.mapanimate #frame{
    animation: dash 3.5s ease 0s forwards;
}
#static-svg-map.mapanimate #micro .poly {
    animation: dash 2.5s ease 0.5s forwards;
}
#static-svg-map.mapanimate #micro .line, #static-svg-map.mapanimate #paths path {
    animation: dash 2s ease 1.5s forwards;
}
#static-svg-map.mapanimate #buildings .wall {
    opacity: 0;
}
#static-svg-map.mapanimate #buildings .roof {
    stroke-dasharray: 1 !important;
    fill-opacity: 0 !important;
    stroke-dashoffset: 1;
    animation: dash 2.5s ease 0.5s forwards;
}
#static-svg-map.mapanimate.no-frame #micro .poly {
    animation: dash 2.5s ease 0s forwards;
}
#static-svg-map.mapanimate.no-frame #micro .line, #static-svg-map.mapanimate.no-frame #paths path {
    animation: dash 2s ease 1s forwards;
}
#static-svg-map.mapanimate.no-frame #buildings .roof {
    animation: dash 2.5s ease 0s forwards;
}
#static-svg-map.mapanimate-transition #buildings .wall {
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
