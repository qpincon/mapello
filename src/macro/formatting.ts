import { macroState } from "src/state.svelte";
import type { FormatterObject } from "src/types";
import { formatLocale } from 'd3-format';


export const resolvedLocales = import.meta.glob<d3.FormatLocaleDefinition>(
    "../../node_modules/d3-format/locale/*.json",
    {
        eager: true,
        import: "default",
    },
);

Object.keys(resolvedLocales).forEach((localeFilePath) => {
    const fileName = localeFilePath.split("/").at(-1)!;
    const name = fileName.split(".")![0]!; // remove extension
    resolvedLocales[name] = resolvedLocales[localeFilePath];
    delete resolvedLocales[localeFilePath];
});

export function updateZonesDataFormatters(): void {
    Object.entries(macroState.zonesData).forEach(([name, def]) => {
        const locale = macroState.tooltipDefs[name].locale;
        const formatters: FormatterObject = {};
        if (def.numericCols.length) {
            def.numericCols.forEach((colDef) => {
                const col = colDef.column;
                formatters[col] = getBestFormatter(
                    def.data.map((row) => row[col] as number),
                    resolvedLocales[locale],
                );
            });
        }
        macroState.zonesData[name].formatters = formatters;
    });
}


function getBestFormatter(values: number[], locale: any): (n: number) => string {
    const loc = formatLocale(locale);
    const max = Math.max(...values);
    const hasDecimals = values.some(v => v % 1 !== 0);
    if (max < 1) return loc.format(',.2~f');
    if (max < 10) return loc.format(',.1~f');
    if (hasDecimals) return loc.format(',.2~f');
    return loc.format(',~d');
}

export function getLocaleDisplayName(locale: string): string {
    try {
        const dn = new Intl.DisplayNames([locale], { type: 'language' });
        return dn.of(locale) ?? locale;
    } catch { return locale; }
}
