/**
 * カードの歌詞引用（`<LyricQuote>`）から、モーラの「連なり」で引くための下ごしらえをする。
 *
 * ## 何のためにあるか
 *
 * `axis.ts` は phoneme タグを軸（子音・母音）へ**分解**し、共起で当てる。
 * これは「音の類縁で広く見る」段（軸の段）を支える。
 *
 * ここでやるのは逆で、**分解しない**。入力語をモーラ列にしたまま、カードの引用文に
 * それが連続部分列として現れるかどうかだけを見る。国歌大観の五句索引（句という連なりを
 * そのまま引く）に対応する「連なりの段」のロジックにあたる
 * （`docs/sound-lookup-plan.md` 参照）。
 *
 * ## ラベル・記号の除去は `scripts/check-cards.mjs` の `normalizeLyricLine` に倣う
 *
 * `<LyricQuote>` の中身には、歌詞そのもの以外に次が混じる（実測、93枚）。
 *
 * - `「」〈〉〔〕` — 呼応を示す囲み記号
 * - `**...**` — Markdown 強調（囲みと同じ用途で使われることがある）
 * - `1-サビ　` `ラストサビ　` `1-A　` `1-A'　` `1-b　` — 離れた2箇所を並べる pair カードの
 *   行頭ラベル。全角スペースの前がラベルにあたる。**カタカナの「サビ」を歌詞と誤認すると
 *   「さび」で引いたときに実在しない一致を返してしまう**ため、除去が要る
 * - `／` — 同じ行の中で複数箇所を並べる区切り。前後が実際に連続しているとは限らないので、
 *   分割して別々のセグメントとして扱う（`check-cards.mjs` と同じ判断）
 *
 * `.mjs` の関数をそのまま import できない（ビルド側は TypeScript ESM）ため、同じ判定を
 * ここに複製している。ロジックを変えるときは両方直すこと。
 *
 * ## 行をまたいで連結しない
 *
 * `<LyricQuote>` 内の改行は、「同じフレーズが2行に折り返されている」場合と、「回帰反復のように
 * 離れた2箇所を並べて見せている」場合の両方があり、本文の記述だけでは機械的に区別できない。
 * 連結すると後者で存在しない音列を合成してしまう（例: 1番の行末と2番の行頭をつなげてしまう）。
 * **疑わしきは連結しない**——行ごとに独立したセグメントとして持ち、取りこぼしは許容する。
 * 空振りは「まだ書いていない」という設計（sound-lookup-plan.md）と同じ側に倒している。
 */

import { kanaToMora } from './axis';

const BRACKETS = ['「', '」', '〈', '〉', '〔', '〕', '『', '』'];

/** 呼応の囲み記号と Markdown 強調記号を落とす。文字そのものは残す（歌詞の一部のため）。 */
function stripDecoration(line: string): string {
  let s = line.replace(/\*\*/g, '');
  for (const bracket of BRACKETS) s = s.split(bracket).join('');
  return s;
}

/**
 * 行頭ラベル（`1-サビ　`・`1-A　`・`ラストサビ　` 等）を落とす。
 *
 * 全角スペースより前の部分に、ひらがな・長音（`ぁ-ゟー`）以外の文字が1文字でも
 * 混じっていれば、そこまでを本文から外す。`check-cards.mjs` の `normalizeLyricLine` と
 * 同一の判定（数字・ハイフン・プライム・カタカナはすべて「ひらがな以外」に当たるので、
 * `1-サビ` `ラストサビ` `1-A'` のいずれも正しく落ちる）。
 */
function stripLeadingLabel(line: string): string {
  const labelled = line.match(/^([^　]*)　(.*)$/);
  if (labelled && /[^ぁ-ゟー]/.test(labelled[1])) return labelled[2];
  return line;
}

/**
 * MDX 本文（`entry.body`。frontmatter を除いた生ソース）から `<LyricQuote>` の中身を
 * すべて抜き出し、行・「／」区切りごとの**かな文字列**（クリーニング済み・モーラ化前）にする。
 *
 * `extractLyricQuoteSegments`（モーラ列を返す）と `extractLyricQuoteLines`（引用行索引が
 * 使う、かな文字列を返す）は前処理が完全に同じなので、ここに共通化してある。
 * ロジックを変えるときはこの1箇所を直せば両方に効く。
 */
function extractCleanedLines(body: string): string[] {
  const lines: string[] = [];
  for (const block of body.matchAll(/<LyricQuote[^>]*>([\s\S]*?)<\/LyricQuote>/g)) {
    for (const rawLine of block[1].trim().split('\n')) {
      for (const piece of rawLine.split('／')) {
        if (!piece.trim()) continue;
        const cleaned = stripLeadingLabel(stripDecoration(piece)).replace(/[\s　]/g, '');
        if (!cleaned) continue;
        lines.push(cleaned);
      }
    }
  }
  return lines;
}

/**
 * `extractCleanedLines` の結果をモーラ列（連なりの段が引く単位）にする。
 *
 * カタカナは `kanaToMora` 内部の `toHiragana` でひらがな化されるので、そのまま渡してよい
 * （利用者が「ムード」とカタカナで打っても、歌詞側のひらがな表記「むーど」と一致する）。
 * 漢字・英数字・記号は `kanaToMora` が読み飛ばす。
 *
 * `<LyricQuote>` を持たないカードには空配列を返す。呼び出し側はこれを
 * 「連なりの段の対象外（軸の段のみ）」として扱うこと。
 */
export function extractLyricQuoteSegments(body: string): string[][] {
  return extractCleanedLines(body)
    .map((cleaned) => kanaToMora(cleaned))
    .filter((mora) => mora.length > 0);
}

/**
 * 作業用の本（`BOOK=1`）の引用行索引が使う、クリーニング済みの**かな文字列**を返す。
 *
 * `extractLyricQuoteSegments` と同じ前処理を通すが、モーラ配列へ割らずに文字列のまま返す
 * ——索引は `Intl.Collator('ja')` で五十音順に並べるためで、モーラ配列は並べ替えに使えない。
 *
 * `kanaToMora(cleaned).length > 0` で絞るのは segments 側と対象を揃えるため（漢字だけの
 * 行のように、かな順に並べても意味を持たない行を落とす）。行はカードが既に引用している
 * 範囲そのものなので、この索引を足しても repo の引用総量は増えない。
 */
export function extractLyricQuoteLines(body: string): string[] {
  return extractCleanedLines(body).filter((line) => kanaToMora(line).length > 0);
}

/**
 * `segments` のいずれかが、`query` を**連続部分列**として含むか。
 *
 * 表記どおりの完全一致だけを見る（清濁・半濁の類音緩和はしない。それは軸の段の仕事）。
 * 空のクエリは常に false ——ボタン操作だけで語が無いときに全カードが「一致」する事故を防ぐ。
 */
export function containsMoraSubsequence(
  segments: readonly (readonly string[])[],
  query: readonly string[],
): boolean {
  if (query.length === 0) return false;
  return segments.some((seg) => {
    if (query.length > seg.length) return false;
    for (let start = 0; start <= seg.length - query.length; start += 1) {
      let matched = true;
      for (let i = 0; i < query.length; i += 1) {
        if (seg[start + i] !== query[i]) {
          matched = false;
          break;
        }
      }
      if (matched) return true;
    }
    return false;
  });
}
