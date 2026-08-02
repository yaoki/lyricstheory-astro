import { frameBadge, footer } from '../chrome';
import type { ConsonantFigure, FigureContext } from '../figure';
import { ACCENTS, CANVAS, COLORS, CONSONANT, FONT_FAMILY, MARGIN_X, SYMMETRY } from '../layout';
import { escapeXml, textBlock, widthEm, wrapText } from '../text';

/** 子音を持たない位置。色は当てず、背景に落とす */
const EMPTY = 'Φ';

/**
 * 子音の並びそのものを描く。
 *
 * single は仮名を並べて呼応を弧で結ぶ図、pivot は軸 1 本の分布の図だが、
 * ここでは 2 つ以上の子音が入れ替わり続ける様子を見る。単位が子音の並びなので
 * 仮名では書けない（Φ に対応する仮名がない）。記号を直に並べる。
 *
 * 交替は色の交互で示す。記号の種類ごとに出現順で ACCENTS を割り当て、
 * Φ だけは dim に固定する。弧は引かない——どれとどれが対応するかではなく、
 * 並びそのものが観察だからである。
 */
export function consonant(figure: Omit<ConsonantFigure, 'kind'>, ctx: FigureContext): string {
  const { rows } = figure;

  // 記号ごとの色。Φ を除いた出現順に割り当てる
  const palette = new Map<string, string>();
  for (const symbol of rows.flat(2)) {
    if (symbol === EMPTY || palette.has(symbol)) continue;
    palette.set(symbol, ACCENTS[palette.size % ACCENTS.length].stroke);
  }

  const available = CANVAS.width - MARGIN_X * 2;

  // いちばん長い行に合わせて縮める。行ごとに大きさを変えると、
  // 同じ記号が行によって違う大きさになり、並びの比較ができなくなる
  const naturalWidth = (row: string[][], size: number): number => {
    const symbols = row.flat().length;
    const gaps = symbols - row.length; // 群のなかの間隔の数
    return symbols * size + gaps * CONSONANT.gap + (row.length - 1) * CONSONANT.groupGap;
  };
  const widest = Math.max(...rows.map((row) => naturalWidth(row, CONSONANT.symbolFontSize)));
  const scale = Math.min(1, available / widest);
  const size = CONSONANT.symbolFontSize * scale;
  const gap = CONSONANT.gap * scale;
  const groupGap = CONSONANT.groupGap * scale;

  const firstBaseline = rows.length >= 2 ? CONSONANT.baselineTwoRows : CONSONANT.baseline;

  const body = rows
    .map((row, rowIndex) => {
      const baseline = firstBaseline + rowIndex * CONSONANT.rowStep;
      const width =
        row.flat().length * size + (row.flat().length - row.length) * gap + (row.length - 1) * groupGap;
      let x = MARGIN_X + (available - width) / 2;
      const parts: string[] = [];
      for (const group of row) {
        for (const symbol of group) {
          const fill = symbol === EMPTY ? SYMMETRY.dim : (palette.get(symbol) ?? COLORS.text);
          parts.push(
            `<text x="${r(x + size / 2)}" y="${r(baseline)}" font-family="${FONT_FAMILY}" ` +
              `font-size="${r(size)}" font-weight="700" fill="${fill}" ` +
              `text-anchor="middle">${escapeXml(symbol)}</text>`,
          );
          x += size + gap;
        }
        x += groupGap - gap;
      }
      return parts.join('');
    })
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

/** SVG 属性に長い小数を書かない */
function r(value: number): number {
  return Math.round(value * 100) / 100;
}
