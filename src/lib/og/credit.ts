/**
 * sources から作詞者を取り出す。
 *
 * 画像はカードページから切り離されて単体で流通する。本文の `<LyricQuote lyricist>` は
 * 画像には届かないため、引用の体裁として作詞者を図の側にも添える。
 *
 * sources の書式は揺れているので、取れないときは何も返さない。
 * 誤った人に帰属させるより、出さないほうが安全。
 */
const LYRICIST = /作詞(?:・作曲)?\s*[:：]\s*([^・）)\n]+)/;

export function lyricistOf(sources: readonly string[]): string | undefined {
  for (const source of sources) {
    const matched = source.match(LYRICIST);
    if (matched) return matched[1].trim();
  }
  return undefined;
}
