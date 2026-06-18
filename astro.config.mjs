// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// STEP 1: static site, single demo page mounting the PalmTreeHero island.
// No adapter, no SSR — deploys as static to Cloudflare Pages.
export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
