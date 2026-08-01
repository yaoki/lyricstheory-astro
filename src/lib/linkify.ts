/**
 * 文字列のなかの URL を切り出す。
 *
 * `sources` は「著者「題」（誌名、年）URL」の形で書かれていて、URL が地の文に
 * 混じっている。テンプレート側で `set:html` を使わずにリンクを張れるよう、
 * テキストとリンクの並びに割る。
 */

export interface TextSegment {
  type: 'text' | 'link';
  value: string;
}

const URL_PATTERN = /https?:\/\/[^\s]+/g;

/** 文末の約物は URL に含めない（`…531-547.` の `.` や `…）` の `）`） */
const TRAILING_PUNCTUATION = /[.,;:!?。、）)」』】>]+$/;

export function splitLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    let url = match[0];

    const trailing = url.match(TRAILING_PUNCTUATION);
    if (trailing) url = url.slice(0, url.length - trailing[0].length);
    if (url.length === 0) continue;

    if (start > cursor) segments.push({ type: 'text', value: text.slice(cursor, start) });
    segments.push({ type: 'link', value: url });
    cursor = start + url.length;
  }

  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) });
  return segments;
}
