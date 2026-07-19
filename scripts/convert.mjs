/**
 * WordPress の post_content(HTML) を MDX に変換する。
 *
 * ポリシー（アドバイザー助言）:
 *   本文テキストは一字も改変しない。マークアップのみ変更。
 *
 * 使い方:
 *   node scripts/convert.mjs
 *   → src/content/blog/<YYYY>/<slug>.mdx を全件出力
 *
 * ルール:
 *   - wpautop 相当: 空行区切りの平文を <p> でラップし、段落を保存
 *   - <a href="fullres.png"><img ...></a> lightbox 包み → img のみ残す
 *   - 画像 src の絶対URL http://lyricstheory.com/wordpress/... → /wordpress/... に相対化
 *   - 素の YouTube URL 行 → EmbedIframe プレースホルダ
 *   - SoundCloud <iframe> → EmbedIframe プレースホルダ
 *   - 他 iframe (youtube.com/embed/xxx 等) → EmbedIframe
 *   - [toc] ショートコード → 削除
 *   - 記事本文中の h1 は保持（Markdown # に変換される）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POSTS_JSON = path.join(ROOT, 'scripts/posts.json');
const OUT_DIR = path.join(ROOT, 'src/content/blog');

const posts = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf-8'));

/**
 * Embed をプレースホルダ文字列に符号化する。
 * turndown を通しても壊れないよう、Markdown 予約文字を含まない書式。
 * 復元時に元の JSX に置換する。
 */
const EMBED_MARK = '@@LTEMBED@@';
function encodeEmbed(provider, src, title) {
  const payload = Buffer.from(
    JSON.stringify({ provider, src, title }),
    'utf-8',
  ).toString('base64');
  return `${EMBED_MARK}${payload}${EMBED_MARK}`;
}

function extractYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

/**
 * wpautop の簡易実装。
 *   - 空行（\n\n）で分割
 *   - ブロックレベル要素で始まる/終わるものは <p> でラップしない
 *   - それ以外は <p>...</p> でラップ
 *   - 単改行 (\n) は <br /> にはせず、段落内のホワイトスペースとして温存
 */
const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'div', 'dl', 'fieldset',
  'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hr', 'main', 'nav', 'noscript', 'ol', 'p', 'pre', 'section',
  'table', 'ul', 'iframe', 'embed',
]);

function isBlockLine(line) {
  const t = line.trim();
  if (!t) return true;
  if (t.startsWith(EMBED_MARK)) return true;
  const m = t.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/);
  if (!m) return false;
  return BLOCK_TAGS.has(m[1].toLowerCase());
}

function wpautop(html) {
  const normalized = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (isBlockLine(trimmed)) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .filter((s) => s !== '')
    .join('\n\n');
}

/**
 * 前処理: エンベッドをプレースホルダ化、[toc] 削除。
 * これは wpautop の前に行う（プレースホルダはブロックとして扱われる）。
 */
function preprocess(html) {
  // 素の YouTube URL（行頭に近い位置に単独で出現）
  html = html.replace(
    /(^|\n)\s*(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[A-Za-z0-9_-]+|youtu\.be\/[A-Za-z0-9_-]+)[^\s<]*)\s*(?=\n|$)/g,
    (_m, lead, url) => {
      const id = extractYouTubeId(url);
      if (!id) return `${lead}${url}`;
      const embed = encodeEmbed('youtube', `https://www.youtube.com/embed/${id}`, 'YouTube 動画');
      return `${lead}${embed}`;
    },
  );

  // SoundCloud iframe
  html = html.replace(
    /<iframe[^>]*src=["']([^"']*soundcloud[^"']+)["'][^>]*>\s*<\/iframe>/gi,
    (_m, src) => {
      const decoded = src.replace(/&amp;/g, '&');
      return encodeEmbed('soundcloud', decoded, 'SoundCloud 音源');
    },
  );

  // その他 iframe
  html = html.replace(
    /<iframe[^>]*src=["']([^"']+)["'][^>]*>\s*<\/iframe>/gi,
    (_m, src) => {
      const decoded = src.replace(/&amp;/g, '&');
      if (/youtube\.com\/embed\//.test(decoded)) {
        const id = extractYouTubeId(decoded);
        return encodeEmbed('youtube', `https://www.youtube.com/embed/${id}`, 'YouTube 動画');
      }
      return encodeEmbed('other', decoded, '埋め込み');
    },
  );

  // [toc] ショートコード削除
  html = html.replace(/\[toc\]/gi, '');

  return html;
}

const td = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});

// CJK 文字周りでは CommonMark の `**` 強調・`*` 傍点が発動しない
// フランキング規則の影響を受ける。ラップに生 HTML タグを使うことで確実に描画させる。
td.addRule('strong', {
  filter: ['strong', 'b'],
  replacement: (content) => `<strong>${content}</strong>`,
});
td.addRule('emphasis', {
  filter: ['em', 'i'],
  replacement: (content) => `<em>${content}</em>`,
});

// turndown はデフォルトで `_` `*` を `\_` `\*` にエスケープする（強調記法との衝突回避）が、
// 本プロジェクトでは <strong>/<em> を生 HTML で保持するためエスケープ不要。
// URL 中の `_` まで `\_` になる副作用が実害（Twitter URL 破壊）を招くため無効化する。
td.escape = (str) =>
  str
    .replace(/\\/g, '\\\\')
    .replace(/^-/gm, '\\-')
    .replace(/^\+ /gm, '\\+ ')
    .replace(/^(=+)/gm, '\\$1')
    .replace(/^(#{1,6}) /gm, '\\$1 ')
    .replace(/`/g, '\\`')
    .replace(/^~~~/gm, '\\~~~')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/^>/gm, '\\>')
    .replace(/^(\d+)\. /gm, '$1\\. ');

td.addRule('image', {
  filter: 'img',
  replacement: (_content, node) => {
    const src = node.getAttribute('src') || '';
    const alt = node.getAttribute('alt') || '';
    return `![${alt}](${relativizeImage(src)})`;
  },
});

td.addRule('lightboxLink', {
  filter: (node) =>
    node.nodeName === 'A' &&
    node.childNodes.length === 1 &&
    node.childNodes[0].nodeName === 'IMG' &&
    /\.(png|jpe?g|gif|webp)($|\?)/i.test(node.getAttribute('href') || ''),
  replacement: (_content, node) => {
    const img = node.querySelector('img');
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    return `![${alt}](${relativizeImage(src)})`;
  },
});

function relativizeImage(src) {
  return src.replace(/^https?:\/\/(?:www\.)?lyricstheory\.com/, '');
}

function postprocessEmbeds(md) {
  const re = new RegExp(`${EMBED_MARK}([A-Za-z0-9+/=]+)${EMBED_MARK}`, 'g');
  return md.replace(re, (_m, payload) => {
    const { provider, src, title } = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    const props = [
      `provider="${provider}"`,
      `src=${JSON.stringify(src)}`,
      `title=${JSON.stringify(title)}`,
    ];
    return `\n\n<EmbedIframe ${props.join(' ')} />\n\n`;
  });
}

/**
 * MDX が安全に読める形に本文を最終整形。
 *   - 連続する空行を1つに正規化
 *   - 非タグの `<` を `\<` にエスケープ（例: `<グロッサリー：...>` を JSX と誤認させない）
 *   - `{` `}` を `\{` `\}` にエスケープ（MDX の JSX 式との衝突を回避）
 */
function tidyMarkdown(md) {
  const escapedLt = md
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/</g, (match, offset, str) => {
      const next = str[offset + 1] || '';
      // 有効な HTML/JSX 開始 (a-zA-Z, /, !, ?) を維持、それ以外はエスケープ
      if (/[a-zA-Z/!?]/.test(next)) return match;
      return '\\<';
    });
  return escapedLt.trim() + '\n';
}

function convertPost(post) {
  const preprocessed = preprocess(post.content_html);
  const paragraphed = wpautop(preprocessed);
  const md = td.turndown(paragraphed);
  return tidyMarkdown(postprocessEmbeds(md));
}

function firstParagraphAsDescription(md, max = 200) {
  const lines = md.split('\n');
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    if (s.startsWith('#')) continue;
    if (s.startsWith('<')) continue;
    if (s.startsWith('!')) continue;
    if (s.startsWith('>')) continue;
    const plain = s
      .replace(/<[^>]+>/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .replace(/\\([<{}])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (plain.length < 20) continue;
    if (plain.length <= max) return plain;
    return plain.slice(0, max).trim() + '…';
  }
  return md
    .replace(/<[^>]+>/g, '')
    .replace(/[#*_`~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function buildFrontmatter(post, body) {
  const pubDate = post.post_date.slice(0, 10);
  const updated = post.post_modified.slice(0, 10);
  const description = firstParagraphAsDescription(body);
  const tags = post.tags || [];
  const categories = post.categories || [];

  const lines = [
    '---',
    `title: ${JSON.stringify(post.title)}`,
    `description: ${JSON.stringify(description)}`,
    `pubDate: ${pubDate}`,
  ];
  if (updated && updated !== pubDate) lines.push(`updatedDate: ${updated}`);
  lines.push(`slug: ${post.slug}`);
  if (categories.length) lines.push(`categories: ${JSON.stringify(categories)}`);
  if (tags.length) lines.push(`tags: ${JSON.stringify(tags)}`);
  lines.push('draft: false');
  lines.push('---');
  return lines.join('\n');
}

function needsEmbedIframeImport(body) {
  return /<EmbedIframe\s/.test(body);
}

let writeCount = 0;
for (const post of posts) {
  const year = post.post_date.slice(0, 4);
  const outFile = path.join(OUT_DIR, year, `${post.slug}.mdx`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const md = convertPost(post);
  const frontmatter = buildFrontmatter(post, md);
  const imports = [];
  if (needsEmbedIframeImport(md)) {
    imports.push("import EmbedIframe from '../../../components/EmbedIframe.astro';");
  }
  const importBlock = imports.length ? '\n' + imports.join('\n') + '\n' : '';
  const finalMdx = `${frontmatter}\n${importBlock}\n${md}`;

  fs.writeFileSync(outFile, finalMdx);
  writeCount += 1;
  console.log(`✓ ${outFile}`);
}

console.log(`\n合計 ${writeCount} 記事を出力`);
