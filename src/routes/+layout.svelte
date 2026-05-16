<script lang="ts">
  import { PUBLIC_UMAMI_WEBSITE_ID } from '$env/static/public';

  let { children } = $props();
</script>

<svelte:head>
  {#if PUBLIC_UMAMI_WEBSITE_ID}
    <script
      defer
      src="/api/stats/s.js"
      data-website-id={PUBLIC_UMAMI_WEBSITE_ID}
      data-host-url="/api/stats"
    ></script>
  {/if}
</svelte:head>

{@render children()}
