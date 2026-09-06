// @ts-check
/**
 * elements カードに通し番号 `no` を振る、一回きりの一括採番スクリプト。
 *
 * 方針: created 順の連番。追記のみ・改番禁止・欠番許容
 * （ケッヘル 2024 年版と同じ原則。挿入改番した旧ケッヘル・国歌大観は番号が
 * 二重化して破綻した）。表示形式は `E42`。
 *
 * 対象は `no` を持たないカードだけ（冪等）。既に `no` があるカードは触らない。
 * 整列キーは (a) frontmatter の created 昇順 → (b) git log --follow の最古の
 * 追加日時 → (c) ファイル名。同じ created 日付のカードが多いため、(b) が主な
 * タイブレーカーとして働く。
 *
 * `title:` 行の直後に `no: N` を**文字列挿入**する。YAML を再シリアライズしない
 * のは、コメントと引用符を壊すため（他のフィールドは正規表現で読むだけで、
 * ファイル全体の書き換えはしない）。
 *
 * 使い方: node scripts/assign-numbers.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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
 * そのファイルが git 上で最初に追加された日時（ISO 8601）を返す。
 * リネームを追うため --follow を使う。見つからなければ null。
 * @param {string} filePath
 * @returns {string | null}
 */
function earliestGitAddDate(filePath) {
  try {
    const out = execFileSync(
      'git',
      ['log', '--follow', '--diff-filter=A', '--format=%aI', '--', filePath],
      { cwd: rootDir, encoding: 'utf-8' },
    ).trim();
    if (!out) return null;
    const dates = out.split('\n').filter(Boolean);
    // git log は新しい順なので、最後の行が最古
    return dates[dates.length - 1] ?? null;
  } catch {
    return null;
  }
}

function main() {
  const files = fs
    .readdirSync(elementsDir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => path.join(elementsDir, f))
    .sort();

  /** @type {number[]} */
  const existingNos = [];
  /** @type {{ filePath: string, content: string, frontmatter: string, created: string, gitDate: string | null }[]} */
  const unnumbered = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatter = frontmatterOf(content);
    const noMatch = frontmatter.match(/^no:[ \t]*(\d+)[ \t]*$/m);
    if (noMatch) {
      existingNos.push(Number(noMatch[1]));
      continue;
    }
    const createdMatch = frontmatter.match(/^created:[ \t]*["']?([^"'\r\n]+?)["']?[ \t]*$/m);
    const created = createdMatch ? createdMatch[1].trim() : '';
    if (!created) {
      throw new Error(`created が読めません: ${filePath}`);
    }
    unnumbered.push({
      filePath,
      content,
      frontmatter,
      created,
      gitDate: earliestGitAddDate(filePath),
    });
  }

  if (unnumbered.length === 0) {
    console.log('[assign-numbers] no を持たないカードはありません（既に全カードに振られています）。');
    return;
  }

  unnumbered.sort((a, b) => {
    const createdDiff = new Date(a.created).valueOf() - new Date(b.created).valueOf();
    if (createdDiff !== 0) return createdDiff;
    const aGit = a.gitDate ? new Date(a.gitDate).valueOf() : Number.POSITIVE_INFINITY;
    const bGit = b.gitDate ? new Date(b.gitDate).valueOf() : Number.POSITIVE_INFINITY;
    if (aGit !== bGit) return aGit - bGit;
    return path.basename(a.filePath).localeCompare(path.basename(b.filePath));
  });

  let nextNo = existingNos.length > 0 ? Math.max(...existingNos) + 1 : 1;

  for (const item of unnumbered) {
    const no = nextNo;
    nextNo += 1;

    const titleLineMatch = item.content.match(/^title:.*$/m);
    if (!titleLineMatch) {
      throw new Error(`title 行が見つかりません: ${item.filePath}`);
    }
    const titleLine = titleLineMatch[0];
    const insertion = `${titleLine}\nno: ${no}`;
    const newContent = item.content.replace(titleLine, insertion);
    fs.writeFileSync(item.filePath, newContent);
    console.log(`[assign-numbers] E${no}\t${path.basename(item.filePath)}\t(created ${item.created}${item.gitDate ? `, git ${item.gitDate.slice(0, 10)}` : ''})`);
  }

  console.log(`[assign-numbers] ${unnumbered.length} 枚に no を振りました（E${nextNo - unnumbered.length}〜E${nextNo - 1}）。`);
}

main();
