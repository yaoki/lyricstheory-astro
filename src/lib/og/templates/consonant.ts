import { frameBadge, footer } from '../chrome';
import type { ConsonantFigure, ConsonantRow, FigureContext } from '../figure';
import { ACCENTS, CANVAS, COLORS, CONSONANT, FONT_FAMILY, MARGIN_X, SYMMETRY } from '../layout';
import { escapeXml, textBlock, widthEm, wrapText } from '../text';

/** 子音を持たない位置。色は当てず、背景に落とす */
const EMPTY = 'Φ';

/**
 * 子音の並びを、歌詞の上に振って見せる。
 *
 * 記号だけを並べた版を一度作ったが、それでは伝わらなかった（2026-08-02、やおき指摘）。
 * どの音が t で、どの音が Φ なのかが図の中で結びついていないと、本文を読みに
 * 行かないと読めない。**図はブログを読まずに単体で伝わる強度を持たなければならない。**
 *
 * だから行の音をそのまま並べ、該当する音の上に記号を振る。
 * 記号を持たない音は背景に落として、交替が起きている範囲を浮かび上がらせる。
 */
export function consonant(figure: Omit<ConsonantFigure, 'kind'>, ctx: FigureContext): string {
  const { rows } = figure;

  // 記号ごとの色。Φ を除いた出現順に割り当てる。交替が色の交互として見えるようにする
  const palette = new Map<string, string>();
  for (const { symbol } of rows.flatMap((row) => row.marks)) {
    if (symbol === EMPTY || palette.has(symbol)) continue;
    palette.set(symbol, ACCENTS[palette.size % ACCENTS.length].stroke);
  }

  const available = CANVAS.width - MARGIN_X * 2;
  // セル幅はいちばん長い行に合わせる。行ごとに変えると同じ 1 音の幅が行で変わり、
  // 位置の対応が読めなくなる
  const longest = Math.max(...rows.map((row) => row.units.length));
  const cell = (available - (longest - 1) * CONSONANT.gap) / longest;
  const maxEm = Math.max(...rows.flatMap((row) => row.units.map((u) => widthEm(u))), 1);
  const size = Math.min(CONSONANT.unitFontSize, cell / maxEm);

  const firstBaseline = rows.length >= 2 ? CONSONANT.baselineTwoRows : CONSONANT.baseline;
  const body = rows
    .map((row, i) => renderRow(row, firstBaseline + i * CONSONANT.rowStep, cell, size, palette))
    .join('');

  const maxTitleEm = available / CONSONANT.titleFontSize;
  const lines = wrapText(ctx.title, maxTitleEm, CONSONANT.titleMaxLines);
  const titleBaseline = CONSONANT.titleCenterY - ((lines.length - 1) * CONSONANT.titleLineHeight) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.bg}" />`,
    frameBadge(ctx.repetition),
    body,
    textBlock(lines, {
      x: MARGIN_X,
      baseline: titleBaseline,
      fontSize: CONSONANT.titleFontSize,
      lineHeight: CONSONANT.titleLineHeight,
      fill: COLORS.text,
      fontFamily: FONT_FAMILY,
      fontWeight: 700,
    }),
    footer(CONSONANT.siteY, CONSONANT.siteFontSize, ctx.lyricist),
    '</svg>',
  ].join('');
}

/** 1 行ぶん。音を並べ、記号を持つ音の上に記号を振る */
function renderRow(
  row: ConsonantRow,
  baseline: number,
  cell: number,
  size: number,
  palette: Map<string, string>,
): string {
  const byIndex = new Map(row.marks.map((m) => [m.at, m.symbol]));
  const parts: string[] = [];

  for (let i = 0; i < row.units.length; i++) {
    const x = MARGIN_X + i * (cell + CONSONANT.gap) + cell / 2;
    const symbol = byIndex.get(i);
    // 記号を持たない音は背景に落とす。交替が起きている範囲を浮かび上がらせるため
    const fill =
      symbol === undefined
        ? SYMMETRY.dim
        : symbol === EMPTY
          ? COLORS.text
          : (palette.get(symbol) ?? COLORS.text);

    parts.push(
      `<text x="${r(x)}" y="${r(baseline)}" font-family="${FONT_FAMILY}" font-size="${r(size)}" ` +
        `font-weight="700" fill="${fill}" text-anchor="middle">${escapeXml(row.units[i])}</text>`,
    );
    if (symbol === undefined) continue;

    // Φ は無彩色にする（ACCENTS を当てると「3 つ目の子音」に見える）が、
    // dim では薄すぎて読めない。「子音を持たない位置」であること自体は
    // 読み取ってほしい情報なので muted を当てる（2026-08-02、やおき指摘）
    const markSize = size * CONSONANT.markRatio;
    parts.push(
      `<text x="${r(x)}" y="${r(baseline - size * 0.94 - CONSONANT.markGap)}" ` +
        `font-family="${FONT_FAMILY}" font-size="${r(markSize)}" font-weight="700" ` +
        `fill="${symbol === EMPTY ? COLORS.muted : (palette.get(symbol) ?? COLORS.text)}" ` +
        `text-anchor="middle">${escapeXml(symbol)}</text>`,
    );
  }
  return parts.join('');
}

/** SVG 属性に長い小数を書かない */
function r(value: number): number {
  return Math.round(value * 100) / 100;
}
