// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

import rehypeSlug from 'rehype-slug';

import remarkRuby from './plugins/remark-ruby.mjs';
import remarkFirstImage from './plugins/remark-first-image.mjs';
import remarkTocExtract from './plugins/remark-toc-extract.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://lyricstheory.com',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  markdown: {
    remarkPlugins: [remarkRuby, remarkFirstImage, remarkTocExtract],
    rehypePlugins: [rehypeSlug],
  },
  integrations: [
    mdx({
      remarkPlugins: [remarkRuby, remarkFirstImage, remarkTocExtract],
      rehypePlugins: [rehypeSlug],
    }),
    sitemap(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
