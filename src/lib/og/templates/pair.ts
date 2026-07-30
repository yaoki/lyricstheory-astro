import { footer, frameBadge } from '../chrome';
import type { FigureContext, PairFigure } from '../figure';
import { ACCENTS, CANVAS, COLORS, FONT_FAMILY, MARGIN_X, PAIR } from '../layout';
import { escapeXml, textBlock, wrapText } from '../text';

/**
 * 離れた 2 箇所を上下に並べる。回帰反復のための図。
 *
 * 共通部分を 1 回に圧縮しない。圧縮すると「2 度現れた」という事実が消え、
 * 想起の成立根拠が図から落ちる。反復（動かない側）と差異（動く側）を同時に見せる。
 *
 * 行ラベルを小さくしないこと。回帰反復の定義は「構造的対応による想起」であり、
 * 距離は定義から棄却されている。図の中で構造的対応を担うのはラベルだけで、
 * 外すと上下に隣接した 2 行に見え、短期反復と取り違えられる。
 */
export function pair(figure: Omit<PairFigure, 'kind'>, ctx: FigureContext): string {
  // 一致の判定を表記の突き合わせで行っているため、CV反復のフレームでしか正しくない。
  // V反復で使うと、母音が一致する「を／も」を差異と描き、左上のバッジと食い違う
  if (ctx.repetition !== 'cv') {
    throw new Error(
      `pair の図は CV反復 のフレームでしか使えません（tags.repetition: ${ctx.repetition ?? 'なし'}）。\n` +
        '一致の判定を表記の突き合わせで行っているためです。',
    );
  }
  const { rows, labels } = figure;
  const cols = rows[0].length;

  const available = CANVAS.width - MARGIN_X * 2 - PAIR.labelWidth;
  const size = Math.min(PAIR.maxSize, (available - (cols - 1) * PAIR.gap) / cols);
  const totalWidth = cols * size + (cols - 1) * PAIR.gap;
  const startX = MARGIN_X + PAIR.labelWidth + (available - totalWidth) / 2;
  const at = (i: number) => startX + i * (size + PAIR.gap) + size / 2;

  // 同じ位置で音が一致すれば反復、違えば差異。書き手が指定しなくても突き合わせれば決まる
  const same = (i: number) => rows[0][i] === rows[1][i];

  // 差異は帯だけで示し、文字は本文色のままにする。
  // ACCENTS は「対応している音」を指す色なので、差異に使うと同じ色が
  // 反復と非反復の両方を指してしまう
  const band = Array.from({ length: cols }, (_, i) =>
    same(i)
      ? ''
      : `<rect x="${r(at(i) - size / 2 - PAIR.gap / 2)}" y="${r(PAIR.row1 - size * 0.95)}" ` +
        `width="${r(size + PAIR.gap)}" height="${r(PAIR.row2 - PAIR.row1 + size * 1.2)}" rx="12" ` +
        `fill="${ACCENTS[1].fill}" opacity="0.5" />`,
  ).join('');

  const glyphs = rows
    .map((row, k) =>
      row
        .map(
          (unit, i) =>
            `<text x="${r(at(i))}" y="${r(k === 0 ? PAIR.row1 : PAIR.row2)}" font-family="${FONT_FAMILY}" ` +
            `font-size="${r(size)}" font-weight="700" fill="${same(i) ? ACCENTS[0].stroke : COLORS.text}" ` +
            `text-anchor="middle">${escapeXml(unit)}</text>`,
        )
        .join(''),
    )
    .join('');

  const rowLabels = labels
    .map(
      (text, k) =>
        `<text x="${MARGIN_X}" y="${r((k === 0 ? PAIR.row1 : PAIR.row2) - size * 0.16)}" ` +
        `font-family="${FONT_FAMILY}" font-size="${PAIR.labelFontSize}" font-weight="700" ` +
        `fill="${COLORS.text}">${escapeXml(text)}</text>`,
    )
    .join('');

  const lines = wrapText(ctx.title, (CANVAS.width - MARGIN_X * 2) / PAIR.titleFontSize, PAIR.titleMaxLines);
  const baseline = PAIR.titleCenterY - ((lines.length - 1) * PAIR.titleLineHeight) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.bg}" />`,
    frameBadge(ctx.repetition),
    band,
    rowLabels,
    glyphs,
    textBlock(lines, {
      x: MARGIN_X,
      baseline,
      fontSize: PAIR.titleFontSize,
      lineHeight: PAIR.titleLineHeight,
      fill: COLORS.text,
      fontFamily: FONT_FAMILY,
      fontWeight: 700,
    }),
    footer(PAIR.siteY, PAIR.siteFontSize, ctx.lyricist),
    '</svg>',
  ].join('');
}

function r(value: number): number {
  return Math.round(value * 100) / 100;
}
