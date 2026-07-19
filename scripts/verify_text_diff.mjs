/**
 * 変換前後のテキストが一致することを検証する。
 *
 * 手順:
 *   1. wpress の post_content(HTML) → タグ除去 → プレーンテキスト
 *   2. dist/{slug}/index.html → タグ除去 → プレーンテキスト（レンダリング結果）
 *   3. ホワイトスペース正規化 → 差分を比較
 *
 * 本文の逐語保存を機械的に担保するのが目的。差分ゼロを合格とする。
 * ただしダッシュ、句読点周辺のホワイトスペース、削除した [toc] などは差分として無視。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POSTS_JSON = path.join(ROOT, 'scripts/posts.json');
const DIST_DIR = path.join(ROOT, 'dist');

const posts = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf-8'));

function stripHtml(html) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
  const body = dom.window.document.body;
  return body.textContent || '';
}

function stripHtmlPageMain(html) {
  const dom = new JSDOM(html);
  const main = dom.window.document.querySelector('.post-body') || dom.window.document.body;
  return main.textContent || '';
}

function normalize(text) {
  return text
    .replace(/　/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function longestCommonSubsequenceDiff(a, b) {
  const chunkSize = 40;
  let i = 0, j = 0;
  const notes = [];
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return { ok: true, notes: [] };
  const min = Math.min(na.length, nb.length);
  let common = 0;
  for (let k = 0; k < min; k++) {
    if (na[k] === nb[k]) common++;
    else break;
  }
  notes.push(`最初の一致長: ${common}文字 / a=${na.length} / b=${nb.length}`);
  const aRest = na.slice(common, common + chunkSize);
  const bRest = nb.slice(common, common + chunkSize);
  notes.push(`差分開始付近 (a): ${JSON.stringify(aRest)}`);
  notes.push(`差分開始付近 (b): ${JSON.stringify(bRest)}`);
  return { ok: false, notes };
}

const results = [];
function preprocessForDiff(html) {
  // [toc] は削除
  let s = html.replace(/\[toc\]/gi, '');
  // 素の YouTube/youtu.be URL 行はエンベッドに置換されるので、テキスト比較からも除去
  s = s.replace(
    /(^|\n)\s*https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[A-Za-z0-9_-]+|youtu\.be\/[A-Za-z0-9_-]+)[^\s<]*/g,
    '',
  );
  // SoundCloud iframe URL は iframe そのものが変換対象なので、srcのURL文字列は元々textContentに現れない
  return s;
}

for (const post of posts) {
  const slug = post.slug;
  const src = stripHtml(preprocessForDiff(post.content_html));
  const distFile = path.join(DIST_DIR, slug, 'index.html');
  if (!fs.existsSync(distFile)) {
    results.push({ slug, ok: false, notes: [`ビルド結果が見つからない: ${distFile}`] });
    continue;
  }
  const rendered = stripHtmlPageMain(fs.readFileSync(distFile, 'utf-8'));
  const diff = longestCommonSubsequenceDiff(src, rendered);
  results.push({ slug, ok: diff.ok, notes: diff.notes, srcLen: normalize(src).length, distLen: normalize(rendered).length });
}

let pass = 0, fail = 0;
for (const r of results) {
  const mark = r.ok ? '✓' : '✗';
  console.log(`${mark} ${r.slug}  (src=${r.srcLen}, rendered=${r.distLen})`);
  if (!r.ok) {
    for (const n of r.notes) console.log(`    ${n}`);
    fail++;
  } else {
    pass++;
  }
}
console.log(`\n合格 ${pass} / ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
