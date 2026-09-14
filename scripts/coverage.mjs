// @ts-check
/**
 * elements カード（`src/content/elements/*.mdx`）の引用の囲みが、貼付された歌詞のうち
 * 指定した軸（カ行・サ行……）を**すべて**覆っているかを機械で確かめる。
 *
 * 背景: 1カードの引用は 1〜2行に制限されている（CLAUDE.md「引用ルール」）ため、
 * ある節のある軸の音を「全部」記述するには行ごとに何枚にもカードを割る必要があり、
 * これまで Claude が途中で忘れて1枚だけ書いて終わることがあった。
 * やおきさんの方針は「全部を記述し、列挙する」——このスクリプトは、まだどのカードの
 * 引用の囲み「」〈〉〔〕にも入っていない音を一覧で出す。
 *
 * **歌詞をファイルに書かない。** 歌詞は標準入力または --file で受け取り、結果は
 * 標準出力にのみ出す（repo は public）。
 *
 * 使い方:
 *   npm run coverage -- --song 車輪の唄 [--axis カ行] [--section 1-A] [--file <path>] < 歌詞
 *
 * 歌詞の読み方:
 *   --file が .md なら、frontmatter の後に最初に現れる ``` コードブロックの中身を歌詞として読む。
 *   それ以外（拡張子なし・.txt 等）は、ファイル全体を歌詞として読む。
 *   --file を省略したら標準入力を読む。
 *
 * 節の切り替え: `/^\d+-\S+$/`（例 `1-A'` `1-サビ`）にマッチする単独行を節見出しとする。
 * 見出しが一つも無ければ、節名は `-` になる。空行は無視する（節を切り替えない・行番号を増やさない）。
 *
 * 正規化規則は `scripts/check-cards.mjs` の `normalizeLyricLine` に合わせてある
 * （囲み「」〈〉〔〕・`**`・行頭ラベル・空白の扱い）。加えてカタカナはひらがなに寄せる。
 *
 * 音の単位（モーラ）の切り方は `src/lib/og/phrase.ts` / `src/lib/og/text.ts` の
 * `COMBINING` に揃える（拗音・小書き・長音は前の音に結合、促音「っ」・撥音「ん」は独立）。
 *
 * 軸（行）の判定は単位の先頭の仮名で決め、清濁は統合する
 * （カ行＝か〜こ＋が〜ご、サ行＝さ〜そ＋ざ〜ぞ、タ行＝た〜と＋だ〜ど、ハ行＝は〜ほ＋ば〜ぼ＋ぱ〜ぽ）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const ELEMENTS_DIR = path.join(ROOT_DIR, 'src/content/elements');

/** 直前の音に結合する文字（拗音・小書き仮名・長音符）。src/lib/og/text.ts の COMBINING に合わせる。 */
const COMBINING = /[ゃゅょャュョぁぃぅぇぉァィゥェォヵヶーｰ]/;

/** 節見出しの判定。「1-A'」「1-サビ」程度を許す。 */
const SECTION_RE = /^\d+-\S+$/;

/** 軸（行）ごとの構成音。清濁は統合する。 */
const ROW_CHARS = {
  カ行: 'かきくけこがぎぐげご',
  サ行: 'さしすせそざじずぜぞ',
  タ行: 'たちつてとだぢづでど',
  ナ行: 'なにぬねの',
  ハ行: 'はひふへほばびぶべぼぱぴぷぺぽ',
  マ行: 'まみむめも',
  ヤ行: 'やゆよゃゅょ',
  ラ行: 'らりるれろ',
  ワ行: 'わをゎ',
};

const VOWELS = 'あいうえおぁぃぅぇぉ';

/** --axis で指定できる軸の一覧（表示順）。 */
const AXIS_LABELS = ['カ行', 'サ行', 'タ行', 'ナ行', 'ハ行', 'マ行', 'ヤ行', 'ラ行', 'ワ行', '母音のみ', 'ん', 'っ'];

const CHAR_TO_ROW = new Map();
for (const [label, chars] of Object.entries(ROW_CHARS)) {
  for (const ch of chars) CHAR_TO_ROW.set(ch, label);
}

/**
 * 単位（モーラ）の軸を、先頭の仮名から決める。
 * @param {string} unitText
 */
function axisOf(unitText) {
  const lead = unitText[0];
  if (lead === 'ん') return 'ん';
  if (lead === 'っ') return 'っ';
  if (VOWELS.includes(lead)) return '母音のみ';
  return CHAR_TO_ROW.get(lead) ?? 'その他';
}

/**
 * カタカナをひらがなに寄せる（長音「ー」はそのまま）。
 * @param {string} str
 */
function kataToHira(str) {
  return str.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/**
 * `scripts/check-cards.mjs` の `normalizeLyricLine` と同じ規則で正規化しつつ、
 * 囲み「」〈〉〔〕の中にあった文字だけ位置を保ったまま印を付ける。
 *
 * 手順（check-cards と同じ順序）: `**` を除去 → 囲みの記号だけを除去（中身は残す）→
 * 行頭ラベル（全角空白の前が非仮名なら、そこまで落とす）→ 空白・読点を除去。
 *
 * @param {string} raw
 * @returns {{ chars: string[], flags: boolean[] }} 残った文字と、各文字が囲みの中にあったか
 */
function stripForMatch(raw) {
  let s = kataToHira(raw);
  s = s.replace(/\*\*/g, '');
  const chars = [...s];

  const OPEN = new Set(['「', '〈', '〔']);
  const CLOSE = new Set(['」', '〉', '〕']);
  /** @type {string[]} */
  let s2 = [];
  /** @type {boolean[]} */
  let flags2 = [];
  let inBracket = false;
  for (const ch of chars) {
    if (OPEN.has(ch)) {
      inBracket = true;
      continue;
    }
    if (CLOSE.has(ch)) {
      inBracket = false;
      continue;
    }
    s2.push(ch);
    flags2.push(inBracket);
  }

  // 行頭ラベル（例:「1-サビ　」）。全角空白より前に非仮名が混じっていれば、そこまで落とす
  const s2Str = s2.join('');
  const spaceIdx = s2Str.indexOf('　');
  if (spaceIdx !== -1) {
    const prefix = s2Str.slice(0, spaceIdx);
    if (/[^ぁ-ゟー]/.test(prefix)) {
      s2 = s2.slice(spaceIdx + 1);
      flags2 = flags2.slice(spaceIdx + 1);
    }
  }

  /** @type {string[]} */
  const outChars = [];
  /** @type {boolean[]} */
  const outFlags = [];
  for (let i = 0; i < s2.length; i++) {
    const ch = s2[i];
    if (/[\s　、,]/.test(ch)) continue;
    outChars.push(ch);
    outFlags.push(flags2[i]);
  }
  return { chars: outChars, flags: outFlags };
}

/**
 * 正規化済みの文字列を、音の単位（モーラ）に切る。拗音・小書き・長音は前の単位に結合する。
 * @param {string[]} chars
 */
function tokenizeUnits(chars) {
  /** @type {{ text: string, covered: Set<string> }[]} */
  const units = [];
  /** @type {number[]} */
  const charToUnit = [];
  for (const ch of chars) {
    if (units.length > 0 && COMBINING.test(ch)) {
      units[units.length - 1].text += ch;
    } else {
      units.push({ text: ch, covered: new Set() });
    }
    charToUnit.push(units.length - 1);
  }
  return { units, charToUnit };
}

/**
 * 歌詞ファイル（.md）から、frontmatter の後で最初に現れる ``` コードブロックの中身を取る。
 * @param {string} text
 */
function extractFirstCodeBlock(text) {
  const startFence = text.indexOf('```');
  if (startFence === -1) return null;
  const afterFenceLine = text.indexOf('\n', startFence);
  if (afterFenceLine === -1) return null;
  const endFence = text.indexOf('```', afterFenceLine + 1);
  if (endFence === -1) return null;
  return text.slice(afterFenceLine + 1, endFence);
}

/** @param {{ file?: string }} opts */
function readLyricsText(opts) {
  if (opts.file) {
    const raw = fs.readFileSync(opts.file, 'utf-8');
    if (/\.md$/i.test(opts.file)) {
      const block = extractFirstCodeBlock(raw);
      if (block === null) {
        console.error('--file に .md を指定しましたが、最初の ``` コードブロックが見つかりませんでした。');
        process.exit(2);
      }
      return block;
    }
    return raw;
  }
  if (process.stdin.isTTY) {
    console.error(
      '歌詞が標準入力から与えられていません。パイプで渡すか --file <path> を指定してください。',
    );
    process.exit(2);
  }
  return fs.readFileSync(0, 'utf-8');
}

/**
 * 歌詞テキストを節・行に分ける。空行は無視する（節を切り替えず、行番号も増やさない）。
 * @param {string} text
 */
function parseLyrics(text) {
  const rawLines = text.split(/\r?\n/);
  /** @type {string[]} */
  const sections = [];
  /** @type {{ section: string, indexInSection: number, raw: string }[]} */
  const lines = [];
  /** @type {Map<string, number>} */
  const counts = new Map();
  let current = null;

  for (const rawLine of rawLines) {
    const t = rawLine.trim();
    if (t === '') continue;
    if (SECTION_RE.test(t)) {
      current = t;
      if (!sections.includes(current)) sections.push(current);
      if (!counts.has(current)) counts.set(current, 0);
      continue;
    }
    if (current === null) {
      current = '-';
      if (!sections.includes(current)) sections.push(current);
      if (!counts.has(current)) counts.set(current, 0);
    }
    const idx = (counts.get(current) ?? 0) + 1;
    counts.set(current, idx);
    lines.push({ section: current, indexInSection: idx, raw: t });
  }
  return { sections, lines };
}

/**
 * 1行ぶんの解析結果（正規化済み文字列・単位・文字→単位の対応）を作る。
 * @param {string} raw
 * @param {string} section 節の見出し（表示用）
 * @param {number} indexInSection 節の中の行番号（1始まり、表示用）
 */
function analyzeLine(raw, section, indexInSection) {
  const { chars, flags } = stripForMatch(raw);
  const { units, charToUnit } = tokenizeUnits(chars);
  return { raw, section, indexInSection, cleanStr: chars.join(''), chars, flags, units, charToUnit };
}

/**
 * frontmatter のブロック（先頭の `---` 〜次の `---`）を返す。check-cards.mjs と同じ。
 * @param {string} content
 */
function frontmatterOf(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : '';
}

/**
 * `--song` に一致するカードを読み、通し番号と LyricQuote の各行（断片）を取り出す。
 * @param {string} songTitle
 */
function loadCards(songTitle) {
  if (!fs.existsSync(ELEMENTS_DIR)) return [];
  const files = fs
    .readdirSync(ELEMENTS_DIR)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => path.join(ELEMENTS_DIR, f));

  /** @type {{ slug: string, no: number | undefined, label: string, pieces: string[] }[]} */
  const cards = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatter = frontmatterOf(content);

    const songBlock = frontmatter.match(/^song:\r?\n((?:[ \t]+.*\r?\n?)*)/m);
    const title = songBlock ? (songBlock[1].match(/title:[ \t]*"([^"]*)"/) ?? [, ''])[1] : '';
    if (title !== songTitle) continue;

    const noLineMatch = frontmatter.match(/^no:[ \t]*(.+?)[ \t]*$/m);
    const noRaw = noLineMatch ? noLineMatch[1] : undefined;
    const no = noRaw !== undefined && /^\d+$/.test(noRaw) ? Number(noRaw) : undefined;
    const slug = path.basename(filePath).replace(/\.mdx?$/, '');
    const label = no !== undefined ? `E${no}` : `E?(${slug})`;

    /** @type {string[]} */
    const pieces = [];
    for (const block of content.matchAll(/<LyricQuote([^>]*)>([\s\S]*?)<\/LyricQuote>/g)) {
      const blockSong = (block[1].match(/song="([^"]*)"/) ?? [, ''])[1];
      if (blockSong !== songTitle) continue;
      for (const rawLine of block[2].trim().split('\n')) {
        for (const piece of rawLine.split('／')) {
          if (piece.trim()) pieces.push(piece.trim());
        }
      }
    }
    cards.push({ slug, no, label, pieces });
  }

  // no 昇順（無いものは末尾）で安定した表示順にする
  cards.sort((a, b) => (a.no ?? Infinity) - (b.no ?? Infinity));
  return cards;
}

/**
 * カードの引用を歌詞の行に突き合わせ、囲み「」〈〉〔〕の中の単位を「掲載済み」として印す。
 * @param {ReturnType<typeof loadCards>} cards
 * @param {ReturnType<typeof analyzeLine>[]} lineData
 */
function applyCoverage(cards, lineData) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const dupNotes = [];
  /** @type {string[]} */
  const skippedPieces = [];

  for (const card of cards) {
    for (const piece of card.pieces) {
      const { chars: pChars, flags: pFlags } = stripForMatch(piece);
      const clean = pChars.join('');
      if (!clean) continue;
      if (!/^[ぁ-ゟー]+$/.test(clean)) {
        skippedPieces.push(`${card.label}: ${piece}`);
        continue;
      }

      /** @type {typeof lineData[number][]} */
      const matchedLines = [];
      for (const line of lineData) {
        let from = 0;
        let found = false;
        while (true) {
          const at = line.cleanStr.indexOf(clean, from);
          if (at === -1) break;
          found = true;
          for (let i = 0; i < clean.length; i++) {
            if (pFlags[i]) {
              const unitIndex = line.charToUnit[at + i];
              line.units[unitIndex].covered.add(card.label);
            }
          }
          from = at + 1;
        }
        if (found) matchedLines.push(line);
      }

      if (matchedLines.length === 0) {
        warnings.push(`${card.label} の引用「${piece}」が歌詞のどの行にも一致しません（貼付とカードの字が違う可能性）。`);
      } else if (matchedLines.length > 1) {
        const where = matchedLines.map((l) => `${l.section} ${l.indexInSection}行目`).join(' / ');
        dupNotes.push(`${card.label} の引用「${piece}」は複数行に一致（重複行）: ${where}`);
      }
    }
  }

  return { warnings, dupNotes, skippedPieces };
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ song?: string, axis?: string, section?: string, file?: string, help: boolean }} */
  const opts = { song: undefined, axis: undefined, section: undefined, file: undefined, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--song') opts.song = argv[++i];
    else if (a === '--axis') opts.axis = argv[++i];
    else if (a === '--section') opts.section = argv[++i];
    else if (a === '--file') opts.file = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

function printUsage() {
  console.error(
    [
      'npm run coverage -- --song <曲名> [--axis <カ行等>] [--section <1-A等>] [--file <path>] < 歌詞',
      '',
      '--axis を省略すると全軸、--section を省略すると全節について出す。',
      `使える軸: ${AXIS_LABELS.join(' / ')}`,
      '歌詞は標準入力、または --file（.md なら最初の ``` コードブロックの中身）で渡す。',
    ].join('\n'),
  );
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printUsage();
    process.exit(0);
  }
  if (!opts.song) {
    console.error('--song が必要です。\n');
    printUsage();
    process.exit(2);
  }
  if (opts.axis && !AXIS_LABELS.includes(opts.axis)) {
    console.error(`不明な軸: "${opts.axis}"。使える軸: ${AXIS_LABELS.join(' / ')}`);
    process.exit(2);
  }

  const lyricsText = readLyricsText(opts);
  const { sections, lines } = parseLyrics(lyricsText);

  if (opts.section && !sections.includes(opts.section)) {
    console.error(`指定された節 "${opts.section}" が歌詞の中に見つかりません。節一覧: ${sections.join(', ')}`);
    process.exit(2);
  }

  const lineData = lines.map((l) => analyzeLine(l.raw, l.section, l.indexInSection));

  const cards = loadCards(opts.song);
  if (cards.length === 0) {
    console.error(`警告: song="${opts.song}" に一致するカードが src/content/elements/ に見つかりません。`);
  }

  const { warnings, dupNotes, skippedPieces } = applyCoverage(cards, lineData);

  console.log(`=== ${opts.song}（カード ${cards.length} 枚: ${cards.map((c) => c.label).join(', ') || 'なし'}） ===`);
  console.log();

  if (warnings.length > 0) {
    console.log('--- 警告: 歌詞に見つからない引用 ---');
    for (const w of warnings) console.log(`  ${w}`);
    console.log();
  }
  if (dupNotes.length > 0) {
    console.log('--- 注記: 複数行に一致した引用（重複行） ---');
    for (const n of dupNotes) console.log(`  ${n}`);
    console.log();
  }
  if (skippedPieces.length > 0) {
    console.log('--- 除外: 仮名以外を含む引用（歌詞以外の記述が混じっている可能性） ---');
    for (const s of skippedPieces) console.log(`  ${s}`);
    console.log();
  }

  const targetSections = opts.section ? [opts.section] : sections;
  const targetAxes = opts.axis ? [opts.axis] : AXIS_LABELS;

  let anyUncovered = false;

  for (const section of targetSections) {
    const sectionLines = lineData.filter((l) => l.section === section);
    console.log(`### 節 ${section}（${sectionLines.length}行） ###`);

    let sectionTotal = 0;
    let sectionCovered = 0;

    for (const axis of targetAxes) {
      let axisTotal = 0;
      let axisCovered = 0;
      const lineReports = [];

      for (const line of sectionLines) {
        const axisUnits = line.units
          .map((u, idx) => ({ u, idx }))
          .filter(({ u }) => axisOf(u.text) === axis);
        if (axisUnits.length === 0) continue;

        axisTotal += axisUnits.length;
        /** @type {string[]} */
        const uncoveredPositions = [];
        const cardsInvolved = new Set();
        // 位置は行の中の何音目か（1始まり）。カード本文の「12音中の1・4・10音目」と同じ数え方
        axisUnits.forEach(({ u, idx }) => {
          if (u.covered.size > 0) {
            axisCovered++;
            for (const c of u.covered) cardsInvolved.add(c);
          } else {
            uncoveredPositions.push(`${idx + 1}「${u.text}」`);
          }
        });

        lineReports.push({
          indexInSection: line.indexInSection,
          lineLength: line.units.length,
          count: axisUnits.length,
          uncoveredCount: uncoveredPositions.length,
          uncoveredPositions,
          cards: [...cardsInvolved],
        });
      }

      if (axisTotal === 0) continue; // この軸はこの節に出現しない

      console.log(`  [${axis}]`);
      for (const r of lineReports) {
        const cardsStr = r.cards.length > 0 ? r.cards.join(',') : 'なし';
        if (r.uncoveredCount === 0) {
          console.log(`    ${r.indexInSection}行目: 該当${r.count}音・未掲載0 / 担当カード: ${cardsStr}`);
        } else {
          console.log(
            `    ${r.indexInSection}行目: 該当${r.count}音・未掲載${r.uncoveredCount}（${r.lineLength}音中 ${r.uncoveredPositions.join('・')} 音目）/ 担当カード: ${cardsStr}`,
          );
          anyUncovered = true;
        }
      }
      const axisUncovered = axisTotal - axisCovered;
      console.log(`  → 小計: 全${axisTotal}音 / 掲載${axisCovered} / 未掲載${axisUncovered}`);
      console.log();

      sectionTotal += axisTotal;
      sectionCovered += axisCovered;
    }

    if (!opts.axis) {
      console.log(`  == 節合計（全軸）: 全${sectionTotal}音 / 掲載${sectionCovered} / 未掲載${sectionTotal - sectionCovered} ==`);
      console.log();
    }
  }

  process.exit(anyUncovered ? 1 : 0);
}

main();
