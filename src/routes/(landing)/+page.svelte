<script lang="ts">
  import { onMount } from "svelte";
  import ShowcaseSlot from "./ShowcaseSlot.svelte";
  import ValueCard from "./ValueCard.svelte";
  import FeatureRow from "./FeatureRow.svelte";

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
      description: "A world map with color-coded dots showing a company's offices around the world.",
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
  <svg class="hero-globe" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <clipPath id="globe-clip"><circle cx="300" cy="300" r="284" /></clipPath>
    </defs>
    <circle cx="300" cy="300" r="284" stroke="white" stroke-width="0.8" />
    <g clip-path="url(#globe-clip)" stroke="white">
      <ellipse cx="300" cy="300" rx="284" ry="76" stroke-width="0.7" />
      <ellipse cx="300" cy="216" rx="246" ry="66" stroke-width="0.6" />
      <ellipse cx="300" cy="384" rx="246" ry="66" stroke-width="0.6" />
      <ellipse cx="300" cy="144" rx="142" ry="38" stroke-width="0.5" />
      <ellipse cx="300" cy="456" rx="142" ry="38" stroke-width="0.5" />
      <line x1="300" y1="16" x2="300" y2="584" stroke-width="0.6" />
      <ellipse cx="300" cy="300" rx="142" ry="284" stroke-width="0.6" />
      <ellipse cx="300" cy="300" rx="246" ry="284" stroke-width="0.6" />
    </g>
  </svg>
  <div class="l-container hero-inner">
    <div class="hero-text">
      <div class="hero-eyebrow lp-reveal">
        <span class="eyebrow-rule"></span>
        <span>Mapello</span>
        <span class="eyebrow-rule"></span>
      </div>
      <h1 class="hero-headline lp-reveal">
        The map tool<br /><em>I always wanted.</em>
      </h1>
      <p class="hero-sub lp-reveal">
        Too technical or too ugly — that was always the trade-off. Export a single self-contained SVG, paste it
        anywhere. Interactive, lightweight, no code.
      </p>
      <div class="hero-actions lp-reveal">
        <a href="/app" class="btn-primary">Start designing</a>
        <a href="#showcase" class="btn-text-link">See examples</a>
      </div>
    </div>
  </div>
</section>

<!-- ════════════════════════════════ VALUE PROPOSITION ════════════════════════════════ -->
<section class="values">
  <div class="l-container">
    <div class="values-grid">
      <div class="lp-reveal">
        <ValueCard
          icon={ICONS.paste}
          title="One file, works everywhere"
          description="Your map exports as a single file. Paste it into your website, your blog, your presentation — it just works. No plugins, no accounts, no dependencies."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          icon={ICONS.sparkle}
          title="Looks great out of the box"
          description="Thoughtful defaults, curated color palettes, and subtle effects mean your map looks polished before you've changed a single setting."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          icon={ICONS.compress}
          title="Fast to load, forever"
          description="Exported maps are aggressively optimized. They stay lightweight as your page grows, and never slow your site down."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          icon={ICONS.data}
          title="Your spreadsheet becomes a map"
          description="Drop in a CSV file and Mapello colors your map automatically — by country, by region, by any column you choose. No technical knowledge needed."
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

<!-- ══════════════════════════════ FEATURE DEEP-DIVE ════════════════════════════════ -->
<section class="features">
  <div class="l-container">
    <div class="section-header lp-reveal" style="margin-bottom: 4rem;">
      <span class="section-tag">How it works</span>
      <h2>Designed for people, not developers</h2>
    </div>
    <div class="features-list">
      <div class="lp-reveal">
        <FeatureRow
          tag="Any angle, any region"
          title="See the world the way you want to show it"
          description="Frame Europe as a globe, zoom into a country, or tilt the view for depth. Mapello gives you every common map style in a few clicks — no geography degree required."
          placeholderGradient="radial-gradient(ellipse at 50% 40%, #1d3557 0%, #0d1f3c 70%, #060c1a 100%)"
        />
      </div>
      <div class="lp-reveal">
        <FeatureRow
          reversed
          tag="Spreadsheet → colored map"
          title="Your data tells the story — Mapello draws it"
          description="Upload a CSV, pick the column that matters, and watch your map color itself. Choose between gradients for numbers or distinct colors for categories. Add a legend in one click."
          placeholderGradient="linear-gradient(160deg, #1e3a5f 0%, #2a5780 60%, #1a3050 100%)"
        />
      </div>
      <div class="lp-reveal">
        <FeatureRow
          tag="Annotate freely"
          title="Add context that makes maps memorable"
          description="Draw arrows, add labels in any font, highlight a region with a hand-drawn circle, or attach a popup that opens when readers click. Every annotation is part of the exported file."
          placeholderGradient="linear-gradient(135deg, #2c2a4a 0%, #3d3870 50%, #2a2640 100%)"
        />
      </div>
      <div class="lp-reveal">
        <FeatureRow
          reversed
          tag="One file, anywhere"
          title="Paste it in. That's literally it."
          description="The exported map is a single, self-contained file. Copy it, paste it into your site's HTML, and it appears — interactive tooltips and all. No extra scripts, no CDN, no configuration."
          placeholderGradient="linear-gradient(135deg, #0f2a1a 0%, #1a4a2e 50%, #0d2018 100%)"
        />
      </div>
      <div class="lp-reveal">
        <FeatureRow
          tag="No lock-in, ever"
          title="Your maps are yours. Forever."
          description="There is no Mapello inside your exported file — just SVG. It runs on its own, in any browser, with no dependency on our servers. Cancel your account tomorrow and every map you've ever exported keeps working, unchanged, forever."
          placeholderGradient="linear-gradient(135deg, #100e08 0%, #261e10 50%, #100e08 100%)"
        />
      </div>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════ STATS STRIP ═══════════════════════════════════ -->
<section class="stats">
  <div class="l-container">
    <div class="stats-grid lp-reveal">
      <div class="stat">
        <span class="stat-value">3 free</span>
        <span class="stat-label">exports to get started</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-value">&lt; 100 KB</span>
        <span class="stat-label">typical exported map size</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-value">Zero deps</span>
        <span class="stat-label">exported maps need no extra code</span>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════ PRICING ══════════════════════════════════════ -->
<section class="pricing">
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
            >
            Full editor — every feature
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >
            3 exported maps
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >
            Saves in your browser
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
            >
            Everything in Free
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >
            <strong>Unlimited</strong> exported maps
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >
            <strong>Unlimited</strong> saved projects
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >
            Priority support
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
            >
            Everything in Pro
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >
            One payment per year
          </li>
        </ul>
        <a href="/app" class="btn-outline">Choose annual</a>
      </div>
    </div>
  </div>
</section>

<!-- ════════════════════════════════ FINAL CTA ═══════════════════════════════════════ -->
<section class="cta">
  <div class="cta-glow"></div>
  <div class="l-container cta-inner lp-reveal">
    <h2>Your first 3 maps are on us.</h2>
    <p>No account, no credit card. Open the editor and start designing right now.</p>
    <a href="/app" class="btn-primary btn-large">Start designing</a>
  </div>
</section>

<!-- ═══════════════════════════════════ FOOTER ═══════════════════════════════════════ -->
<footer>
  <div class="l-container footer-inner">
    <span class="footer-brand">Mapello</span>
    <span class="footer-copy">&copy; 2026</span>
  </div>
</footer>

<style>
  /* ── Shared ── */
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
    gap: 0.75rem;
  }
  .section-tag {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-accent);
    background: rgba(42, 125, 110, 0.12);
    padding: 0.3rem 0.9rem;
    border-radius: var(--radius-pill);
    width: fit-content;
  }
  .section-header h2 {
    font-size: clamp(1.6rem, 3vw, 2.2rem);
    font-weight: 700;
    line-height: 1.2;
    color: var(--color-text-on-light);
  }
  .section-header p {
    font-size: 1rem;
    color: var(--color-text-muted);
    line-height: 1.7;
  }

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

  /* Tab-switch fade */
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

  /* ── Buttons ── */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.75rem 1.75rem;
    background: var(--color-accent);
    color: white;
    font-weight: 500;
    font-size: 0.88rem;
    letter-spacing: 0.03em;
    border-radius: 6px;
    transition:
      background var(--transition),
      transform var(--transition);
  }
  .btn-primary:hover {
    background: var(--color-accent-hover);
    transform: translateY(-1px);
  }
  .btn-large {
    padding: 1rem 2.5rem;
    font-size: 1.05rem;
  }
  .btn-wide {
    width: 100%;
  }

  .btn-ghost {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.8rem 1.5rem;
    color: var(--color-text-on-dark);
    font-weight: 500;
    font-size: 0.95rem;
    border-radius: var(--radius-pill);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition:
      border-color var(--transition),
      background var(--transition);
  }
  .btn-ghost:hover {
    border-color: rgba(255, 255, 255, 0.35);
    background: rgba(255, 255, 255, 0.06);
  }

  .btn-text-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: rgba(255, 255, 255, 0.38);
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
    color: var(--color-text-on-light);
    font-weight: 600;
    font-size: 0.9rem;
    border-radius: var(--radius-pill);
    border: 1.5px solid var(--color-border-subtle);
    transition:
      border-color var(--transition),
      background var(--transition);
  }
  .btn-outline:hover {
    border-color: var(--color-accent);
    background: rgba(42, 125, 110, 0.06);
  }

  /* ── Hero ── */
  .hero {
    background: #060b12;
    display: flex;
    align-items: center;
    padding: 9rem 0 8rem;
  }
  .hero::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 70%;
    height: 90%;
    background: radial-gradient(ellipse, rgba(42, 125, 110, 0.06) 0%, transparent 65%);
    pointer-events: none;
  }
  .hero-globe {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(88vw, 620px);
    opacity: 0.045;
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
    gap: 1.75rem;
    max-width: 700px;
  }
  .hero-eyebrow {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.65rem;
    font-weight: 500;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.3);
    margin-bottom: -0.75rem;
  }
  .eyebrow-rule {
    display: block;
    width: 32px;
    height: 1px;
    background: rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
  }
  .hero-headline {
    font-family: "Cormorant Garamond", "Palatino Linotype", "Palatino", Georgia, serif;
    font-size: clamp(3.2rem, 5.8vw, 5.4rem);
    font-weight: 400;
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: rgba(255, 255, 255, 0.82);
  }
  .hero-headline em {
    font-style: italic;
    font-weight: 600;
    background: none;
    -webkit-background-clip: unset;
    background-clip: unset;
    -webkit-text-fill-color: #fff;
    color: #fff;
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
    justify-content: center;
  }
  /* ── Values ── */
  .values {
    background: var(--color-surface);
    padding: 5rem 0;
  }
  .values-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.25rem;
    align-items: stretch;
  }

  .values-grid > :global(*) {
    display: flex;
    flex-direction: column;
  }

  /* ── Showcase (theater) ── */
  .showcase {
    padding: 5.5rem 0;
  }
  /* Wider container for showcase sections so maps breathe */
  .showcase :global(.l-container) {
    max-width: 1440px;
    padding: 0 2rem;
  }
  .showcase-dark {
    background: #111111;
  }
  .showcase-dark .section-header h2 {
    color: var(--color-text-on-dark);
  }
  .showcase-dark .section-header p {
    color: var(--color-text-on-dark-muted);
  }
  .showcase-dark .section-tag {
    background: rgba(42, 125, 110, 0.2);
  }
  .showcase-light {
    background: #f5f5f5;
  }

  .theater-stage {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 3rem;
    align-items: center;
    margin-bottom: 2rem;
  }
  .theater-display {
    /* No background or border — the map SVG provides its own */
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
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
  }
  .showcase-dark .theater-title {
    color: var(--color-text-on-dark);
  }
  .showcase-light .theater-title {
    color: var(--color-text-on-light);
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
    color: var(--color-text-muted);
  }

  .theater-techniques {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .technique-badge {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0.3rem 0.75rem;
    border-radius: var(--radius-pill);
  }
  .showcase-dark .technique-badge {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-on-dark-muted);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .showcase-light .technique-badge {
    background: rgba(42, 125, 110, 0.08);
    color: var(--color-secondary);
    border: 1px solid rgba(42, 125, 110, 0.15);
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
    background: rgba(255, 255, 255, 0.06);
  }
  .showcase-dark .theater-tab.active {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-on-dark);
    border-color: rgba(42, 125, 110, 0.4);
  }
  .showcase-light .theater-tab {
    color: var(--color-text-muted);
  }
  .showcase-light .theater-tab:hover {
    background: rgba(0, 0, 0, 0.04);
  }
  .showcase-light .theater-tab.active {
    background: white;
    color: var(--color-text-on-light);
    border-color: var(--color-border-subtle);
    box-shadow: var(--shadow-sm);
  }
  .tab-index {
    font-size: 0.68rem;
    font-weight: 700;
    opacity: 0.4;
    letter-spacing: 0.05em;
  }
  .theater-tab.active .tab-index {
    opacity: 1;
    color: var(--color-accent);
  }
  .tab-label {
    white-space: nowrap;
  }

  /* ── Features ── */
  .features {
    background: white;
    padding: 6rem 0;
  }
  .features-list {
    display: flex;
    flex-direction: column;
    gap: 5rem;
  }

  /* ── Stats ── */
  .stats {
    background: linear-gradient(135deg, rgba(42, 125, 110, 0.08), rgba(80, 103, 132, 0.08));
    border-top: 1px solid rgba(42, 125, 110, 0.15);
    border-bottom: 1px solid rgba(42, 125, 110, 0.15);
    padding: 3.5rem 0;
  }
  .stats-grid {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3rem;
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    text-align: center;
  }
  .stat-value {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--color-text-on-light);
    letter-spacing: -0.02em;
  }
  .stat-label {
    font-size: 0.82rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .stat-divider {
    width: 1px;
    height: 3rem;
    background: var(--color-border-subtle);
    flex-shrink: 0;
  }

  /* ── Pricing ── */
  .pricing {
    background: white;
    padding: 6rem 0;
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
    border: 1.5px solid var(--color-border-subtle);
    background: var(--color-white);
    position: relative;
  }
  .pricing-pro {
    border-color: var(--color-accent);
    box-shadow:
      0 0 0 1px var(--color-accent),
      var(--shadow-md);
  }
  .pricing-popular {
    position: absolute;
    top: -0.7rem;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: white;
    background: var(--color-accent);
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
    border-bottom: 1px solid var(--color-border-subtle);
  }
  .pricing-card-head h3 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text-on-light);
  }
  .pricing-amount {
    display: flex;
    align-items: baseline;
    gap: 0.1rem;
  }
  .pricing-currency {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--color-text-muted);
    align-self: flex-start;
    margin-top: 0.4rem;
  }
  .pricing-value {
    font-size: 3rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--color-text-on-light);
    line-height: 1;
  }
  .pricing-period {
    font-size: 0.82rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .pricing-save {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-accent);
    background: rgba(42, 125, 110, 0.1);
    padding: 0.35rem 0.75rem;
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
    color: var(--color-text-muted);
    line-height: 1.4;
  }
  .pricing-features svg {
    width: 1rem;
    height: 1rem;
    color: var(--color-accent);
    flex-shrink: 0;
  }

  /* ── CTA ── */
  .cta {
    background: var(--color-dark);
    padding: 6rem 0 5rem;
    text-align: center;
  }
  .cta-glow {
    position: absolute;
    bottom: -30%;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 80%;
    background: radial-gradient(ellipse, rgba(42, 125, 110, 0.15) 0%, transparent 70%);
    pointer-events: none;
  }
  .cta-inner {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
  }
  .cta-inner h2 {
    font-size: clamp(1.8rem, 3.5vw, 2.6rem);
    font-weight: 800;
    color: var(--color-text-on-dark);
    line-height: 1.15;
  }
  .cta-inner p {
    font-size: 1.05rem;
    color: var(--color-text-on-dark-muted);
    max-width: 400px;
    margin-bottom: 0.5rem;
  }

  /* ── Footer ── */
  footer {
    background: #080f1e;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding: 1.5rem 0;
  }
  .footer-inner {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .footer-brand {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-text-on-dark);
    margin-right: auto;
  }
  .footer-copy {
    font-size: 0.8rem;
    color: var(--color-text-on-dark-muted);
  }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .values-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .theater-stage {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
    .theater-display {
      margin: 0 auto;
    }
    .theater-info {
      text-align: center;
      align-items: center;
    }
    .theater-techniques {
      justify-content: center;
    }
  }
  @media (max-width: 768px) {
    .stats-grid {
      flex-direction: column;
      gap: 2rem;
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
  }
  @media (max-width: 640px) {
    .values-grid {
      grid-template-columns: 1fr;
    }
    .hero-actions {
      justify-content: center;
    }
    .hero-headline {
      font-size: 2rem;
    }
  }
</style>
