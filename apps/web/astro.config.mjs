import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://usd-impact.com',
  output: 'static',
  integrations: [sitemap()],
});
