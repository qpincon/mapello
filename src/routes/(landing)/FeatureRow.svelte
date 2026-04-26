<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    tag: string;
    title: string;
    description: string;
    reversed?: boolean;
    placeholderGradient?: string;
    imageSlot?: Snippet;
  }
  let { tag, title, description, reversed = false, placeholderGradient = 'linear-gradient(135deg, #1e293b, #334155)', imageSlot }: Props = $props();
</script>

<div class="row" class:reversed>
  <div class="row-image">
    {#if imageSlot}
      {@render imageSlot()}
    {:else}
      <div class="image-placeholder" style="background: {placeholderGradient}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <span>Screenshot coming soon</span>
      </div>
    {/if}
  </div>
  <div class="row-text">
    <span class="tag">{tag}</span>
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4.5rem;
    align-items: center;
  }

  .row.reversed {
    direction: rtl;
  }

  .row.reversed > * {
    direction: ltr;
  }

  .row-image {
    border-radius: var(--radius-lg);
    overflow: hidden;
    aspect-ratio: 4 / 3;
    box-shadow: var(--shadow-lg), 0 0 0 1px var(--color-gold-border);
  }

  .image-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    border: 1px dashed rgba(255,255,255,0.15);
  }

  .image-placeholder svg {
    width: 2rem;
    height: 2rem;
    color: rgba(255,255,255,0.25);
  }

  .image-placeholder span {
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
  }

  .row-text {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  .tag {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-gold);
    padding: 0.28rem 0.8rem;
    background: var(--color-gold-soft);
    border: 1px solid var(--color-gold-border);
    border-radius: var(--radius-pill);
    width: fit-content;
  }

  h3 {
    font-family: var(--font-serif);
    font-size: clamp(1.55rem, 2.8vw, 2.1rem);
    font-weight: 600;
    line-height: 1.2;
    color: var(--color-parchment-text);
    letter-spacing: 0.01em;
  }

  p {
    font-size: 0.975rem;
    color: var(--color-parchment-muted);
    line-height: 1.78;
  }

  @media (max-width: 768px) {
    .row, .row.reversed {
      grid-template-columns: 1fr;
      direction: ltr;
      gap: 2rem;
    }
  }
</style>
