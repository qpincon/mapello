# CartoSVG Showcase Maps

Three visually striking macro-mode maps designed to demonstrate the full range of CartoSVG features.

## Feature Coverage

| Feature | Map 1 (Europe GDP) | Map 2 (France Wine) | Map 3 (Japan Density) |
|---|---|---|---|
| Satellite projection | yes | | yes (with tilt) |
| Glow filter | yes (gold on navy) | yes (amber on parchment) | yes (white/blue) |
| ADM1/ADM2 | | yes (FRA-adm1) | yes (JPN-adm1) |
| Continuous coloring | yes (quantize) | | yes (quantile) |
| Categorical coloring | | yes (wine types) | |
| Custom data tooltip | yes | yes | yes |
| Element tooltip/popover | | yes (Bordeaux popover) | yes (Tokyo tooltip + popover) |
| Curves with arrows | | yes (wine routes) | yes (Shinkansen) |
| Freehand drawing | | yes (Bordeaux circle) | |
| Custom font | yes (Inter) | yes (Playfair Display) | yes (Noto Sans JP) |

## Data Files

- `data-europe-gdp.csv` — GDP per capita (nominal USD, IMF 2025 projections), population (UN 2024), capital city for all countries. Sources: IMF WEO, UN World Population Prospects.
- `data-france-wine.csv` — Wine type, top grape, annual production (Mhl), notable appellation for 13 metropolitan French regions. Sources: Vitisphere, DRAAF, regional wine councils.
- `data-japan-density.csv` — Population (2020 census), density, area, capital city for all 47 Japanese prefectures. Source: Japan 2020 National Census.

---

## Map 1: "Europe at a Glance — GDP per Capita"

A luminous globe view centered on Europe, colored by GDP per capita with a continuous scale. A beautiful tooltip reveals country details on hover. This is the "hero" image — it should immediately convey the tool's visual quality.

### Font

Load **Inter** from Bunny Fonts (weight 400 + 700). Clean, modern sans-serif that gives the map a polished data-dashboard feel. Used for: title label, legend title, tooltip text.

### Parameters

| Section | Parameter | Value |
|---|---|---|
| **General** | width | 700 |
| | height | 700 |
| | projection | `satellite` |
| | fieldOfView | 45 |
| | altitude | 2800 |
| **Position** | latitude | 48 |
| | longitude | 12 |
| | rotation | 0 |
| | tilt | 5 |
| **Border** | borderRadius | 50 (full circle — globe look) |
| | borderWidth | 2 |
| | borderColor | `#4a5568` |
| **Background** | seaColor | `#1a2744` (deep navy blue) |
| | showGraticule | true |
| | graticuleStep | 10 |
| | graticuleColor | `#2d4a7a` (subtle blue, barely visible) |
| | graticuleWidth | 0.3 |
| | backgroundNoise | true |

### Glow Filters

| Filter | innerBlur | innerStrength | innerColor | outerBlur | outerStrength | outerColor |
|---|---|---|---|---|---|---|
| **firstGlow** (land) | 3.0 | 0.5 | `#ffd17a` (warm gold) | 4.0 | 0.3 | `#1a2744` (matches sea) |
| **secondGlow** | 0 | 0 | `#ffffff` | 0 | 0 | `#ffffff` |

### Layers

- **Land:** visible, filter = `firstGlow`. The gold inner glow against the dark navy sea creates a striking luminous continent effect.
- **Countries:** visible.

### CSS overrides (baseCss)

| Selector | Property | Value |
|---|---|---|
| `.country` | fill | `#2c3e50` (dark slate — overridden by color scale where data exists) |
| `.country` | stroke | `#1a2744` (same as sea — borders disappear into the ocean) |
| `.country` | stroke-width | `0.5px` |
| `.country.hovered` | fill | keep same logic, slightly lighter |

### Data & Coloring (countries layer)

- **Data file:** `data-europe-gdp.csv` — columns: `name`, `gdp_per_capita`, `population`, `capital`. Covers all 208 countries; disputed territories left empty (show as no-data).
- **Color scale:** `quantize` (continuous feel, 7 breaks)
- **Color column:** `gdp_per_capita`
- **Color palette:** Custom continuous palette: `#1d3557` (dark blue) -> `#457b9d` (teal) -> `#a8dadc` (light cyan) -> `#f1faee` (off-white) -> `#e9c46a` (gold). Cold-to-warm progression that looks natural against the dark sea.
- **No-data color:** enabled, `#1e2a3a` (barely distinguishable from sea — non-European countries fade away)
- **Number of breaks:** 7

### Legend

| Parameter | Value |
|---|---|
| enabled | true |
| direction | `v` (vertical) |
| x | 30 |
| y | 420 |
| rectWidth | 18 |
| rectHeight | 22 |
| lineWidth | 90 |
| maxWidth | 180 |
| noDataInLegend | false |
| significantDigits | 0 |

Legend sample text style: white color (`#e2e8f0`), font-size 11px, font-family `Inter`. Add a label above the legend reading **"GDP per Capita (USD)"** — font-family `Inter`, font-size 13px, font-weight 700, color `#e2e8f0`.

### Tooltip

**Template:**
```html
<div style="text-align: center; padding: 2px; font-family: 'Inter', sans-serif;">
  <div style="font-size: 15px; font-weight: 700; margin-bottom: 6px; color: #1a2744; border-bottom: 2px solid #e9c46a; padding-bottom: 4px;">{name}</div>
  <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px; color: #4a5568;">
    <div><span style="font-weight: 600;">Capital:</span> {capital}</div>
  </div>
  <div style="margin-top: 6px; font-size: 20px; font-weight: 800; color: #264653;">${gdp_per_capita}</div>
  <div style="font-size: 10px; color: #888; margin-top: 2px;">per capita</div>
</div>
```

**Tooltip container style:** background-color `#ffffffee`, border `none`, border-radius `8px`, box-shadow `0 4px 20px #00000030`, padding `10px 14px`, max-width `16rem`, font-family `'Inter', sans-serif`.

### Labels

- Title label top-center: **"Europe — GDP per Capita"**, font-family `Inter`, font-size 18px, font-weight 700, fill `#e2e8f0` (light grey, readable on the dark globe edge).

---

## Map 2: "Les Regions Viticoles de France"

A Mercator close-up of France with ADM1 regions colored categorically by dominant wine type. Curved arrows trace famous wine routes, and a freehand circle highlights Bordeaux. Rich tooltips show region details. Warm, earthy tones evoke a wine atlas.

### Font

Load **Playfair Display** from Bunny Fonts (weight 400 + 700, + 400 italic). Elegant serif with editorial character — evokes wine labels and French typography. Used for: title label, legend title, tooltip content, popover text, wine route labels (italic).

### Parameters

| Section | Parameter | Value |
|---|---|---|
| **General** | width | 650 |
| | height | 750 |
| | projection | `mercator` |
| | altitude (scale) | ~5500 (zoom to frame France with margin) |
| **Position** | latitude | 46.5 |
| | longitude | 2.5 |
| | rotation | 0 |
| | tilt | 0 |
| **Border** | borderRadius | 6 |
| | borderWidth | 1.5 |
| | borderColor | `#8b7355` (warm brown) |
| **Background** | seaColor | `#f5f0e8` (warm parchment/cream) |
| | showGraticule | false |
| | backgroundNoise | true |

### Glow Filters

| Filter | innerBlur | innerStrength | innerColor | outerBlur | outerStrength | outerColor |
|---|---|---|---|---|---|---|
| **firstGlow** (land) | 2.0 | 0.4 | `#d4a76a` (warm amber) | 2.0 | 0.2 | `#f5f0e8` (matches background) |
| **secondGlow** (ADM1) | 1.0 | 0.2 | `#ffffff` | 1.5 | 0.1 | `#c9b896` |

### Layers

- **Land:** visible, filter = `firstGlow`. Gives surrounding countries (Spain, Germany, Italy, UK) a warm subtle glow.
- **Countries:** visible.
- **ADM1 France:** add `FRA-adm1`. Filter = `secondGlow`. This is the main data layer.

### CSS overrides

| Selector | Property | Value |
|---|---|---|
| `.country` | fill | `#e8dcc8` (light parchment — neighboring countries) |
| `.country` | stroke | `#c9b896` |
| `.country` | stroke-width | `0.5px` |
| `.adm` | stroke | `#a08c6e` (warm brown) |
| `.adm` | stroke-width | `0.8px` |
| `.adm.hovered` | stroke | `#6b4226` (dark chocolate) |
| `.adm.hovered` | stroke-width | `1.5px` |
| `.adm.hovered` | fill | `#f0e0c0` |

### Data & Coloring (FRA-adm1 layer)

- **Data file:** `data-france-wine.csv` — columns: `name`, `wine_type`, `top_grape`, `annual_production_mhl`, `notable_appellation`.
  - Regions with significant production get a wine_type; Bretagne, Normandie, and Ile-de-France have no data (show as no-data color).
  - Wine types (categorical values): `Red (Pinot Noir)`, `Red (Cabernet)`, `White (Sparkling)`, `White (Dry)`, `Rosé`, `Sweet`, `Mixed`
  - Assignments: Nouvelle-Aquitaine = Red (Cabernet), Bourgogne = Red (Pinot Noir), Occitanie = Red (Cabernet), Grand Est & Hauts-de-France = White (Sparkling), Centre-Val de Loire = White (Dry), PACA & Corse = Rosé, Pays de la Loire = Sweet, Auvergne-Rhône-Alpes = Mixed
- **Color scale:** `category`
- **Color column:** `wine_type`
- **Custom categorical palette:** `#722f37` (deep burgundy — Red Pinot), `#8b2131` (crimson — Red Cabernet), `#f4e285` (straw gold — White Sparkling), `#e8d5a3` (pale gold — White Dry), `#e8a0b4` (salmon pink — Rose), `#d4a24e` (amber — Sweet), `#b8a88a` (taupe — Mixed)
- **No-data color:** enabled, `#d8cdb8` (muted parchment)

### Legend

| Parameter | Value |
|---|---|
| enabled | true |
| direction | `v` |
| x | 20 |
| y | 480 |
| rectWidth | 16 |
| rectHeight | 16 |
| lineWidth | 110 |
| maxWidth | 160 |
| noDataInLegend | false |

Legend sample text style: color `#4a3728`, font-size 11px, font-family `'Playfair Display', serif`. Add a label above: **"Dominant Wine Style"**, font-family `'Playfair Display', serif`, font-size 13px, font-weight 700, color `#4a3728`.

### Tooltip (FRA-adm1)

**Template:**
```html
<div style="text-align: left; padding: 2px; font-family: 'Playfair Display', serif;">
  <div style="font-size: 14px; font-weight: 700; color: #4a2c17; margin-bottom: 6px; letter-spacing: 0.5px;">{name}</div>
  <div style="font-size: 11px; color: #7a6652; margin-bottom: 4px;">Notable: <em>{notable_appellation}</em></div>
  <div style="display: flex; gap: 8px; align-items: baseline; margin-top: 6px;">
    <span style="font-size: 18px; font-weight: 800; color: #722f37;">{annual_production_mhl}</span>
    <span style="font-size: 10px; color: #999;">M hectoliters/yr</span>
  </div>
  <div style="margin-top: 6px; padding: 3px 6px; background: #f8f4ee; border-radius: 4px; font-size: 11px; color: #5a4a3a; display: inline-block;">{top_grape}</div>
</div>
```

**Tooltip container style:** background `#fffcf5`, border `1px solid #d4c4a8`, border-radius `6px`, box-shadow `0 3px 12px #0000001a`, padding `10px 12px`, max-width `14rem`, font-family `'Playfair Display', serif`.

### Curves (paths)

1. **"Route des Grands Crus"** — A curve from Dijon area to Beaune (within Bourgogne), with a **markerChevron** arrow at the end. Stroke: `#722f37` (burgundy), stroke-width 2, stroke-dasharray 5. Add a small label *"Route des Grands Crus"* in `Playfair Display` italic, 9px, color `#722f37`.

2. **"Bordeaux to Cognac"** — A gentle arc from Bordeaux to Cognac (both in Nouvelle-Aquitaine). Marker: **markerStylized**. Stroke: `#8b2131`, stroke-width 1.5, stroke-dasharray 0 (solid). Label: *"Bordeaux — Cognac"* in `Playfair Display` italic, 9px, color `#8b2131`.

### Freehand Drawing

Draw a freehand circle/oval around the Bordeaux area (approximate coordinates: lon -0.57, lat 44.84) in a loose, hand-drawn style. This highlights the most famous wine region. Style: fill `#722f3715` (very translucent burgundy), stroke `#722f37a0`, stroke-width 1.5.

### Element Annotations

Add a **popover** on the Bordeaux freehand circle (or a nearby shape/label). On click, show:
```html
<div style="font-family: 'Playfair Display', serif; padding: 6px; max-width: 200px;">
  <div style="font-weight: 700; font-size: 14px; color: #4a2c17; margin-bottom: 4px;">Bordeaux</div>
  <div style="font-size: 11px; color: #6b5744; line-height: 1.5;">World's most famous wine region. Home to 60+ appellations including Saint-Emilion, Pauillac, and Margaux. Over 7,000 chateaux produce ~700M bottles annually.</div>
</div>
```

### Labels

- Title label top-center: **"Les Regions Viticoles de France"**, font-family `'Playfair Display', serif`, font-size 18px, font-weight 700, color `#4a2c17`.

---

## Map 3: "Japan — Population Density by Prefecture"

A satellite globe tilted to frame the Japanese archipelago, with ADM1 prefectures colored by population density (continuous). A custom tooltip shows demographics. Element annotations (tooltip + popover) highlight Tokyo. A curved arrow traces the Tokaido Shinkansen route. Clean, modern, slightly cartographic aesthetic.

### Font

Load **Noto Sans JP** from Bunny Fonts (weight 400 + 700). Clean, modern, handles both Latin and Japanese text. Used for: title label, legend title, tooltip, popover, Shinkansen label. Allows mixing in Japanese characters (e.g. "Tokyo — 東京都") to showcase non-Latin font support.

### Parameters

| Section | Parameter | Value |
|---|---|---|
| **General** | width | 600 |
| | height | 750 |
| | projection | `satellite` |
| | fieldOfView | 35 |
| | altitude | 1800 |
| **Position** | latitude | 36 |
| | longitude | 137 |
| | rotation | 0 |
| | tilt | 12 (slight tilt gives depth) |
| **Border** | borderRadius | 12 |
| | borderWidth | 1 |
| | borderColor | `#cbd5e1` |
| **Background** | seaColor | `#e8f0f8` (very light blue, clean and airy) |
| | showGraticule | true |
| | graticuleStep | 5 |
| | graticuleColor | `#d0dcea` (very subtle) |
| | graticuleWidth | 0.3 |
| | backgroundNoise | false |

### Glow Filters

| Filter | innerBlur | innerStrength | innerColor | outerBlur | outerStrength | outerColor |
|---|---|---|---|---|---|---|
| **firstGlow** (land) | 2.5 | 0.3 | `#ffffff` (white — clean, bright land) | 3.0 | 0.2 | `#b8cfe0` (soft blue — blends into sea) |
| **secondGlow** (ADM1) | 0.8 | 0.2 | `#ffffff` | 1.0 | 0.1 | `#94a3b8` |

### Layers

- **Land:** visible, filter = `firstGlow`.
- **Countries:** visible.
- **ADM1 Japan:** add `JPN-adm1`. Filter = `secondGlow`.

### CSS overrides

| Selector | Property | Value |
|---|---|---|
| `.country` | fill | `#f1f5f9` (very light grey) |
| `.country` | stroke | `#cbd5e1` |
| `.country` | stroke-width | `0.3px` |
| `.adm` | fill | `#e2e8f0` (overridden by color scale) |
| `.adm` | stroke | `#94a3b8` |
| `.adm` | stroke-width | `0.5px` |
| `.adm.hovered` | stroke | `#334155` |
| `.adm.hovered` | stroke-width | `1.5px` |

### Data & Coloring (JPN-adm1 layer)

- **Data file:** `data-japan-density.csv` — columns: `name`, `population`, `density_km2`, `capital_city`, `area_km2`. All 47 prefectures with 2020 census data. Range: Tokyo 6,410/km2 down to Hokkaido 63/km2.
- **Color scale:** `quantile` (handles extreme skew — Tokyo/Osaka won't swallow the whole scale)
- **Color column:** `density_km2`
- **Color palette:** `YlOrRd` (Yellow-Orange-Red — classic density/heat palette, intuitive)
- **Number of breaks:** 6
- **No-data color:** enabled, `#f1f5f9` (matches country fill — non-Japan areas invisible)

### Legend

| Parameter | Value |
|---|---|
| enabled | true |
| direction | `v` |
| x | 25 |
| y | 480 |
| rectWidth | 20 |
| rectHeight | 20 |
| lineWidth | 90 |
| maxWidth | 170 |
| noDataInLegend | false |
| significantDigits | 0 |

Legend sample text style: color `#334155`, font-size 11px, font-family `'Noto Sans JP', sans-serif`. Add a label above: **"Pop. Density (per km2)"**, font-family `'Noto Sans JP', sans-serif`, font-size 12px, font-weight 700, color `#1e293b`.

### Tooltip (JPN-adm1)

**Template:**
```html
<div style="padding: 2px; font-family: 'Noto Sans JP', sans-serif;">
  <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 2px;">{name}</div>
  <div style="font-size: 10px; color: #64748b; margin-bottom: 8px;">{capital_city}</div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 11px;">
    <div style="color: #94a3b8;">Population</div><div style="font-weight: 600; color: #334155; text-align: right;">{population}</div>
    <div style="color: #94a3b8;">Density</div><div style="font-weight: 600; color: #dc2626; text-align: right;">{density_km2}/km<sup>2</sup></div>
    <div style="color: #94a3b8;">Area</div><div style="font-weight: 600; color: #334155; text-align: right;">{area_km2} km<sup>2</sup></div>
  </div>
</div>
```

**Tooltip container style:** background `#ffffff`, border `1px solid #e2e8f0`, border-radius `8px`, box-shadow `0 4px 16px #0000000f`, padding `10px 14px`, max-width `13rem`, font-family `'Noto Sans JP', sans-serif`.

### Curves (paths)

**Tokaido Shinkansen route** — A smooth curve from Tokyo (lon 139.7, lat 35.7) through Nagoya (136.9, 35.2) to Osaka (135.5, 34.7). Marker: **markerBasic** arrow at the Osaka end. Stroke: `#dc2626` (red — JR red), stroke-width 2, stroke-dasharray 0 (solid). Add a small label: **"Tokaido Shinkansen — 東海道新幹線"**, font-family `'Noto Sans JP', sans-serif`, font-size 9px, font-style italic, color `#dc2626`, positioned slightly above the curve midpoint.

### Element Annotations

On a **location pin** shape placed at Tokyo (139.7, 35.68):

- **Tooltip** (on hover):
```html
<div style="font-family: 'Noto Sans JP', sans-serif; font-size: 12px; font-weight: 600; color: #1e293b;">Tokyo — 東京都 — 13.9M residents</div>
```

- **Popover** (on click):
```html
<div style="font-family: 'Noto Sans JP', sans-serif; padding: 8px; max-width: 220px;">
  <div style="font-size: 15px; font-weight: 800; color: #1e293b; margin-bottom: 6px;">Tokyo Metropolis — 東京都</div>
  <div style="font-size: 11px; color: #475569; line-height: 1.6;">
    The world's most populous metropolitan area (37M in greater Tokyo). Density reaches 6,400/km<sup>2</sup> — the highest in Japan by a wide margin.<br><br>
    <span style="color: #dc2626; font-weight: 600;">23 special wards (特別区)</span> form the core urban area, once known as Edo.
  </div>
</div>
```

This combines both tooltip AND popover on a single element, demonstrating both annotation types.

### Labels

- Title label top-center: **"Japan — Population Density"**, font-family `'Noto Sans JP', sans-serif`, font-size 16px, font-weight 700, fill `#1e293b`.
- Subtitle just below: **"日本 — 人口密度"**, font-family `'Noto Sans JP', sans-serif`, font-size 12px, font-weight 400, fill `#64748b`.



Here are some genuinely jaw-dropping locations for micro mode showcases, grouped by "wow type":

  ---
  Perfect geometry / star forts (buildings form insane patterns from above)
  - Palmanova, Italy — A Renaissance star-city with 9 perfect bastions radiating from a central hexagon. Streets literally look like a snowflake. Nothing else on Earth looks like this.
  - Naarden, Netherlands — Double-moat star fortress with a tiny town perfectly preserved inside. The moat/rampart geometry is surreal.
  - Bourtange, Netherlands — Similar star fort, but more isolated in flat farmland, making the contrast even more striking.

  Brutalist / architectural oddities
  - Habitat 67, Montreal — Stacked modular concrete cubes, each rotated. From above it looks like a geological formation, not an apartment building.
  - Barbican Estate, London — Brutalist mega-complex: three towers, lakes, elevated walkways, a concert hall. Looks like a city within a city.
  - Rotterdam Cube Houses (Blaak) — The tilted yellow cubes next to the market hall. Very dense, very weird geometry.

  Medieval labyrinths
  - Medina of Fez, Morocco — The densest medieval city on Earth. From above it's a pure labyrinth — no cars, no grid, just organic chaos.
  - Venice, Italy — The canal network at neighborhood scale is unlike anything else. Pick a sestiere like Dorsoduro or Castello rather than the whole city.

  Nature + city collision
  - Mont Saint-Michel, France — A medieval monastery on a tidal island with a tiny spiral village climbing up to it. The tidal mudflat context makes it stunning.
  - Suomenlinna, Helsinki — Chain of sea fortress islands just offshore from the city. Star fortifications surrounded by Baltic sea.
  - Bern Old Town, Switzerland — Perfectly preserved medieval city on a peninsula formed by a tight river loop (the Aare). The river wraps 270° around it.

  Modern spectacle
  - Gardens by the Bay, Singapore — The Supertrees grove + the two glass biome domes. At micro scale, the tree structures are wild.
  - Eixample, Barcelona — Cerdà's perfect octagonal city grid. The chamfered corners give every block an identical octagon shape. Pick a few blocks around Sagrada Família for the contrast of organic cathedral vs. perfect grid.
  - CCTV Headquarters, Beijing — The folded-loop tower footprint surrounded by the CBD cluster.

  ---
  My top 3 picks for maximum "wahoo" with good demo variety:

  1. Palmanova — perfect for showing geometric beauty, labels on bastions, links to the UNESCO page
  2. Medina of Fez — extreme organic contrast to Palmanova, great for showing how micro handles dense irregular geometry
  3. Habitat 67 — architectural icon, compact area, perfect for showing the "add link" feature linking to the building's history

✻ Cooked for 51s


● For 3D buildings, you want density + height variation + interesting silhouettes. The best spots:

  ---
  Classic skyline clusters (tall + dense = dramatic extrusion)
  - Lower Manhattan, New York — The financial district tip is incredibly dense. Woolworth, One WTC, and the surrounding canyons create a stunning 3D forest.
  - Shinjuku, Tokyo — Tokyo City Hall flanked by a cluster of ~50-story towers, all packed within a few blocks. Very dramatic height contrast with the surrounding low-rise city.
  - La Défense, Paris — Europe's most concentrated skyscraper cluster, right next to the Grande Arche. Clean, modern, very geometric from above with tilt.
  - The City of London (Square Mile) — Mix of medieval street layout with Gherkin, Walkie-Talkie, Shard nearby. The height chaos is visually interesting.

  Unusual building shapes that pop in 3D
  - Marina Bay Sands area, Singapore — The three towers with the sky park on top, next to the two glass biome domes. Incredible silhouette even at slight tilt.
  - Hudson Yards, New York — The Vessel sculpture surrounded by brand new mega-towers, all in a tight area. Very clean geometry.
  - Roppongi Hills, Tokyo — Mori Tower + surrounding complex, with good height variation.

  Contrast showcases (dramatic height difference = the most "wow" in 3D)
  - Midtown Manhattan around the Chrysler/Empire State — The street canyons are deep and the Art Deco spires look fantastic extruded.
  - Hong Kong Central — Bank of China Tower, HSBC HQ (the Lego-looking one), and Cheung Kong Center packed together on a tiny coastal strip against the harbor.
  - Downtown Chicago (The Loop) — Dense, varied heights, and the river cutting through creates natural depth. Willis Tower block is particularly good.

  ---
  My top 3 for 3D specifically:

  1. Lower Manhattan tip — unbeatable density, dramatic canyons, iconic
  2. Shinjuku, Tokyo — height contrast with surroundings is extreme and the cluster is compact
  3. Hong Kong Central — HSBC HQ alone is worth it (the building is designed to be seen from below — its legs and atrium read beautifully in 3D)