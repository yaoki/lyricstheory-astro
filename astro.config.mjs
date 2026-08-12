// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

import rehypeSlug from 'rehype-slug';

import remarkRuby from './plugins/remark-ruby.mjs';
import remarkFirstImage from './plugins/remark-first-image.mjs';
import remarkTocExtract from './plugins/remark-toc-extract.mjs';

// --- sitemap の lastmod を frontmatter から突き合わせる -------------------
// astro:content の getCollection はこのファイルから使えない（config 評価時点では
// content collection がまだロードされていない）ため、frontmatter を fs で直接読む。

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * frontmatter ブロック（先頭の `---` 〜次の `---` の間）を文字列で返す。
 * 見つからなければ空文字列。
 * @param {string} filePath
 */
function readFrontmatterBlock(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : '';
}

/**
 * frontmatter ブロックからトップレベル（インデント無し）の scalar フィールドを
 * 1つ抜き出す。ネストしたフィールド（song: の下の title: 等）は拾わない。
 * @param {string} frontmatter
 * @param {string} key
 */
function extractFrontmatterField(frontmatter, key) {
  const re = new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm');
  const match = frontmatter.match(re);
  if (!match) return undefined;
  return match[1].trim().replace(/^["']|["']$/g, '');
}

/**
 * ディレクトリを再帰的に辿り、md/mdx ファイルの絶対パス一覧を返す。
 * @param {string} dir
 * @returns {string[]}
 */
function walkMarkdownFiles(dir) {
  /** @type {string[]} */
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(entryPath));
    } else if (/\.(md|mdx)$/.test(entry.name)) {
      results.push(entryPath);
    }
  }
  return results;
}

/**
 * blog: slug -> lastmod(Date) のマップ。updatedDate ?? pubDate。
 * slug は frontmatter の slug フィールド（ファイル名ではない）。
 */
function buildBlogLastmodMap() {
  /** @type {Map<string, Date>} */
  const map = new Map();
  const blogDir = path.join(__dirname, 'src/content/blog');
  try {
    const files = walkMarkdownFiles(blogDir);
    for (const filePath of files) {
      const fm = readFrontmatterBlock(filePath);
      const slug = extractFrontmatterField(fm, 'slug');
      if (!slug) continue;
      const dateStr = extractFrontmatterField(fm, 'updatedDate') ?? extractFrontmatterField(fm, 'pubDate');
      if (!dateStr) continue;
      const date = new Date(dateStr);
      if (!Number.isNaN(date.getTime())) {
        map.set(slug, date);
      }
    }
  } catch (err) {
    console.warn('[sitemap lastmod] blog frontmatter の読み取りに失敗しました:', err);
  }
  return map;
}

/**
 * elements: slug（ファイル名）-> lastmod(Date) のマップ。updated を使う
 * （essays 側とは逆に、常緑運用のため updated を正とする。意図的）。
 */
function buildElementsLastmodMap() {
  /** @type {Map<string, Date>} */
  const map = new Map();
  const elementsDir = path.join(__dirname, 'src/content/elements');
  try {
    const files = fs.readdirSync(elementsDir).filter((f) => /\.mdx?$/.test(f));
    for (const file of files) {
      const slug = file.replace(/\.mdx?$/, '');
      const filePath = path.join(elementsDir, file);
      const fm = readFrontmatterBlock(filePath);
      const updated = extractFrontmatterField(fm, 'updated');
      if (!updated) continue;
      const date = new Date(updated);
      if (!Number.isNaN(date.getTime())) {
        map.set(slug, date);
      }
    }
  } catch (err) {
    console.warn('[sitemap lastmod] elements frontmatter の読み取りに失敗しました:', err);
  }
  return map;
}

const blogLastmodBySlug = buildBlogLastmodMap();
const elementsLastmodBySlug = buildElementsLastmodMap();

/**
 * @param {import('@astrojs/sitemap').SitemapItem} item
 */
function serializeSitemapItem(item) {
  try {
    const { pathname } = new URL(item.url);

    const elementsMatch = pathname.match(/^\/elements\/([^/]+)\/?$/);
    if (elementsMatch) {
      const lastmod = elementsLastmodBySlug.get(elementsMatch[1]);
      return lastmod ? { ...item, lastmod: lastmod.toISOString() } : item;
    }

    // 固定ページ（/, /elements/, /license/, /author/yaoki/）はここには当たらないか、
    // 当たっても blog に同名 slug が無いため lastmod は付かない
    const blogMatch = pathname.match(/^\/([^/]+)\/?$/);
    if (blogMatch) {
      const lastmod = blogLastmodBySlug.get(blogMatch[1]);
      return lastmod ? { ...item, lastmod: lastmod.toISOString() } : item;
    }

    return item;
  } catch (err) {
    console.warn('[sitemap lastmod] serialize でエラー:', err);
    return item;
  }
}

// --- elements カードの検査をビルドの手前に置く -----------------------------
// package.json の script ではなく integration にしてあるのは、Cloudflare Pages 側が
// `astro build` を直に呼んでも必ず走らせるため。検査の中身は scripts/check-cards.mjs。

/** @type {import('astro').AstroIntegration} */
const checkCards = {
  name: 'check-cards',
  hooks: {
    'astro:build:start': async ({ logger }) => {
      const { runCardChecks } = await import('./scripts/check-cards.mjs');
      const { errors, cardCount } = runCardChecks(__dirname);
      if (errors.length > 0) {
        for (const error of errors) logger.error(`\n  ${error}`);
        throw new Error(
          `elements カードに ${errors.length} 件の指摘があります。公開前に直してください。`,
        );
      }
      logger.info(
        `カード ${cardCount} 枚、写し崩れと未検証の指摘なし` +
          `（貼付そのものが正しいかは、この検査では分かりません）`,
      );
    },
  },
};

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
    checkCards,
    mdx({
      remarkPlugins: [remarkRuby, remarkFirstImage, remarkTocExtract],
      rehypePlugins: [rehypeSlug],
    }),
    sitemap({
      serialize: serializeSitemapItem,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
