<script lang="ts">
  interface Props {
    title: string;
    description: string;
    src?: string;
    aspectRatio?: string;
    placeholderGradient?: string;
  }
  let { title, description, src, aspectRatio = '1 / 1', placeholderGradient = 'linear-gradient(135deg, #222, #333)' }: Props = $props();
</script>

<div class="slot-wrapper">
  <div class="slot-frame" style="aspect-ratio: {aspectRatio}">
    {#if src}
      <object data={src} type="image/svg+xml" class="slot-content"></object>
    {:else}
      <div class="slot-placeholder" style="background: {placeholderGradient}">
        <svg class="slot-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span class="slot-label">{title}</span>
      </div>
    {/if}
  </div>
  <div class="slot-caption">
    <span class="slot-title">{title}</span>
    <span class="slot-desc">{description}</span>
  </div>
</div>

<style>
  .slot-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .slot-frame {
    width: 100%;
    position: relative;
    overflow: hidden;
  }

  .slot-content {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .slot-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    border: 1px dashed rgba(255,255,255,0.15);
  }

  .slot-icon {
    width: 2rem;
    height: 2rem;
    color: rgba(255,255,255,0.3);
  }

  .slot-label {
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
  }

  .slot-caption {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .slot-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-on-dark);
  }

  .slot-desc {
    font-size: 0.8rem;
    color: var(--color-text-on-dark-muted);
    line-height: 1.4;
  }
</style>
