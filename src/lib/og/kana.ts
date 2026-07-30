/**
 * 音節から母音を取り出す。
 *
 * **表記ベースの粗い変換**であることに注意する。助詞の「は」は表記どおり /a/ として扱い、
 * 発音の /wa/ には寄せない。図に添える見出しとしての用途に限る。
 * 分析の本体（tags.phoneme の romaji 正規化）とは別軸なので、混同しないこと。
 */

const VOWEL_TABLE: ReadonlyArray<readonly [string, string]> = [
  ['ア', 'あかがさざただなはばぱまやらわゃぁゎ'],
  ['イ', 'いきぎしじちぢにひびぴみりゐぃ'],
  ['ウ', 'うくぐすずつづぬふぶぷむゆるゅぅゔ'],
  ['エ', 'えけげせぜてでねへべぺめれゑぇ'],
  ['オ', 'おこごそぞとどのほぼぽもよろをょぉ'],
];

/** 母音を持たない音（撥音・促音） */
const MORAIC = 'んっ';

function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/**
 * 音節の母音を返す。「ん」「っ」は母音を持たないので null。
 * 長音「ー」は直前の母音を引き継ぐため、previous を渡す。
 */
export function vowelOf(unit: string, previous: string | null = null): string | null {
  const kana = toHiragana(unit);
  // 拗音は小書き仮名が母音を決めるため、末尾から見る
  for (const ch of [...kana].reverse()) {
    if (ch === 'ー' || ch === 'ｰ') return previous;
    if (MORAIC.includes(ch)) return null;
    const found = VOWEL_TABLE.find(([, chars]) => chars.includes(ch));
    if (found) return found[0];
  }
  return null;
}

/** units 全体の母音列。長音は直前を引き継ぐので順に解く */
export function vowelsOf(units: string[]): (string | null)[] {
  const vowels: (string | null)[] = [];
  for (const unit of units) {
    vowels.push(vowelOf(unit, vowels.at(-1) ?? null));
  }
  return vowels;
}
