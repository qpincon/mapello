<svelte:head>
  <title>About — Mapello</title>
  <meta name="description" content="Mapello is a browser-based SVG map designer built to make beautiful, embeddable maps accessible to everyone." />
  <link rel="canonical" href="https://mapello.net/about" />
  <meta property="og:title" content="About — Mapello" />
  <meta property="og:description" content="Mapello is a browser-based SVG map designer built to make beautiful, embeddable maps accessible to everyone." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://mapello.net/about" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="About — Mapello" />
  <meta name="twitter:description" content="Mapello is a browser-based SVG map designer built to make beautiful, embeddable maps accessible to everyone." />
  <link rel="preconnect" href="https://fonts.bunny.net" />
  <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700&display=swap" rel="stylesheet" />
  <link href="https://fonts.bunny.net/css?family=cormorant-garamond:400,400i,600,600i&display=swap" rel="stylesheet" />
</svelte:head>

<main class="prose-page">
  <div class="prose-container">
    <div class="prose-header">
      <span class="prose-tag">About</span>
      <h1>Maps that just work.</h1>
      <p class="prose-lead">Mapello is a browser-based SVG map designer. Design a map, export a single file, paste it anywhere — no code, no hosting, no upkeep.</p>
    </div>

    <div class="prose-body">
      <h2>Why Mapello exists</h2>
      <p>
        Making a good-looking map has always required a choice between tools that are easy but ugly, tools that look great but require coding, or tools that tie your output to their servers forever. We wanted a fourth option.
      </p>
      <p>
        Mapello exports a single self-contained SVG file. That file works anywhere an <code>&lt;img&gt;</code> or inline SVG does — your blog, your slides, your CMS. It has no external dependencies and no connection to Mapello's servers. Cancel your subscription tomorrow and every map you've ever exported keeps working, unchanged.
      </p>

      <h2>What it does</h2>
      <p>
        Mapello covers two complementary scales:
      </p>
      <ul>
        <li><strong>World &amp; region maps</strong> — countries, continents, choropleth coloring from a CSV, multiple projections including globe views.</li>
        <li><strong>City &amp; street maps</strong> — vector tile rendering via MapLibre, custom palettes, 3D building extrusion, all exported as clean SVG paths.</li>
      </ul>
      <p>
        Both modes share a common annotation layer: freehand drawing, text labels, icons, clickable popovers, and hover tooltips — all embedded in the exported file.
      </p>

      <h2>Open source</h2>
      <p>
        Mapello's source code is available on <a href="https://github.com/qpincon/mapello" target="_blank" rel="noopener noreferrer">GitHub</a>. Bug reports, feature requests, and pull requests are welcome.
      </p>

      <h2>Get in touch</h2>
      <p>
        Questions, feedback, or press inquiries — reach us at <a href="/contact">the contact page</a>.
      </p>
    </div>
  </div>
</main>

<style>
  .prose-page {
    min-height: 100vh;
    background: #f5eedc;
    padding: 7rem 1.5rem 5rem;
    font-family: 'Inter', sans-serif;
  }
  .prose-container {
    max-width: 680px;
    margin: 0 auto;
  }
  .prose-header {
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid rgba(30, 41, 59, 0.1);
  }
  .prose-tag {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #c9943a;
    margin-bottom: 0.75rem;
  }
  h1 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 2.8rem;
    font-weight: 600;
    color: #0f172a;
    line-height: 1.15;
    margin: 0 0 1rem;
  }
  .prose-lead {
    font-size: 1.05rem;
    color: rgba(15, 23, 42, 0.65);
    line-height: 1.7;
    margin: 0;
  }
  .prose-body h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.45rem;
    font-weight: 600;
    color: #0f172a;
    margin: 2.5rem 0 0.75rem;
  }
  .prose-body p,
  .prose-body li {
    font-size: 0.95rem;
    line-height: 1.75;
    color: rgba(15, 23, 42, 0.72);
  }
  .prose-body ul {
    padding-left: 1.4rem;
    margin: 0.5rem 0 1rem;
  }
  .prose-body li {
    margin-bottom: 0.4rem;
  }
  .prose-body a {
    color: #c9943a;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .prose-body a:hover {
    color: #a87730;
  }
  code {
    font-size: 0.87em;
    background: rgba(15, 23, 42, 0.07);
    padding: 0.1em 0.35em;
    border-radius: 3px;
  }
</style>
