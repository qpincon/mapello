import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    files: {
      assets: 'public'
    }
  },
  compilerOptions: {
    // disable all warnings coming from node_modules and all accessibility warnings
    warningFilter: (warning) => !warning.filename?.includes('node_modules') && !warning.code.startsWith('a11y')
  }
};
