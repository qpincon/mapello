<script lang="ts">
  import { onMount } from 'svelte';

  let overHero = $state(true);
  let mounted = $state(false);

  onMount(() => {
    mounted = true;

    const hero = document.querySelector('.hero');
    if (!hero) {
      overHero = false;
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => { overHero = entry.isIntersecting; },
      { threshold: 0.05 }
    );
    io.observe(hero);
    return () => io.disconnect();
  });
</script>

<nav
  class="site-nav"
  class:over-hero={overHero}
  class:scrolled={!overHero}
  class:mounted
  aria-label="Primary"
>
  <div class="nav-inner">
    <!-- Brand -->
    <a href="/" class="nav-brand" aria-label="Mapello home">
      <img
        src="/logo_wordmark_transparent.png"
        alt="Mapello"
        class="nav-logo"
        height="36"
      />
    </a>

    <!-- Center links -->
    <div class="nav-links" role="list">
      <a href="#showcase" class="nav-link" role="listitem">Showcase</a>
      <a href="#compare" class="nav-link" role="listitem">Compare</a>
      <a href="#pricing" class="nav-link" role="listitem">Pricing</a>
    </div>

    <!-- CTA -->
    <a href="/app" class="nav-cta">Start designing</a>
  </div>
</nav>

<style>
  .site-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    height: 64px;

    /* Default (over hero) */
    background: rgba(6, 13, 22, 0.5);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);

    /* Start invisible for mount animation */
    opacity: 0;
    transform: translateY(-100%);
    transition:
      background 0.35s ease,
      border-color 0.35s ease,
      opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .site-nav.mounted {
    opacity: 1;
    transform: translateY(0);
    transition-delay: 0.1s;
  }

  .site-nav.scrolled {
    background: rgba(245, 238, 220, 0.94);
    border-bottom: 1px solid rgba(201, 148, 58, 0.22);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .nav-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1.5rem;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  /* Brand */
  .nav-brand {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
    transition: opacity 0.2s ease;
  }
  .nav-brand:hover { opacity: 0.8; }

  .nav-logo {
    height: 36px;
    width: auto;
    display: block;
    /* Dark nav (over hero): invert to white */
    filter: brightness(0) invert(1);
    transition: filter 0.35s ease;
  }
  .scrolled .nav-logo {
    /* Parchment nav: restore original navy colors */
    filter: none;
  }

  /* Center links */
  .nav-links {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
    justify-content: center;
  }

  .nav-link {
    position: relative;
    display: inline-block;
    padding: 0.4rem 0.7rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
    text-decoration: none;
    transition: color 0.2s ease;
  }
  .nav-link::after {
    content: '';
    position: absolute;
    bottom: 0.1rem;
    left: 0.7rem;
    right: 0.7rem;
    height: 1px;
    background: var(--color-gold);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .nav-link:hover { color: rgba(255, 255, 255, 0.82); }
  .nav-link:hover::after { transform: scaleX(1); }

  .scrolled .nav-link { color: rgba(30, 41, 59, 0.55); }
  .scrolled .nav-link:hover { color: #0f172a; }

  /* Focus ring */
  .nav-link:focus-visible,
  .nav-brand:focus-visible,
  .nav-cta:focus-visible {
    outline: 2px solid var(--color-gold);
    outline-offset: 4px;
    border-radius: 2px;
  }

  /* CTA */
  .nav-cta {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    padding: 0.5rem 1.15rem;
    background: var(--color-gold);
    color: #060d16;
    font-weight: 600;
    font-size: 0.8rem;
    letter-spacing: 0.01em;
    border-radius: 4px;
    text-decoration: none;
    transition:
      background 0.2s ease,
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }
  .nav-cta::after {
    content: ' →';
    margin-left: 0.3rem;
    transition: transform 0.2s ease;
    display: inline-block;
  }
  .nav-cta:hover {
    background: var(--color-gold-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(201, 148, 58, 0.35);
  }
  .nav-cta:hover::after { transform: translateX(3px); }

  /* Mobile: hide center links below 680px */
  @media (max-width: 680px) {
    .nav-links { display: none; }
    .nav-inner { gap: 1rem; }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .site-nav {
      opacity: 1;
      transform: translateY(0);
      transition: background 0.35s ease, border-color 0.35s ease;
    }
    .site-nav.mounted { transition-delay: 0s; }
    .nav-link::after { transition: none; }
    .nav-cta { transition: background 0.2s ease; }
    .nav-logo { transition: none; }
  }
</style>
