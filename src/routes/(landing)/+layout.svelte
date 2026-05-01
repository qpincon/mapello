<script>
  import 'src/assets/landing.css';
  import SiteNav from './SiteNav.svelte';
  let { children } = $props();
</script>

<SiteNav />
{@render children()}
