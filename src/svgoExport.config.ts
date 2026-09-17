// NOTE: do not add 'removeUnknownsAndDefaults' to this plugin list. It is the only SVGO
// plugin that strips attributes it doesn't recognize, and its absence is the only reason the
// custom `image-*` (src/svg/contourMethods.ts) and `wl-*` (waterline) attributes survive
// optimization — both live only inside data-URI-embedded SVGs that SVGO never even parses,
// but were this plugin enabled it would also strip them from the host document's own
// attributes wherever they briefly appear there (e.g. on the raw <g> during export, see
// exportMacro in src/macro/export.ts).
export default {
  plugins: [
    'removeDoctype',
    'removeXMLProcInst',
    'removeComments',
    'removeMetadata',
    'removeEditorsNSData',
    'cleanupAttrs',
    'mergeStyles',
    'inlineStyles',
    'minifyStyles',
    'cleanupNumericValues',
    'convertColors',
    'removeNonInheritableGroupAttrs',
    'removeUselessStrokeAndFill',
    'cleanupEnableBackground',
    'removeHiddenElems',
    'removeEmptyText',
    'convertShapeToPath',
    'convertEllipseToCircle',
    'convertTransform',
    'removeEmptyAttrs',
    'removeEmptyContainers',
    'removeUnusedNS',
    'sortDefsChildren',
    'removeTitle',
    'removeDesc',
    {
      name: 'convertPathData',
      params: {
        applyTransforms: true,
        applyTransformsStroked: true,
        makeArcs: {
          threshold: 2.5, // coefficient of rounding error
          tolerance: 0.5, // percentage of radius
        },
        straightCurves: true,
        lineShorthands: true,
        curveSmoothShorthands: true,
        floatPrecision: 1,
        transformPrecision: 5,
        removeUseless: true,
        collapseRepeated: true,
        utilizeAbsolute: true,
        leadingZero: true,
        negativeExtraSpace: true,
        noSpaceAfterFlags: false, // a20 60 45 0 1 30 20 → a20 60 45 0130 20
        forceAbsolutePath: false,
      }
    },
  ]
}