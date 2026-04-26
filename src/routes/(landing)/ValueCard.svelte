<script lang="ts">
  interface Props {
    number: string;
    title: string;
    description: string;
  }
  let { number, title, description }: Props = $props();
</script>

<div class="principle">
  <span class="principle-number">{number}</span>
  <div class="principle-body">
    <h3 class="principle-title">{title}</h3>
    <p class="principle-desc">{description}</p>
  </div>
</div>

<style>
  .principle {
    display: grid;
    grid-template-columns: 4.5rem 1fr;
    gap: 1.5rem;
    padding: 1.6rem 0;
    border-top: 1px solid rgba(160, 120, 60, 0.2);
    align-items: start;
    transition: transform var(--transition);
  }

  .principle:hover {
    transform: translateX(4px);
  }

  .principle-number {
    font-family: var(--font-serif);
    font-size: 2.4rem;
    font-weight: 400;
    color: var(--color-gold);
    line-height: 1;
    padding-top: 0.15rem;
    letter-spacing: -0.02em;
    opacity: 0.8;
  }

  .principle-title {
    font-family: var(--font-serif);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--color-parchment-text);
    margin-bottom: 0.4rem;
    line-height: 1.25;
    letter-spacing: 0.01em;
  }

  .principle-desc {
    font-size: 0.88rem;
    color: var(--color-parchment-muted);
    line-height: 1.7;
  }

  @media (max-width: 500px) {
    .principle {
      grid-template-columns: 3.5rem 1fr;
      gap: 1rem;
    }
    .principle-number {
      font-size: 1.9rem;
    }
  }
</style>
