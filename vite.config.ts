import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'

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
        silenceDeprecations: ["import", "color-functions", "global-builtin", "if-function"]
      },
    },
  },
  plugins: [
    sveltekit(),
  ],
})
