/**
 * tags.phoneme の値を「引ける軸」へ分解する。
 *
 * ## 申告と到達を分ける
 *
 * **保存されるタグは分解しない。** CLAUDE.md「phoneme romaji 正規化ルール」が
 * 警告しているとおり、融合トークン `kei` を `[ke, i]` に割って**保存**すると、
 * 「ke について観察した」という存在しない申告が登録され、未共起ペアのバックログから
 * 本物の未探索が消える。
 *
 * ここでやるのは**到達（クエリ）側**の分解である。カードが何を申告したか
 * （＝ファイルに書かれた文字列）は一切触らない。
 *
 * ## 包含は片方向
 *
 * - `t` で引く → `t` のカード（直接）＋ `ta` `te` `to` `tsu` のカード（包含で到達）
 * - `ta` で引く → `ta` のカードだけ。`t` のカードは「ta を観察した」とは言っていない
 *
 * これを入れないと、同じ音がタグの粒度で割れたまま集計される。実測（2026-08-13、93枚）で
 * `t` は16枚・`ta` は7枚あるが、文字列一致では一度も交わらなかった。軸に畳むと
 * t軸は27枚に届き、1枚しか無い軸は生タグの23件から6件へ減る。
 */

/** ヘボン式の頭子音。長いものから順に見る（`sh` を `s` より先に取るため） */
const ONSETS = [
  'ky', 'gy', 'ny', 'hy', 'by', 'py', 'my', 'ry',
  'sh', 'ch', 'ts',
  'k', 'g', 's', 'z', 'j', 't', 'd', 'n', 'h', 'f', 'b', 'p', 'm', 'y', 'r', 'w',
] as const;

const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);

/** 撥音・促音は音節末の子音として軸に立てる（正規化ルール 1・2） */
export const MORAIC_N = 'ん';
export const MORAIC_Q = 'っ';

export type ParsedTag = {
  /** 頭子音。母音単独タグ（`a` など）では null */
  onset: string | null;
  /** 核母音。融合トークン（`kei` = k + e + i）では複数 */
  vowels: string[];
  /** 音節末子音。撥音（`kin` の n）か促音 */
  coda: typeof MORAIC_N | typeof MORAIC_Q | null;
};

/**
 * 1 つの phoneme タグを頭子音・核母音・音節末子音へ割る。
 *
 * 裸の `n` は**ナ行子音**として扱う。撥音ではない——実測（93枚）で `n` を持つ
 * 3 枚はいずれもナ行の観察だった（`tadashii-machi-n-pivot` の figure は
 * axis: "ナ行子音ピボット"、`natsu-no-mamono-tn-sequenz` は子音のゼクエンツ、
 * `hello-again-mmmnn-fusion` は子音重複による融合）。
 *
 * ただし正規化ルール 1 は撥音も `n` と綴るので、**撥音だけを観察したカードが
 * 書かれた時点でこの 2 つは衝突する。** そのときは撥音側に別の綴りを与えるか、
 * ここで両方の軸へ載せるかを決める必要がある。いまは衝突していない。
 */
export function parseTag(tag: string): ParsedTag {
  if (tag === 'q') return { onset: null, vowels: [], coda: MORAIC_Q };

  let rest = tag;
  let onset: string | null = null;
  for (const candidate of ONSETS) {
    if (rest.startsWith(candidate)) {
      onset = candidate;
      rest = rest.slice(candidate.length);
      break;
    }
  }

  // 末尾の n は撥音（`kin` = k + i + ん）。ただし裸の `n` は上で頭子音として取れており、
  // rest が空なのでここへは来ない
  let coda: ParsedTag['coda'] = null;
  if (rest.endsWith('n')) {
    coda = MORAIC_N;
    rest = rest.slice(0, -1);
  }

  return { onset, vowels: rest.split('').filter((c) => VOWELS.has(c)), coda };
}

export type Axes = { consonants: string[]; vowels: string[] };

/** タグの配列から、到達可能な子音軸・母音軸を取る */
export function axesOf(tags: readonly string[]): Axes {
  const consonants = new Set<string>();
  const vowels = new Set<string>();
  for (const tag of tags) {
    const { onset, vowels: nuclei, coda } = parseTag(tag);
    if (onset) consonants.add(onset);
    if (coda) consonants.add(coda);
    for (const v of nuclei) vowels.add(v);
  }
  return { consonants: [...consonants], vowels: [...vowels] };
}

/** 軸の日本語ラベル。図の `axis` 欄（「カ行子音」）と同じ言い方に寄せる */
export const CONSONANT_LABELS: Record<string, string> = {
  k: 'カ行', g: 'ガ行', s: 'サ行', sh: 'シャ行', z: 'ザ行', j: 'ジャ行',
  t: 'タ行', ch: 'チャ行', ts: 'ツ', d: 'ダ行', n: 'ナ行', h: 'ハ行',
  f: 'フ', b: 'バ行', p: 'パ行', m: 'マ行', y: 'ヤ行', r: 'ラ行', w: 'ワ行',
  ky: 'キャ行', gy: 'ギャ行', ny: 'ニャ行', hy: 'ヒャ行', by: 'ビャ行',
  py: 'ピャ行', my: 'ミャ行', ry: 'リャ行',
  [MORAIC_N]: '撥音', [MORAIC_Q]: '促音',
};

export const VOWEL_LABELS: Record<string, string> = {
  a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ',
};

/** 表示順。五十音の並びに合わせる（頻度順だと軸の位置が枚数で動いて覚えられない） */
export const CONSONANT_ORDER = [
  'k', 'ky', 'g', 'gy', 's', 'sh', 'z', 'j', 't', 'ch', 'ts', 'd',
  'n', 'ny', 'h', 'hy', 'f', 'b', 'by', 'p', 'py', 'm', 'my', 'y',
  'r', 'ry', 'w', MORAIC_N, MORAIC_Q,
];

export const VOWEL_ORDER = ['a', 'i', 'u', 'e', 'o'];

// ---- かな → 正規化ローマ字 --------------------------------------------------
// 入力欄に「りんご」と打てるようにするための変換。正規化ルール 1〜6 に従う。
// 7（音節融合）は当てない——融合してよいのは音節構造そのものを観察するカードだけで、
// 引く側が勝手に融合すると、1 モーラ単位で書かれた大多数のタグと一致しなくなる。

const KANA: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o',
  ん: 'n', っ: 'q',
  ゔ: 'bu',
};

/** 拗音。2 文字で 1 モーラ（正規化ルール 5） */
const YOON: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
};

const toHiragana = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/**
 * かな（ひら・カタ）を 1 モーラずつの正規化ローマ字へ割る。
 *
 * - 長音記号「ー」は捨てる（ルール 3。母音を重複させない）
 * - 読めない文字は落とす。漢字は変換しない——読みを機械が決めると、
 *   「頬」のように読みが割れる字で誤った軸を立てることになる
 */
export function kanaToMora(input: string): string[] {
  const src = toHiragana(input.trim());
  const out: string[] = [];
  for (let i = 0; i < src.length; i += 1) {
    const pair = src.slice(i, i + 2);
    if (YOON[pair]) {
      out.push(YOON[pair]);
      i += 1;
      continue;
    }
    const one = KANA[src[i]];
    if (one) out.push(one);
    // 「ー」「々」空白・漢字・記号はここで落ちる
  }
  return out;
}

export type Query = {
  /** 入力を割ったモーラ列 */
  mora: string[];
  /** そのモーラ列が触れる軸 */
  axes: Axes;
};

export function buildQuery(input: string): Query {
  const mora = kanaToMora(input);
  return { mora, axes: axesOf(mora) };
}
