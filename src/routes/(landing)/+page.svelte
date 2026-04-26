<script lang="ts">
  import { onMount } from "svelte";
  import ShowcaseSlot from "./ShowcaseSlot.svelte";
  import ValueCard from "./ValueCard.svelte";

  const ICONS = {
    paste: `<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>`,
    sparkle: `<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z"/>`,
    compress: `<path d="M13 10V3L4 14h7v7l9-11h-7z"/>`,
    data: `<path d="M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10"/><path d="M3 15h18"/><path d="M7 19l3-3 2 2 4-4 3 3"/>`,
  };

  const microMaps = [
    {
      id: "naarden",
      title: "Naarden, Netherlands",
      description:
        "A perfectly preserved star-shaped fortress from the 1600s — its geometry is so precise it looks drawn with a compass. \nTry clicking the cathedral!",
      highlights: ["Positron palette", "Link on building"],
      src: "/showcase/micro/naarden.svg",
      aspectRatio: "1 / 1",
      gradient: "linear-gradient(135deg, #2d4a35 0%, #3d6645 50%, #4a7a52 100%)",
    },
    {
      id: "manhattan",
      title: "Lower Manhattan, 3D",
      description: "The densest skyline on Earth, rendered with 3D building extrusion.",
      highlights: ["Obsidian palette", "3D buildings"],
      src: "/showcase/micro/manhattan.svg",
      aspectRatio: "1 / 1",
      gradient: "linear-gradient(135deg, #0a1525 0%, #152035 50%, #1e2d4a 100%)",
    },
    {
      id: "bern",
      title: "Bern Old Town, Switzerland",
      description:
        "A medieval city wrapped in a tight river loop — the Aare curves 270° around it.\nClick on the cathedral to have information about it in a popover - created in the editor.",
      highlights: ["Warm palette", "Popover", "Image along curve"],
      src: "/showcase/micro/bern.svg",
      aspectRatio: "1 / 1",
      gradient: "linear-gradient(135deg, #1a2a3a 0%, #2a3d55 50%, #3a5070 100%)",
    },
    {
      id: "sagrada",
      title: "Sagrada Família, Barcelona",
      description:
        "Gaudí's basilica sits at the heart of Eixample's perfect octagonal city grid.\nClick on the label or the basilica to have more info.",
      highlights: ["Gatsby palette", "Popover", "3D buildings"],
      src: "/showcase/micro/sagrada.svg",
      aspectRatio: "1 / 1",
      gradient: "linear-gradient(135deg, #3a2a1a 0%, #5a4a2a 50%, #7a6a3a 100%)",
    },
    {
      id: "macau",
      title: "Macau Peninsula",
      description:
        "Asia's Las Vegas, squeezed onto a tiny peninsula — casino towers next to Portuguese colonial streets.",
      highlights: ["Playful palette", "Custom labels", "Custom markers"],
      src: "/showcase/micro/macau.svg",
      aspectRatio: "1 / 1",
      gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    },
    {
      id: "central-park",
      title: "Central Park, New York",
      description:
        "840 acres of parkland carved out of Manhattan's grid — the sharp edge where the city meets nature.\nHover the park buildings to show the mapello built-in tooltip.",
      highlights: ["Poster palette", "Tooltip", "Custom labels"],
      src: "/showcase/micro/central-park.svg",
      aspectRatio: "1 / 1",
      gradient: "linear-gradient(135deg, #1a2e1a 0%, #2a4a2a 50%, #3a5c3a 100%)",
    },
  ];

  const macroMaps = [
    {
      id: "gdp",
      title: "Europe — GDP per Capita",
      description:
        "A globe centered on Europe, where each country is shaded by wealth per person. Hover any country to see the exact figure. Built from IMF data in minutes.",
      highlights: ["Globe view", "Continuous choropleth", "Hover tooltips"],
      src: "/showcase/macro/gdp.svg",
      aspectRatio: "1 / 1",
      gradient: "radial-gradient(ellipse at 50% 40%, #1d3557 0%, #0d1f3c 50%, #080f1e 100%)",
    },
    {
      id: "france",
      title: "French Wine Regions",
      description:
        "Each French region colored by its dominant wine style. Click the cities for more information in popovers.",
      highlights: ["Mercator", "Categorical choropleth", "Hover tooltips"],
      src: "/showcase/macro/france.svg",
      aspectRatio: "650 / 590",
      gradient: "linear-gradient(160deg, #f5f0e8 0%, #d4c4a0 50%, #c9b28a 100%)",
    },
    {
      id: "japan",
      title: "Japan — Population by Prefecture",
      description:
        "A tilted globe framing Japan, with each prefecture shaded by how crowded it is. Click Tokyo for a rich popover. A high-speed rail route arrow connects the three main cities.",
      highlights: ["Tilted globe", "Click popovers", "Route annotation"],
      src: "/showcase/macro/japan.svg",
      aspectRatio: "430 / 620",
      gradient: "radial-gradient(ellipse at 50% 40%, #e8f0f8 0%, #b8cfe0 50%, #8aacc0 100%)",
    },
    {
      id: "usa",
      title: "US Political Map",
      description: "A clean choropleth of voting patterns by county, using a red-to-blue gradient.",
      highlights: ["Categorical choropleth", "Custom palette"],
      src: "/showcase/macro/usa.svg",
      aspectRatio: "650 / 380",
      gradient: "linear-gradient(135deg, #1a1a3a 0%, #2a2a5a 50%, #1a2a6a 100%)",
    },
    {
      id: "ukraine",
      title: "Ukraine — Population by Region",
      description: "Population across Ukraine's regions.",
      highlights: ["Continuous choropleth", "Graticule", "Background noise"],
      src: "/showcase/macro/ukraine.svg",
      aspectRatio: "1 / 1",
      gradient: "linear-gradient(135deg, #1a2535 0%, #1e3a5a 50%, #1a3050 100%)",
    },
    {
      id: "italia",
      title: "Italy — Cities & Regions",
      description:
        "A stylized map of the Italian peninsula with labeled cities — Roma, Milano, Venezia, Napoli and more. Clean typography and a warm earthy palette.",
      highlights: ["City labels", "Land glow", "Image along curve"],
      src: "/showcase/macro/italia.svg",
      aspectRatio: "600 / 660",
      gradient: "linear-gradient(160deg, #f3efec 0%, #e8dfc8 50%, #d4c8a8 100%)",
    },
    {
      id: "we-work",
      title: "Where We Work",
      description: "A world map with markers showing a company's offices around the world.",
      highlights: ["Categorical choropleth", "Custom markers and labels"],
      src: "/showcase/macro/we-work.svg",
      aspectRatio: "710 / 520",
      gradient: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #3a2a1a 100%)",
    },
  ];

  let activeMicro = $state(0);
  let activeMacro = $state(0);
  let microKey = $state(0);
  let macroKey = $state(0);

  function selectMicro(i: number) {
    if (i === activeMicro) return;
    activeMicro = i;
    microKey++;
  }
  function selectMacro(i: number) {
    if (i === activeMacro) return;
    activeMacro = i;
    macroKey++;
  }

  onMount(() => {
    const els = document.querySelectorAll<HTMLElement>(".lp-reveal");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) (e.target as HTMLElement).classList.add("visible");
        }),
      { threshold: 0.1 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  });
</script>

<svelte:head>
  <title>Mapello — Design gorgeous interactive SVG maps</title>
  <meta
    name="description"
    content="Design beautiful, interactive maps and export them as a single file you can drop into any website — no coding required."
  />
  <meta property="og:title" content="Mapello — SVG Map Designer" />
  <meta property="og:description" content="Design beautiful maps and embed them anywhere with a simple copy-paste." />
  <meta property="og:type" content="website" />
  <link rel="preconnect" href="https://fonts.bunny.net" />
  <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700,800&display=swap" rel="stylesheet" />
  <link href="https://fonts.bunny.net/css?family=cormorant-garamond:400,400i,600,600i&display=swap" rel="stylesheet" />
</svelte:head>

<!-- ═══════════════════════════════════════ HERO ═══════════════════════════════════════ -->
<section class="hero">
  <svg class="hero-globe" viewBox="0 0 600 600" fill="none" aria-hidden="true">
    <defs>
      <clipPath id="hero-clip"><circle cx="300" cy="300" r="284" /></clipPath>
    </defs>
    <circle cx="300" cy="300" r="284" stroke="white" stroke-width="0.7" stroke-opacity="0.6" />
    <g clip-path="url(#hero-clip)">
      <ellipse cx="300" cy="300" rx="284" ry="76" stroke="#c9943a" stroke-width="1.1" stroke-opacity="0.7" />
      <ellipse cx="300" cy="216" rx="246" ry="66" stroke="white" stroke-width="0.5" stroke-opacity="0.35" />
      <ellipse cx="300" cy="384" rx="246" ry="66" stroke="white" stroke-width="0.5" stroke-opacity="0.35" />
      <ellipse cx="300" cy="144" rx="142" ry="38" stroke="white" stroke-width="0.4" stroke-opacity="0.22" />
      <ellipse cx="300" cy="456" rx="142" ry="38" stroke="white" stroke-width="0.4" stroke-opacity="0.22" />
      <line x1="300" y1="16" x2="300" y2="584" stroke="#c9943a" stroke-width="1" stroke-opacity="0.6" />
      <ellipse cx="300" cy="300" rx="142" ry="284" stroke="white" stroke-width="0.5" stroke-opacity="0.28" />
      <ellipse cx="300" cy="300" rx="246" ry="284" stroke="white" stroke-width="0.4" stroke-opacity="0.2" />
    </g>
    <g stroke="#c9943a" stroke-width="1.5" stroke-opacity="0.5">
      <line x1="300" y1="6" x2="300" y2="20" />
      <line x1="300" y1="580" x2="300" y2="594" />
      <line x1="6" y1="300" x2="20" y2="300" />
      <line x1="580" y1="300" x2="594" y2="300" />
    </g>
  </svg>

  <div class="l-container hero-inner">
    <div class="hero-text">
      <div class="hero-eyebrow lp-reveal">48°52′N · 2°21′E — Mapello</div>
      <h1 class="hero-headline lp-reveal">
        The map tool<br /><em>I always wanted.</em>
      </h1>
      <p class="hero-sub lp-reveal">
        Too technical or too ugly — that was always the trade-off. Design a beautiful, interactive map and export a
        single self-contained SVG. Paste it anywhere. No code.
      </p>
      <div class="hero-actions lp-reveal">
        <a href="/app" class="btn-primary btn-large">Start designing</a>
        <a href="#showcase" class="btn-text-link">See examples</a>
      </div>
      <div class="hero-trust lp-reveal">
        <span>Free to start</span>
        <span class="trust-dot">·</span>
        <span>No credit card</span>
        <span class="trust-dot">·</span>
        <span>Works forever</span>
      </div>
    </div>
  </div>
</section>

<!-- ════════════════════════════════ MANIFESTO ════════════════════════════════ -->
<section class="manifesto">
  <div class="l-container">
    <div class="manifesto-header lp-reveal">
      <span class="section-tag">Our principles</span>
      <h2>Maps should be beautiful.<br /><em>And they should just work.</em></h2>
    </div>
    <div class="manifesto-body">
      <div class="lp-reveal">
        <ValueCard
          number="01"
          title="One file, works everywhere"
          description="Your map exports as a single self-contained file. Paste it into your website, blog, or presentation — it just works. No plugins, no accounts, no dependencies."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          number="02"
          title="Looks great out of the box"
          description="Thoughtful defaults, curated color palettes, and subtle effects mean your map looks polished before you've changed a single setting."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          number="03"
          title="Any projection, any scale"
          description="Frame a continent as a globe, zoom into a single neighborhood, or tilt the view for depth. Every map style — from street level to world overview — in a few clicks."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          number="04"
          title="Your spreadsheet becomes a map"
          description="Drop in a CSV and Mapello colors your map automatically — by country, by region, by any column you choose. Add a legend in one click. No code required."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          number="05"
          title="Annotate, link, and explain"
          description="Draw arrows, add labels in any font, attach a popup that opens on click. Every annotation — freehand, text, shape — exports with the map, interactive and self-contained."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          number="06"
          title="No lock-in. Ever."
          description="There is no Mapello inside your exported file — just SVG. Cancel your account tomorrow and every map you've ever exported keeps working, unchanged, forever."
        />
      </div>
    </div>
  </div>
</section>

<!-- ════════════════════════════ MICRO SHOWCASE ══════════════════════════════════════ -->
<section id="showcase" class="showcase showcase-dark">
  <div class="l-container">
    <div class="section-header lp-reveal">
      <span class="section-tag">City maps</span>
      <h2>Street-level maps that stop the scroll</h2>
      <p>
        Zoom into any city or neighborhood. Customize colors, highlight buildings, add 3D, and export a map that looks
        like it came from a design studio.
      </p>
    </div>

    <div class="theater lp-reveal">
      <div class="theater-stage">
        <div class="theater-display">
          {#key microKey}
            <div class="theater-map fade-in">
              <ShowcaseSlot
                title={microMaps[activeMicro].title}
                description=""
                src={microMaps[activeMicro].src}
                aspectRatio={microMaps[activeMicro].aspectRatio}
                placeholderGradient={microMaps[activeMicro].gradient}
              />
            </div>
          {/key}
        </div>
        <div class="theater-info">
          {#key microKey}
            <div class="fade-in">
              <h3 class="theater-title">{microMaps[activeMicro].title}</h3>
              <p class="theater-desc">{microMaps[activeMicro].description}</p>
              <div class="theater-techniques">
                {#each microMaps[activeMicro].highlights as h}
                  <span class="technique-badge">{h}</span>
                {/each}
              </div>
            </div>
          {/key}
        </div>
      </div>
      <div class="theater-tabs">
        {#each microMaps as map, i}
          <button class="theater-tab" class:active={activeMicro === i} onclick={() => selectMicro(i)}>
            <span class="tab-index">{String(i + 1).padStart(2, "0")}</span>
            <span class="tab-label">{map.title}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════ MACRO SHOWCASE ════════════════════════════════════ -->
<section class="showcase showcase-light">
  <div class="l-container">
    <div class="section-header lp-reveal">
      <span class="section-tag">World maps</span>
      <h2>Turn your data into a map in minutes</h2>
      <p>
        Country-by-country comparisons, election maps, trade flows, demographics — if you have a spreadsheet, Mapello
        can color a world map from it.
      </p>
    </div>

    <div class="theater lp-reveal">
      <div class="theater-stage">
        <div class="theater-display">
          {#key macroKey}
            <div class="theater-map fade-in">
              <ShowcaseSlot
                title={macroMaps[activeMacro].title}
                description=""
                src={macroMaps[activeMacro].src}
                aspectRatio={macroMaps[activeMacro].aspectRatio}
                placeholderGradient={macroMaps[activeMacro].gradient}
              />
            </div>
          {/key}
        </div>
        <div class="theater-info">
          {#key macroKey}
            <div class="fade-in">
              <h3 class="theater-title">{macroMaps[activeMacro].title}</h3>
              <p class="theater-desc">{macroMaps[activeMacro].description}</p>
              <div class="theater-techniques">
                {#each macroMaps[activeMacro].highlights as h}
                  <span class="technique-badge">{h}</span>
                {/each}
              </div>
            </div>
          {/key}
        </div>
      </div>
      <div class="theater-tabs">
        {#each macroMaps as map, i}
          <button class="theater-tab" class:active={activeMacro === i} onclick={() => selectMacro(i)}>
            <span class="tab-index">{String(i + 1).padStart(2, "0")}</span>
            <span class="tab-label">{map.title}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
</section>

<!-- ════════════════════════════════ COMPARISON ══════════════════════════════════════ -->
<section class="comparison">
  <div class="l-container">
    <div class="section-header lp-reveal">
      <span class="section-tag">How it compares</span>
      <h2>Where Mapello stands apart</h2>
      <p>
        Other tools make you choose between ease and quality — or tie your maps to their servers forever. Mapello
        doesn't.
      </p>
    </div>

    <!-- ── Macro ── -->
    <div class="comparison-block lp-reveal">
      <h3 class="comparison-group-title">Country, region &amp; world maps</h3>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="compare-col-feature"></th>
              <th class="compare-col-us">Mapello</th>
              <th>Hosted chart tools<br /><span class="col-sub">Datawrapper, Flourish…</span></th>
              <th>Code libraries<br /><span class="col-sub">D3, Leaflet, Highcharts…</span></th>
              <th>Static generators<br /><span class="col-sub">Mapchart, QGIS export…</span></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="compare-feature">Single self-contained SVG export</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="8" x2="12.5" y2="8" stroke-width="2" stroke-linecap="round" /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Works forever, no server dependency</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Interactive after export (tooltips, popovers)</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="8" x2="12.5" y2="8" stroke-width="2" stroke-linecap="round" /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">No code required</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Data-bound coloring from a CSV</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="8" x2="12.5" y2="8" stroke-width="2" stroke-linecap="round" /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Rich annotations (labels, freehand, shapes)</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="8" x2="12.5" y2="8" stroke-width="2" stroke-linecap="round" /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="8" x2="12.5" y2="8" stroke-width="2" stroke-linecap="round" /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Free to start, no watermark</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="8" x2="12.5" y2="8" stroke-width="2" stroke-linecap="round" /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Micro ── -->
    <div class="comparison-block lp-reveal">
      <h3 class="comparison-group-title">City &amp; street-level maps</h3>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="compare-col-feature"></th>
              <th class="compare-col-us">Mapello</th>
              <th>Map platforms<br /><span class="col-sub">Mapbox Studio, Felt…</span></th>
              <th>Code libraries<br /><span class="col-sub">Prettymaps (Python)…</span></th>
              <th>Embed widgets<br /><span class="col-sub">Google My Maps…</span></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="compare-feature">Single self-contained SVG export</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="8" x2="12.5" y2="8" stroke-width="2" stroke-linecap="round" /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Works forever, no server dependency</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Interactive after export (tooltips, popovers)</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="8" x2="12.5" y2="8" stroke-width="2" stroke-linecap="round" /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">No install, in-browser editing</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Stylized, fully customizable look</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">3D building extrusion</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Free to start, no watermark</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line x1="3.5" y1="8" x2="12.5" y2="8" stroke-width="2" stroke-linecap="round" /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-check ci-check-muted" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="compare-legend lp-reveal">
      <span
        ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
          ><polyline
            points="2.5 8.5 6.5 12.5 13.5 4"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        > Fully supported</span
      >
      <span
        ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
          ><line x1="3.5" y1="8" x2="12.5" y2="8" stroke-width="2" stroke-linecap="round" /></svg
        > Partial / depends</span
      >
      <span
        ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
          ><line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke-width="1.8" stroke-linecap="round" /><line
            x1="12.5"
            y1="3.5"
            x2="3.5"
            y2="12.5"
            stroke-width="1.8"
            stroke-linecap="round"
          /></svg
        > Not supported</span
      >
    </div>
  </div>
</section>

<!-- ══════════════════════════════════ STATS STRIP ═══════════════════════════════════ -->
<section class="stats">
  <div class="l-container">
    <div class="stats-grid lp-reveal">
      <div class="stat">
        <span class="stat-value">0</span>
        <span class="stat-label">external dependencies in your export</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-value">&lt; 100 KB</span>
        <span class="stat-label">typical map, complete and ready</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-value">&#x221e;</span>
        <span class="stat-label">years it works · no servers needed</span>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════ PRICING ══════════════════════════════════════ -->
<section class="pricing" id="pricing">
  <div class="l-container">
    <div class="section-header lp-reveal">
      <span class="section-tag">Pricing</span>
      <h2>Start free. Pay when you're ready.</h2>
      <p>
        Design as much as you want for free. Export your first 3 maps with no account needed. Upgrade when your project
        grows.
      </p>
    </div>

    <div class="pricing-grid lp-reveal">
      <!-- Free -->
      <div class="pricing-card pricing-free">
        <div class="pricing-card-head">
          <h3>Free</h3>
          <div class="pricing-amount">
            <span class="pricing-currency">$</span><span class="pricing-value">0</span>
          </div>
          <span class="pricing-period">no credit card needed</span>
        </div>
        <ul class="pricing-features">
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >Full editor — every feature
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >3 exported maps
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >Saves in your browser
          </li>
        </ul>
        <a href="/app" class="btn-outline">Get started free</a>
      </div>

      <!-- Pro Monthly -->
      <div class="pricing-card pricing-pro">
        <div class="pricing-popular">Most popular</div>
        <div class="pricing-card-head">
          <h3>Pro</h3>
          <div class="pricing-amount">
            <span class="pricing-currency">$</span><span class="pricing-value">15</span>
          </div>
          <span class="pricing-period">per month</span>
        </div>
        <ul class="pricing-features">
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >Everything in Free
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            ><strong>Unlimited</strong> exported maps
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            ><strong>Unlimited</strong> saved projects
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >Priority support
          </li>
        </ul>
        <a href="/app" class="btn-primary btn-wide">Start free trial</a>
      </div>

      <!-- Annual -->
      <div class="pricing-card pricing-annual">
        <div class="pricing-card-head">
          <h3>Pro — Annual</h3>
          <div class="pricing-amount">
            <span class="pricing-currency">$</span><span class="pricing-value">150</span>
          </div>
          <span class="pricing-period">per year</span>
        </div>
        <div class="pricing-save">Save $30 — 2 months free</div>
        <ul class="pricing-features">
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >Everything in Pro
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >One payment per year
          </li>
        </ul>
        <a href="/app" class="btn-outline">Choose annual</a>
      </div>
    </div>
  </div>
</section>

<!-- ════════════════════════════════ FINAL CTA ═══════════════════════════════════════ -->
<section class="cta">
  <div class="cta-compass" aria-hidden="true">
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="94" stroke="currentColor" stroke-width="0.8" stroke-opacity="0.6" />
      <circle cx="100" cy="100" r="72" stroke="currentColor" stroke-width="0.5" stroke-opacity="0.35" />
      <circle cx="100" cy="100" r="50" stroke="currentColor" stroke-width="0.4" stroke-opacity="0.2" />
      <line x1="100" y1="6" x2="100" y2="28" stroke="currentColor" stroke-width="1.2" />
      <line x1="100" y1="172" x2="100" y2="194" stroke="currentColor" stroke-width="1.2" />
      <line x1="6" y1="100" x2="28" y2="100" stroke="currentColor" stroke-width="1.2" />
      <line x1="172" y1="100" x2="194" y2="100" stroke="currentColor" stroke-width="1.2" />
      <line
        x1="33"
        y1="33"
        x2="167"
        y2="167"
        stroke="currentColor"
        stroke-width="0.5"
        stroke-dasharray="3 5"
        stroke-opacity="0.45"
      />
      <line
        x1="167"
        y1="33"
        x2="33"
        y2="167"
        stroke="currentColor"
        stroke-width="0.5"
        stroke-dasharray="3 5"
        stroke-opacity="0.45"
      />
      <polygon points="100,8 105,42 100,36 95,42" fill="currentColor" />
      <polygon points="100,192 105,158 100,164 95,158" fill="currentColor" fill-opacity="0.45" />
      <polygon points="192,100 158,105 164,100 158,95" fill="currentColor" fill-opacity="0.45" />
      <polygon points="8,100 42,105 36,100 42,95" fill="currentColor" fill-opacity="0.45" />
      <circle cx="100" cy="100" r="4" fill="currentColor" />
      <circle cx="100" cy="100" r="2" fill="currentColor" fill-opacity="0.5" />
      <g stroke="currentColor" stroke-width="1" stroke-opacity="0.4">
        <line x1="166" y1="34" x2="161" y2="39" />
        <line x1="34" y1="34" x2="39" y2="39" />
        <line x1="166" y1="166" x2="161" y2="161" />
        <line x1="34" y1="166" x2="39" y2="161" />
      </g>
    </svg>
  </div>
  <div class="l-container">
    <div class="cta-inner lp-reveal">
      <span class="section-tag">Get started</span>
      <h2>Your first 3 maps are on us.</h2>
      <p>Open the editor and begin.<br /><em>No account needed.</em></p>
      <a href="/app" class="btn-primary btn-large">Start designing</a>
      <span class="cta-note">Free · No credit card · Works forever</span>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════ FOOTER ═══════════════════════════════════════ -->
<footer>
  <div class="l-container footer-inner">
    <div class="footer-brand-col">
      <span class="footer-logo">Mapello</span>
      <span class="footer-tagline">Maps you'll be proud to embed.</span>
      <span class="footer-coords">48°52′N &nbsp; 2°21′E</span>
    </div>
    <div class="footer-links-col">
      <span class="footer-col-title">Product</span>
      <a href="/app">Editor</a>
      <a href="#showcase">Examples</a>
      <a href="#pricing">Pricing</a>
    </div>
    <div class="footer-links-col">
      <span class="footer-col-title">Company</span>
      <a href="#">About</a>
      <a href="#">Privacy</a>
      <a href="#">Terms</a>
      <a href="#">Contact</a>
    </div>
  </div>
  <div class="l-container footer-bottom">
    <span>&copy; 2026 Mapello. Made with care.</span>
  </div>
</footer>

<style>
  /* ── Scroll animation ── */
  :global(.lp-reveal) {
    animation: scrollReveal 0.65s ease both;
    animation-play-state: paused;
  }
  :global(.lp-reveal.visible) {
    animation-play-state: running;
  }
  @keyframes scrollReveal {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .fade-in {
    animation: fadeSlideIn 0.4s ease both;
  }
  @keyframes fadeSlideIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── Shared section layout ── */
  section {
    position: relative;
    overflow: hidden;
  }

  .section-header {
    text-align: center;
    max-width: 620px;
    margin: 0 auto 3.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.85rem;
  }
  .section-header h2 {
    font-family: var(--font-serif);
    font-size: clamp(1.7rem, 3.2vw, 2.4rem);
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }
  .section-header p {
    font-size: 1rem;
    line-height: 1.72;
  }

  /* ── Section tag (gold across all sections) ── */
  .section-tag {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-gold);
    background: var(--color-gold-soft);
    border: 1px solid var(--color-gold-border);
    padding: 0.28rem 0.85rem;
    border-radius: var(--radius-pill);
    width: fit-content;
  }

  /* ── Buttons ── */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.82rem 2rem;
    background: var(--color-gold);
    color: var(--color-ink);
    font-weight: 600;
    font-size: 0.9rem;
    letter-spacing: 0.01em;
    border-radius: 4px;
    transition:
      background var(--transition),
      transform var(--transition),
      box-shadow var(--transition);
  }
  .btn-primary:hover {
    background: var(--color-gold-hover);
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(201, 148, 58, 0.38);
  }
  .btn-large {
    padding: 1rem 2.5rem;
    font-size: 0.95rem;
  }
  .btn-wide {
    width: 100%;
  }
  .btn-text-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: rgba(255, 255, 255, 0.36);
    transition: color var(--transition);
  }
  .btn-text-link::after {
    content: "→";
    transition: transform var(--transition);
  }
  .btn-text-link:hover {
    color: rgba(255, 255, 255, 0.65);
  }
  .btn-text-link:hover::after {
    transform: translateX(3px);
  }
  .btn-outline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0.75rem 1.5rem;
    color: var(--color-parchment-text);
    font-weight: 600;
    font-size: 0.9rem;
    border-radius: var(--radius-pill);
    border: 1.5px solid rgba(160, 120, 60, 0.25);
    transition:
      border-color var(--transition),
      background var(--transition);
  }
  .btn-outline:hover {
    border-color: var(--color-gold);
    background: var(--color-gold-soft);
  }

  /* ── Hero ── */
  .hero {
    background-color: var(--color-ink);
    background-image:
      radial-gradient(circle, rgba(255, 255, 255, 0.055) 1px, transparent 1px),
      radial-gradient(ellipse at 96% 4%, rgba(42, 125, 110, 0.12) 0%, transparent 50%),
      radial-gradient(ellipse at 4% 96%, rgba(201, 148, 58, 0.07) 0%, transparent 50%);
    background-size:
      30px 30px,
      100% 100%,
      100% 100%;
    padding: 9rem 0 8rem;
    display: flex;
    align-items: center;
  }
  .hero-globe {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(86vw, 600px);
    opacity: 0.082;
    pointer-events: none;
  }
  .hero-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;
  }
  .hero-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.65rem;
    max-width: 720px;
  }
  .hero-eyebrow {
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-gold);
    opacity: 0.75;
  }
  .hero-headline {
    font-family: var(--font-serif);
    font-size: clamp(3rem, 5.5vw, 5.5rem);
    font-weight: 400;
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: rgba(255, 255, 255, 0.85);
  }
  .hero-headline em {
    font-style: italic;
    font-weight: 600;
    color: #fff;
    text-decoration: underline;
    text-decoration-color: rgba(201, 148, 58, 0.45);
    text-underline-offset: 5px;
    text-decoration-thickness: 1px;
  }
  .hero-sub {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.4);
    line-height: 1.85;
    max-width: 520px;
  }
  .hero-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
  }
  .hero-trust {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    font-size: 0.74rem;
    color: rgba(255, 255, 255, 0.24);
    font-weight: 500;
    letter-spacing: 0.01em;
  }
  .trust-dot {
    opacity: 0.5;
  }

  /* ── Manifesto ── */
  .manifesto {
    background-color: var(--color-parchment);
    background-image:
      repeating-radial-gradient(
        circle at 22% 32%,
        transparent 0,
        transparent 100px,
        rgba(160, 120, 60, 0.065) 101px,
        transparent 102px
      ),
      repeating-radial-gradient(
        circle at 78% 68%,
        transparent 0,
        transparent 130px,
        rgba(160, 120, 60, 0.045) 131px,
        transparent 132px
      );
    padding: 4.5rem 0 3.5rem;
  }
  .manifesto-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 0;
    max-width: 640px;
  }
  .manifesto-header h2 {
    font-family: var(--font-serif);
    font-size: clamp(1.8rem, 3.5vw, 2.6rem);
    font-weight: 600;
    line-height: 1.2;
    color: var(--color-parchment-text);
    letter-spacing: 0.01em;
  }
  .manifesto-header h2 em {
    font-style: italic;
    color: var(--color-parchment-muted);
  }
  .manifesto-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 4rem;
  }

  /* ── Showcase ── */
  .showcase {
    padding: 5.5rem 0;
  }
  .showcase :global(.l-container) {
    max-width: 1440px;
    padding: 0 2rem;
  }

  .showcase-dark {
    background-color: var(--color-ink-mid);
    background-image: radial-gradient(circle, rgba(255, 255, 255, 0.048) 1px, transparent 1px);
    background-size: 30px 30px;
  }
  .showcase-dark .section-header h2 {
    color: var(--color-text-on-dark);
  }
  .showcase-dark .section-header p {
    color: var(--color-text-on-dark-muted);
  }

  .showcase-light {
    background-color: var(--color-parchment);
    background-image:
      repeating-radial-gradient(
        circle at 30% 55%,
        transparent 0,
        transparent 120px,
        rgba(160, 120, 60, 0.05) 121px,
        transparent 122px
      ),
      repeating-radial-gradient(
        circle at 70% 20%,
        transparent 0,
        transparent 90px,
        rgba(160, 120, 60, 0.04) 91px,
        transparent 92px
      );
  }
  .showcase-light .section-header h2 {
    color: var(--color-parchment-text);
  }
  .showcase-light .section-header p {
    color: var(--color-parchment-muted);
  }

  /* Theater */
  .theater-stage {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 3rem;
    align-items: center;
    margin-bottom: 2rem;
  }
  .theater-display {
    overflow: hidden;
  }
  .theater-display :global(.slot-wrapper) {
    gap: 0;
  }
  .theater-display :global(.slot-caption) {
    display: none;
  }
  .theater-display :global(.slot-frame) {
    border-radius: 0;
  }
  .theater-display :global(svg) {
    overflow: visible;
  }

  .theater-info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .theater-title {
    font-family: var(--font-serif);
    font-size: 1.65rem;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }
  .showcase-dark .theater-title {
    color: var(--color-text-on-dark);
  }
  .showcase-light .theater-title {
    color: var(--color-parchment-text);
  }

  .theater-desc {
    font-size: 0.95rem;
    line-height: 1.75;
    white-space: pre-line;
  }
  .showcase-dark .theater-desc {
    color: var(--color-text-on-dark-muted);
  }
  .showcase-light .theater-desc {
    color: var(--color-parchment-muted);
  }

  .theater-techniques {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .technique-badge {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    padding: 0.28rem 0.7rem;
    border-radius: var(--radius-pill);
    background: transparent;
  }
  .showcase-dark .technique-badge {
    color: rgba(255, 255, 255, 0.42);
    border: 1px solid rgba(255, 255, 255, 0.14);
  }
  .showcase-light .technique-badge {
    color: var(--color-parchment-muted);
    border: 1px solid var(--color-gold-border);
  }

  .theater-tabs {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  .theater-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 1rem;
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    font-weight: 500;
    transition:
      background var(--transition),
      color var(--transition),
      border-color var(--transition);
    border: 1px solid transparent;
    cursor: pointer;
    background: none;
  }
  .showcase-dark .theater-tab {
    color: var(--color-text-on-dark-muted);
  }
  .showcase-dark .theater-tab:hover {
    background: rgba(255, 255, 255, 0.055);
  }
  .showcase-dark .theater-tab.active {
    background: rgba(201, 148, 58, 0.1);
    color: var(--color-gold);
    border-color: var(--color-gold-border);
  }
  .showcase-light .theater-tab {
    color: var(--color-parchment-muted);
  }
  .showcase-light .theater-tab:hover {
    background: rgba(160, 120, 60, 0.07);
  }
  .showcase-light .theater-tab.active {
    background: rgba(201, 148, 58, 0.1);
    color: var(--color-gold);
    border-color: var(--color-gold-border);
  }

  .tab-index {
    font-size: 0.68rem;
    font-weight: 700;
    opacity: 0.38;
    letter-spacing: 0.05em;
    font-variant-numeric: tabular-nums;
  }
  .theater-tab.active .tab-index {
    opacity: 1;
    color: var(--color-gold);
  }
  .tab-label {
    white-space: nowrap;
  }

  /* ── Comparison ── */
  .comparison {
    background-color: #111;
    background-image:
      radial-gradient(circle, rgba(255, 255, 255, 0.038) 1px, transparent 1px),
      radial-gradient(ellipse at 90% 8%, rgba(201, 148, 58, 0.07) 0%, transparent 50%);
    background-size:
      30px 30px,
      100% 100%;
    padding: 5.5rem 0;
  }
  .comparison .section-header h2 {
    color: var(--color-text-on-dark);
  }
  .comparison .section-header p {
    color: var(--color-text-on-dark-muted);
  }
  .comparison-block {
    margin-bottom: 3.5rem;
  }
  .comparison-group-title {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.3);
    margin-bottom: 1rem;
  }
  .compare-table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: var(--radius-md);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }
  .compare-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
    min-width: 560px;
  }
  .compare-table thead tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .compare-table thead th {
    padding: 0.9rem 1.1rem;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    vertical-align: bottom;
    line-height: 1.4;
  }
  .compare-table thead th.compare-col-feature {
    text-align: left;
    width: 34%;
  }
  .col-sub {
    display: block;
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.03em;
    color: rgba(255, 255, 255, 0.2);
    margin-top: 0.25rem;
    text-transform: none;
  }
  .compare-table tbody tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .compare-table tbody tr:last-child {
    border-bottom: none;
  }
  .compare-table tbody td {
    padding: 0.8rem 1.1rem;
    text-align: center;
    vertical-align: middle;
    color: rgba(255, 255, 255, 0.5);
  }
  .compare-table tbody td.compare-feature {
    text-align: left;
    color: rgba(255, 255, 255, 0.72);
    font-weight: 500;
    font-size: 0.85rem;
  }
  .compare-table th.compare-col-us,
  .compare-table td.compare-col-us {
    background: rgba(201, 148, 58, 0.09);
    color: var(--color-gold);
    font-weight: 600;
  }
  .compare-table thead th.compare-col-us {
    color: #d4a050;
    letter-spacing: 0.08em;
  }
  .ci-check,
  .ci-cross,
  .ci-dash {
    width: 18px;
    height: 18px;
    display: inline-block;
    vertical-align: middle;
  }
  .ci-check {
    stroke: var(--color-gold);
  }
  .ci-check.ci-check-muted {
    stroke: rgba(255, 255, 255, 0.38);
  }
  .ci-cross {
    stroke: rgba(255, 255, 255, 0.2);
  }
  .ci-dash {
    stroke: rgba(255, 255, 255, 0.32);
  }
  .compare-legend {
    display: flex;
    align-items: center;
    gap: 1.75rem;
    flex-wrap: wrap;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.28);
    margin-top: 1.5rem;
    padding-left: 0.25rem;
  }
  .compare-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .compare-legend .ci-check {
    stroke: rgba(255, 255, 255, 0.38);
  }

  /* ── Stats ── */
  .stats {
    background-color: var(--color-ink);
    background-image:
      repeating-radial-gradient(
        circle at 30% 50%,
        transparent 0,
        transparent 80px,
        rgba(201, 148, 58, 0.055) 81px,
        transparent 82px
      ),
      repeating-radial-gradient(
        circle at 70% 50%,
        transparent 0,
        transparent 110px,
        rgba(201, 148, 58, 0.04) 111px,
        transparent 112px
      );
    padding: 5rem 0;
    border-top: 1px solid rgba(201, 148, 58, 0.1);
    border-bottom: 1px solid rgba(201, 148, 58, 0.1);
  }
  .stats-grid {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4rem;
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    text-align: center;
  }
  .stat-value {
    font-family: var(--font-serif);
    font-size: clamp(3.5rem, 6vw, 5.5rem);
    font-weight: 400;
    color: var(--color-gold);
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .stat-label {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.35);
    font-weight: 400;
    max-width: 160px;
    line-height: 1.55;
  }
  .stat-divider {
    width: 1px;
    height: 4rem;
    background: rgba(201, 148, 58, 0.22);
    flex-shrink: 0;
  }

  /* ── Pricing ── */
  .pricing {
    background-color: var(--color-parchment-light);
    background-image: repeating-radial-gradient(
      circle at 60% 40%,
      transparent 0,
      transparent 140px,
      rgba(160, 120, 60, 0.04) 141px,
      transparent 142px
    );
    padding: 6rem 0;
  }
  .pricing .section-header h2 {
    color: var(--color-parchment-text);
  }
  .pricing .section-header p {
    color: var(--color-parchment-muted);
  }
  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    max-width: 960px;
    margin: 0 auto;
  }
  .pricing-card {
    display: flex;
    flex-direction: column;
    padding: 2rem 1.75rem;
    border-radius: var(--radius-lg);
    border: 1.5px solid rgba(160, 120, 60, 0.2);
    background: var(--color-white);
    position: relative;
  }
  .pricing-pro {
    border-color: var(--color-gold);
    box-shadow:
      0 0 0 1px var(--color-gold),
      var(--shadow-md);
  }
  .pricing-popular {
    position: absolute;
    top: -0.7rem;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-ink);
    background: var(--color-gold);
    padding: 0.25rem 0.9rem;
    border-radius: var(--radius-pill);
    white-space: nowrap;
  }
  .pricing-card-head {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(160, 120, 60, 0.15);
  }
  .pricing-card-head h3 {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-parchment-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .pricing-amount {
    display: flex;
    align-items: baseline;
    gap: 0.05rem;
  }
  .pricing-currency {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--color-parchment-muted);
    align-self: flex-start;
    margin-top: 0.55rem;
  }
  .pricing-value {
    font-family: var(--font-serif);
    font-size: 4rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--color-parchment-text);
    line-height: 1;
  }
  .pricing-pro .pricing-value {
    color: var(--color-gold);
  }
  .pricing-period {
    font-size: 0.8rem;
    color: var(--color-parchment-muted);
    font-weight: 400;
  }
  .pricing-save {
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--color-gold);
    background: var(--color-gold-soft);
    border: 1px solid var(--color-gold-border);
    padding: 0.3rem 0.7rem;
    border-radius: var(--radius-pill);
    width: fit-content;
    margin-bottom: 0.75rem;
  }
  .pricing-features {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    margin-bottom: 1.5rem;
    flex-grow: 1;
  }
  .pricing-features li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.875rem;
    color: var(--color-parchment-muted);
    line-height: 1.4;
  }
  .pricing-features svg {
    width: 1rem;
    height: 1rem;
    color: var(--color-gold);
    flex-shrink: 0;
  }

  /* ── CTA ── */
  .cta {
    background-color: var(--color-ink);
    background-image:
      radial-gradient(ellipse at 12% 50%, rgba(201, 148, 58, 0.09) 0%, transparent 55%),
      radial-gradient(circle, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size:
      100% 100%,
      30px 30px;
    padding: 7rem 0 6rem;
  }
  .cta-compass {
    position: absolute;
    right: 5%;
    top: 50%;
    transform: translateY(-50%);
    width: min(420px, 36vw);
    color: var(--color-gold);
    opacity: 0.07;
    pointer-events: none;
  }
  .cta-inner {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1.5rem;
    max-width: 560px;
  }
  .cta-inner h2 {
    font-family: var(--font-serif);
    font-size: clamp(2rem, 4vw, 3.2rem);
    font-weight: 600;
    color: var(--color-text-on-dark);
    line-height: 1.15;
    letter-spacing: 0.01em;
  }
  .cta-inner p {
    font-size: 1.05rem;
    color: var(--color-text-on-dark-muted);
    line-height: 1.7;
    margin-top: -0.25rem;
  }
  .cta-inner p em {
    font-style: italic;
    color: rgba(255, 255, 255, 0.5);
  }
  .cta-note {
    font-size: 0.76rem;
    color: rgba(255, 255, 255, 0.25);
    letter-spacing: 0.05em;
    font-weight: 500;
    margin-top: -0.5rem;
  }

  /* ── Footer ── */
  footer {
    background: #040810;
    border-top: 1px solid rgba(201, 148, 58, 0.12);
    padding: 4rem 0 2rem;
  }
  .footer-inner {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr;
    gap: 3rem;
    margin-bottom: 2.5rem;
    padding-bottom: 2.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .footer-brand-col {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .footer-logo {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-gold);
    letter-spacing: 0.02em;
  }
  .footer-tagline {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.38);
    line-height: 1.6;
  }
  .footer-coords {
    font-size: 0.68rem;
    letter-spacing: 0.16em;
    color: rgba(201, 148, 58, 0.4);
    margin-top: 0.4rem;
    font-variant-numeric: tabular-nums;
  }
  .footer-links-col {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .footer-col-title {
    font-size: 0.63rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.22);
    margin-bottom: 0.3rem;
  }
  .footer-links-col a {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.42);
    transition: color var(--transition);
  }
  .footer-links-col a:hover {
    color: rgba(255, 255, 255, 0.78);
  }
  .footer-bottom {
    font-size: 0.76rem;
    color: rgba(255, 255, 255, 0.18);
  }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .theater-stage {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
    .theater-info {
      text-align: center;
      align-items: center;
    }
    .theater-techniques {
      justify-content: center;
    }
  }
  @media (max-width: 900px) {
    .hero {
      padding: 6rem 0 5rem;
    }
    .manifesto-body {
      grid-template-columns: 1fr;
      column-gap: 0;
    }
  }
  @media (max-width: 768px) {
    .stats-grid {
      flex-direction: column;
      gap: 2.5rem;
    }
    .stat-divider {
      width: 3rem;
      height: 1px;
    }
    .pricing-grid {
      grid-template-columns: 1fr;
      max-width: 400px;
      margin: 0 auto;
    }
    .theater-tabs {
      gap: 0.3rem;
    }
    .tab-label {
      display: none;
    }
    .tab-index {
      opacity: 1;
      font-size: 0.8rem;
    }
    .footer-inner {
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
    .footer-brand-col {
      grid-column: 1 / -1;
    }
    .cta-compass {
      display: none;
    }
  }
  @media (max-width: 640px) {
    .hero-headline {
      font-size: 2.6rem;
    }
    .hero-actions {
      justify-content: flex-start;
    }
    .footer-inner {
      grid-template-columns: 1fr;
    }
    .manifesto-header h2 {
      font-size: 1.6rem;
    }
  }
  @media (max-width: 720px) {
    .comparison {
      padding: 4rem 0;
    }
    .compare-table {
      font-size: 0.82rem;
    }
    .compare-table thead th,
    .compare-table tbody td {
      padding: 0.7rem 0.8rem;
    }
  }
</style>
