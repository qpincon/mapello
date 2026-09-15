import type { ProvidedFont } from "../types";

export interface BunnyFontCatalogEntry {
    familyName: string;
    category: string;
    weights: number[];
    defSubset: string;
}
export type BunnyFontCatalog = Record<string, BunnyFontCatalogEntry>;

/** Cached https://fonts.bunny.net/list response, keyed by slug: { familyName, category, weights, defSubset }. */
let catalogPromise: Promise<BunnyFontCatalog> | null = null;

/** Shared, cached fetch of the Bunny Fonts catalog — used by both `FontPicker` and palette application. */
export function getBunnyFontCatalog(): Promise<BunnyFontCatalog> {
    if (!catalogPromise) {
        catalogPromise = fetch("https://fonts.bunny.net/list")
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .catch((e) => {
                catalogPromise = null; // allow retry on next call
                throw e;
            });
    }
    return catalogPromise;
}

export function defaultBunnyWeight(weights: number[] | undefined): number {
    return weights?.includes(400) ? 400 : (weights?.[0] ?? 400);
}

/** Builds the `ProvidedFont` for a catalog entry, the shape both `FontPicker` and palette application need. */
export function toProvidedFont(slug: string, data: BunnyFontCatalogEntry, weight?: number): ProvidedFont {
    return {
        name: data.familyName,
        slug,
        weight: weight ?? defaultBunnyWeight(data.weights),
        style: "normal",
        defSubset: data.defSubset || "latin",
    };
}

/**
 * Resolves a Bunny Fonts family name (e.g. "Playfair Display") into a loadable `ProvidedFont`,
 * the same shape `FontPicker` produces when a user manually picks a font. Used to apply a
 * palette's preset label font, since Bunny fonts aren't natively available and need their
 * `@font-face` loaded via `commonState.providedFonts` (see `fontsToCss` in `util/dom.ts`).
 */
export async function resolveBunnyFontByName(familyName: string): Promise<ProvidedFont | null> {
    try {
        const catalog = await getBunnyFontCatalog();
        const target = familyName.trim().toLowerCase();
        const entry = Object.entries(catalog).find(([, data]) => data.familyName?.toLowerCase() === target);
        if (!entry) return null;
        const [slug, data] = entry;
        return toProvidedFont(slug, data);
    } catch {
        return null;
    }
}
