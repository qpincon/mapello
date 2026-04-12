<script lang="ts">
  interface Props {
    icon: string; // SVG path d attribute
    title: string;
    description: string;
  }
  let { icon, title, description }: Props = $props();
</script>

<div class="card">
  <div class="card-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html icon}
    </svg>
  </div>
  <h3 class="card-title">{title}</h3>
  <p class="card-desc">{description}</p>
</div>

<style>
  .card {
    height: 100%;
    padding: 1.75rem 1.5rem;
    border-radius: var(--radius-md);
    background: var(--color-white);
    border: 1px solid var(--color-border-subtle);
    box-shadow: var(--shadow-sm);
    transition: transform var(--transition), box-shadow var(--transition);
  }

  .card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-md);
  }

  .card-icon {
    width: 2.75rem;
    height: 2.75rem;
    background: rgba(42, 125, 110, 0.1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .card-icon svg {
    width: 1.4rem;
    height: 1.4rem;
    color: var(--color-accent);
  }

  .card-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text-on-light);
    margin-bottom: 0.4rem;
  }

  .card-desc {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    line-height: 1.6;
  }
</style>
