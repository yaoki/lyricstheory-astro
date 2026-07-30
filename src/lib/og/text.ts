/**
 * SVG テキストの整形。
 *
 * resvg は <text> を自動折り返ししないため、行分割を自前で行う（仕様書 §5.5）。
 * 幅は「全角 1em / 半角 0.5em」の近似で見積もる。Noto Sans JP のプロポーショナル差は
 * この用途では無視できる範囲で、はみ出しを防ぐ側に倒してある。
 */

/** 行頭に置かない文字（終わり括弧・句読点・長音・小書き仮名） */
const NO_LINE_START = '、。，．：；？！ー・…‥）〕］｝〉》」』】〙〗’”ゝゞヽヾっゃゅょぁぃぅぇぉッャュョァィゥェォ';

/** 行末に置かない文字（始め括弧） */
const NO_LINE_END = '（〔［｛〈《「『【〘〖‘“';

/** ASCII と半角カナは半角幅として扱う */
const HALF_WIDTH = /[\x20-\x7e｡-ﾟ]/;

export function charWidthEm(ch: string): number {
  return HALF_WIDTH.test(ch) ? 0.5 : 1;
}

export function widthEm(text: string): number {
  return [...text].reduce((sum, ch) => sum + charWidthEm(ch), 0);
}

/**
 * text を maxWidthEm 幅・maxLines 行以内に分割する。
 * 収まりきらない場合は最終行の末尾を「…」に詰める。
 */
export function wrapText(text: string, maxWidthEm: number, maxLines: number): string[] {
  const chars = [...text.trim()];
  const lines: string[] = [];
  let line = '';
  let width = 0;
  // 禁則であふれさせた文字数。連続で許すと右マージンを食い破るので 2 文字で打ち切る
  let overflowed = 0;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const w = charWidthEm(ch);

    if (width + w > maxWidthEm) {
      // 行頭禁則: あふれた文字が行頭に来られないものなら、はみ出しを許して現在行に残す
      const keep = line !== '' && NO_LINE_START.includes(ch) && overflowed < 2;
      if (keep) {
        overflowed++;
      } else if (line !== '') {
        // 行末禁則: 行末が始め括弧なら、その括弧ごと次の行へ送る
        let carry = '';
        while (line !== '' && NO_LINE_END.includes(line.at(-1)!)) {
          carry = line.at(-1)! + carry;
          line = line.slice(0, -1);
        }
        if (line !== '') lines.push(line);
        if (lines.length >= maxLines) return truncateLast(lines, chars.slice(i), maxWidthEm);
        line = carry;
        width = widthEm(carry);
        overflowed = 0;
      }
    }

    line += ch;
    width += w;
  }

  if (line !== '') lines.push(line);
  return lines.slice(0, maxLines);
}

/** 行数上限に達したのに残りがある場合、最終行の末尾を「…」に置き換える */
function truncateLast(lines: string[], rest: string[], maxWidthEm: number): string[] {
  if (rest.length === 0) return lines;
  const last = [...lines[lines.length - 1]];
  const ellipsisEm = charWidthEm('…');
  let width = widthEm(lines[lines.length - 1]);
  while (last.length > 0 && width + ellipsisEm > maxWidthEm) {
    width -= charWidthEm(last.pop()!);
  }
  lines[lines.length - 1] = last.join('') + '…';
  return lines;
}

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => XML_ENTITIES[ch]);
}

/**
 * 折り返した行を <text> ブロックにする。
 * baseline は 1 行目のベースライン。dominant-baseline は resvg での挙動が読めないため使わない。
 */
export function textBlock(
  lines: string[],
  opts: {
    x: number;
    baseline: number;
    fontSize: number;
    lineHeight: number;
    fill: string;
    fontFamily: string;
    fontWeight?: number;
  },
): string {
  const weight = opts.fontWeight ? ` font-weight="${opts.fontWeight}"` : '';
  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? '' : ` dy="${opts.lineHeight}"`;
      return `<tspan x="${opts.x}"${dy}>${escapeXml(line)}</tspan>`;
    })
    .join('');
  return `<text x="${opts.x}" y="${opts.baseline}" font-family="${opts.fontFamily}" font-size="${opts.fontSize}" fill="${opts.fill}"${weight}>${tspans}</text>`;
}
