// @ts-check
/**
 * elements カードを公開前に検査する。
 *
 * **この検査が保証するのは「貼付されたテキストが、カードの中で変異していないこと」だけである。**
 * 貼付そのものが誤っていれば、3つの検査すべてを素通りする。合格を「歌詞が正しい」証明として
 * 扱わないこと。
 *
 * 源泉の正しさを見るのは、この検査ではなく歌詞サイトとの照合（CLAUDE.md「歌詞の扱い」）である。
 * 段が違う。照合が貼付そのものを検算し、この検査が照合を通った貼付の変異を見る。
 *
 * 止めるもの:
 *   検査1  未検証の外部事実（`unverified` が残ったまま公開へ進むこと）
 *   検査2  同じ曲の同じ行が、カードによって違う字で書かれていること
 *   検査3  図の文字列が、同じカードの引用に無い字を含んでいること
 *
 * 検査2 は 2026-08-11 の事故（`ad1a478`、夏の魔物 1-A の「の」脱落。2枚のカードが同じ行を
 * 図にしていて片方だけ字が落ちていた）を、事故当時のツリーで誤検出ゼロのまま検出できる。
 * 検査3 は同じ commit が語る根本原因（「貼付が正で、1行に伸ばしたときの再入力が誤り」）を、
 * カード1枚の中で塞ぐ。
 *
 * 使い方:
 *   npm run check:cards         単体で走らせる
 *   npm run build               astro build の前に自動で走る（astro.config.mjs の integration）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 図の枠上限（`units` の 8）で末尾が落ちるため、図が引用より短いのは正常。 */
const MIN_COMPARABLE_LENGTH = 6;

/** 類似と見なす下限。これ以上似ていて、なお一致しない行を「写し崩れの疑い」とする。 */
const SIMILARITY_THRESHOLD = 0.85;

/** 別の箇所の引用を「似ている」と誤認しないための長さ差の上限。 */
const MAX_LENGTH_GAP = 3;

/**
 * 比較用に正規化する。呼応の鉤括弧・強調・空白は表記の都合なので落とし、
 * 音そのものだけを残す。行頭の位置ラベル（「1-サビ　」等）も落とす。
 * @param {string} raw
 * @returns {string}
 */
function normalizeLyricLine(raw) {
  let s = raw.replace(/\*\*/g, '');
  for (const bracket of ['「', '」', '〈', '〉', '〔', '〕']) {
    s = s.split(bracket).join('');
  }
  // 行頭ラベル: 全角空白の前にひらがな以外が混じっていれば、そこまでを落とす
  const labelled = s.match(/^([^　]*)　(.*)$/);
  if (labelled && /[^ぁ-ゟー]/.test(labelled[1])) s = labelled[2];
  return s.replace(/[\s　]/g, '').trim();
}

/**
 * 正規化後に、ひらがなと長音だけで出来ているか。
 * そうでない行は歌詞以外の記述が混じっているとみなし、検査から外す（誤検出を避けるため）。
 * @param {string} normalized
 */
function isPureKana(normalized) {
  return normalized.length > 0 && /^[ぁ-ゟー]+$/.test(normalized);
}

/**
 * レーベンシュタイン距離。
 * @param {string} a
 * @param {string} b
 */
function editDistance(a, b) {
  /** @type {number[]} */
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * 0〜1 の類似度。
 * @param {string} a
 * @param {string} b
 */
function similarity(a, b) {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest;
}

/**
 * frontmatter ブロック（先頭の `---` 〜次の `---`）を返す。
 * @param {string} content
 */
function frontmatterOf(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : '';
}

/**
 * 1枚のカードから、検査に要る材料を取り出す。
 * @param {string} filePath
 */
function readCard(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const frontmatter = frontmatterOf(content);

  /** @type {{ song: string, line: string, raw: string }[]} */
  const quotes = [];
  /** @type {string[]} */
  const skipped = [];
  for (const block of content.matchAll(/<LyricQuote([^>]*)>([\s\S]*?)<\/LyricQuote>/g)) {
    const song = (block[1].match(/song="([^"]*)"/) ?? [, '(曲名なし)'])[1];
    for (const rawLine of block[2].trim().split('\n')) {
      // 「／」は同じ行に複数箇所を並べる区切りなので、別々の引用として扱う
      for (const piece of rawLine.split('／')) {
        if (!piece.trim()) continue;
        const line = normalizeLyricLine(piece);
        if (!line) continue;
        if (isPureKana(line)) quotes.push({ song, line, raw: piece.trim() });
        else skipped.push(piece.trim());
      }
    }
  }

  // 図に出る文字列。
  //
  // キー名では拾わない。`figure:` ブロックの中の**最も内側の配列リテラル**を全部取る。
  // units（single / consonant）も rows（pair）も同じ形で拾え、インライン記法
  // （`rows: [["そ",…], ["そ",…]]`）と複数行リスト記法の両方に効く。行ごとに別々の
  // 配列として取れるので、2行を連結した偽の文字列も作らない。
  // labels（["1-A"]）や highlight（[2, 7]）のような歌詞でない配列は、下の isPureKana で落ちる。
  //
  // キー名で拾っていた 2026-08-12 以前は、インライン記法の pair 2枚が検査3から漏れていた。
  /** @type {string[]} */
  const figures = [];
  const figureBlock = frontmatter.match(/^figure:\r?\n((?:[ \t]+.*\r?\n?)*)/m);
  if (figureBlock) {
    for (const m of figureBlock[1].matchAll(/\[([^[\]]*)\]/g)) {
      const joined = [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]).join('');
      if (joined) figures.push(joined);
    }
    for (const m of figureBlock[1].matchAll(/text:[ \t]*"([^"]*)"/g)) {
      figures.push(m[1]);
    }
  }

  // `unverified` に項目が残っているか（空配列・キー無しは合格）
  // `\s*` は改行を食って次の行まで inline 値として拾ってしまうため、水平の空白だけを許す
  const unverifiedBlock = frontmatter.match(/^unverified:[ \t]*(.*)$((?:\r?\n[ \t]+-[ \t].*)*)/m);
  /** @type {string[]} */
  const unverified = [];
  if (unverifiedBlock) {
    const inline = unverifiedBlock[1].trim();
    if (inline && inline !== '[]') {
      for (const item of inline.replace(/^\[|\]$/g, '').split(',')) {
        const cleaned = item.trim().replace(/^["']|["']$/g, '');
        if (cleaned) unverified.push(cleaned);
      }
    }
    for (const item of (unverifiedBlock[2] ?? '').matchAll(/^[ \t]+-[ \t]*(.+)$/gm)) {
      unverified.push(item[1].trim().replace(/^["']|["']$/g, ''));
    }
  }

  // figure が歌詞以外（曲名など）から作られていることの明示
  const figureSourceMatch = frontmatter.match(/^figureSource:[ \t]*(.+)$/m);
  const figureSource = figureSourceMatch
    ? figureSourceMatch[1].trim().replace(/^["']|["']$/g, '')
    : '';

  return {
    slug: path.basename(filePath).replace(/\.mdx?$/, ''),
    quotes,
    figures: figures.map(normalizeLyricLine).filter(isPureKana),
    unverified,
    figureSource,
    skipped,
  };
}

/**
 * elements カード全体を検査する。
 * @param {string} rootDir リポジトリのルート
 * @returns {{ errors: string[], skipped: string[], cardCount: number }}
 */
export function runCardChecks(rootDir) {
  const dir = path.join(rootDir, 'src/content/elements');
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => path.join(dir, f));
  const cards = files.map(readCard);

  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const skipped = [];

  // 検査1: 未検証の外部事実が残ったまま公開へ進むのを止める
  for (const card of cards) {
    if (card.unverified.length === 0) continue;
    errors.push(
      `[未検証] ${card.slug}\n` +
        card.unverified.map((item) => `    ・${item}`).join('\n') +
        `\n    → 出所を確かめて値を確定するか、その項目自体を書かずに出すか、どちらかにしてください。` +
        `\n      sources は任意項目なので「書かない」は常にビルドを通ります。`,
    );
  }

  // 検査2: 同じ曲の同じ行が、カードによって違う字で書かれていないか
  /** @type {Map<string, { slug: string, line: string, raw: string }[]>} */
  const bySong = new Map();
  for (const card of cards) {
    for (const q of card.quotes) {
      if (q.line.length < MIN_COMPARABLE_LENGTH) continue;
      const bucket = bySong.get(q.song) ?? [];
      bucket.push({ slug: card.slug, line: q.line, raw: q.raw });
      bySong.set(q.song, bucket);
    }
    skipped.push(...card.skipped.map((s) => `${card.slug}: ${s}`));
  }
  for (const [song, items] of bySong) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        // 同じカードの中の2行は比べない。回帰反復や対句のカードは「一音だけ違う2行」を
        // 意図して並べる（`tadashii-machi-return-repetition` の「を」→「も」など）。
        // 検査2が見たいのは、別々のカードが同じ行を違う字で書いていることである。
        if (a.slug === b.slug) continue;
        if (a.line === b.line) continue;
        if (Math.abs(a.line.length - b.line.length) > MAX_LENGTH_GAP) continue;
        if (similarity(a.line, b.line) < SIMILARITY_THRESHOLD) continue;
        errors.push(
          `[写し崩れの疑い] 「${song}」の同じ行が、カードによって違う字で書かれています\n` +
            `    ${a.slug}: ${a.raw}\n` +
            `    ${b.slug}: ${b.raw}\n` +
            `    → 貼付されたテキストに戻って、どちらが正しいかを確かめてください。`,
        );
      }
    }
  }

  // 検査4: 図に歌詞があるのに、引用の裏づけが無い
  //
  // 検査2は `<LyricQuote song="...">` の song 属性で曲を同定し、検査3は同じカードの引用と
  // 突き合わせる。どちらも引用が起点なので、引用を持たないカードは 2 つとも素通りする。
  // 2026-08-12 の実測でそれが11枚あった（pretender 3 / tadashii-machi 7 / shido 1）。
  for (const card of cards) {
    if (card.figures.length === 0) continue;
    if (card.quotes.length > 0) continue;
    if (card.figureSource) continue; // 歌詞以外が出所だと明示されている
    errors.push(
      `[引用の裏づけが無い図] ${card.slug}\n` +
        `    図: ${card.figures.join(' ／ ')}\n` +
        `    → このカードは <LyricQuote> を持たないため、検査2（写し崩れ）と検査3（図と引用の\n` +
        `      不一致）の両方から外れています。図の歌詞を誰も検算していません。\n` +
        `      歌詞から取った図なら <LyricQuote> で引用を示してください（作詞者と年が読者に出ます）。\n` +
        `      曲名など歌詞以外から作った図なら、frontmatter の figureSource にその出所を書いてください。`,
    );
  }

  // 検査3: 図の文字列が、同じカードの引用に含まれているか
  for (const card of cards) {
    if (card.quotes.length === 0) continue;
    const haystack = card.quotes.map((q) => q.line).join('／');
    for (const figure of card.figures) {
      if (figure.length < 4) continue;
      if (haystack.includes(figure)) continue;
      errors.push(
        `[図と引用の不一致] ${card.slug}\n` +
          `    図　: ${figure}\n` +
          `    引用: ${haystack}\n` +
          `    → 図は引用の範囲から切り出します。前後を落とすのは正常ですが、` +
          `途中の音が変わっている・落ちているのは写し崩れです。`,
      );
    }
  }

  return { errors, skipped, cardCount: cards.length };
}

const __filename = fileURLToPath(import.meta.url);

/** CLI として直に叩かれたときの入口。 */
function main() {
  const rootDir = path.resolve(path.dirname(__filename), '..');
  const { errors, skipped, cardCount } = runCardChecks(rootDir);

  if (skipped.length > 0) {
    console.log(`[check-cards] 歌詞以外の記述が混じるため検査から外した行: ${skipped.length} 件`);
    for (const s of skipped) console.log(`    ${s}`);
  }

  if (errors.length === 0) {
    console.log(`[check-cards] カード ${cardCount} 枚、指摘なし。`);
    console.log(
      '[check-cards] ただしこれは「貼付後に変異していない」ことの確認であって、' +
        '歌詞そのものが正しいことの確認ではありません（源泉は歌詞サイト照合が見ます）。',
    );
    return;
  }

  console.error(`[check-cards] カード ${cardCount} 枚に ${errors.length} 件の指摘があります。\n`);
  for (const e of errors) console.error(`  ${e}\n`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();
