import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
// /!!\ version 0.23 does not work! Use 0.25+
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      src: '/src',
    }
  },
  server: {
    watch: {
      ignored: ["**/src/assets/layers/**"]
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern', // or "modern", "legacy"
        silenceDeprecations: ["import", "color-functions", "global-builtin"]
      },
    },
  },
  plugins: [
    sveltekit(),
    // to remove when this PR is merged https://github.com/shrhdk/text-to-svg/pull/76
    nodePolyfills({
      include: ['path'],
      globals: {
        global: true,
        Buffer: true,
        process: true
      },
      protocolImports: true
    })],
})
