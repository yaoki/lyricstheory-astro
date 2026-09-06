// @ts-check
/**
 * elements カードを通し番号または部分一致で検索する。
 *
 * 使い方:
 *   node scripts/find-card.mjs E42       # 通し番号
 *   node scripts/find-card.mjs 42        # 同上（E は省略可）
 *   node scripts/find-card.mjs 粉雪       # title・song.title・song.artist・id の部分一致（大小無視）
 *   node scripts/find-card.mjs           # 引数無しなら全件
 *
 * 出力: `E42\ttitle\tid` を no 昇順で1行ずつ。
 *
 * frontmatter の読み方は scripts/check-cards.mjs と同じ正規表現流儀（YAML ライブラリを
 * 入れない）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const elementsDir = path.join(rootDir, 'src/content/elements');

/**
 * frontmatter ブロック（先頭の `---` 〜次の `---`）を返す。
 * @param {string} content
 */
function frontmatterOf(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : '';
}

/**
 * 1枚のカードから検索に要る材料を取り出す。
 * @param {string} filePath
 */
function readCard(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const frontmatter = frontmatterOf(content);

  const id = path.basename(filePath).replace(/\.mdx?$/, '');
  const noMatch = frontmatter.match(/^no:[ \t]*(\d+)[ \t]*$/m);
  const no = noMatch ? Number(noMatch[1]) : undefined;
  const title = (frontmatter.match(/^title:[ \t]*"(.*)"[ \t]*$/m) ?? [, ''])[1];

  const songBlock = frontmatter.match(/^song:\r?\n((?:[ \t]+.*\r?\n?)*)/m);
  const song = songBlock
    ? {
        title: (songBlock[1].match(/title:[ \t]*"([^"]*)"/) ?? [, ''])[1],
        artist: (songBlock[1].match(/artist:[ \t]*"([^"]*)"/) ?? [, ''])[1],
      }
    : null;

  return { id, no, title, song };
}

function main() {
  const query = process.argv.slice(2).join(' ').trim();

  const files = fs
    .readdirSync(elementsDir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => path.join(elementsDir, f));
  const cards = files.map(readCard).filter((c) => c.no !== undefined);

  /** @type {typeof cards} */
  let matched;

  if (!query) {
    matched = cards;
  } else {
    // E42 / 42（通し番号での指定）
    const noMatch = query.match(/^[Ee]?(\d+)$/);
    if (noMatch) {
      const target = Number(noMatch[1]);
      matched = cards.filter((c) => c.no === target);
    } else {
      // title / song.title / song.artist / id の部分一致（大小無視）
      const needle = query.toLowerCase();
      matched = cards.filter((c) => {
        const haystacks = [c.id, c.title, c.song?.title ?? '', c.song?.artist ?? ''];
        return haystacks.some((h) => h.toLowerCase().includes(needle));
      });
    }
  }

  matched
    .slice()
    .sort((a, b) => /** @type {number} */ (a.no) - /** @type {number} */ (b.no))
    .forEach((c) => {
      console.log(`E${c.no}\t${c.title}\t${c.id}`);
    });
}

main();
