<script lang="ts">
  import { env } from '$env/dynamic/public';

  let { children } = $props();
</script>

<svelte:head>
  {#if env.PUBLIC_UMAMI_WEBSITE_ID}
    <script
      defer
      src="/api/stats/s.js"
      data-website-id={env.PUBLIC_UMAMI_WEBSITE_ID}
      data-host-url="/api/stats"
    ></script>
  {/if}
</svelte:head>

{@render children()}
