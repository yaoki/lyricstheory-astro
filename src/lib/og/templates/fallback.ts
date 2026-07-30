import { CANVAS, COLORS, FALLBACK, FONT_FAMILY, MARGIN_X, SITE_NAME } from '../layout';
import { textBlock, wrapText } from '../text';

/**
 * figure を持たないカード用。図は描かず、タイトルとサイト名だけを置く（仕様書 §6）。
 * 全カードに figure を書き終えるまでの移行期間を吸収する。
 */
export function fallback(title: string): string {
  const maxEm = (CANVAS.width - MARGIN_X * 2) / FALLBACK.titleFontSize;
  const lines = wrapText(title, maxEm, FALLBACK.titleMaxLines);
  const baseline = FALLBACK.titleCenterY - ((lines.length - 1) * FALLBACK.titleLineHeight) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.bg}" />`,
    textBlock(lines, {
      x: MARGIN_X,
      baseline,
      fontSize: FALLBACK.titleFontSize,
      lineHeight: FALLBACK.titleLineHeight,
      fill: COLORS.text,
      fontFamily: FONT_FAMILY,
      fontWeight: 700,
    }),
    textBlock([SITE_NAME], {
      x: MARGIN_X,
      baseline: FALLBACK.siteY,
      fontSize: FALLBACK.siteFontSize,
      lineHeight: FALLBACK.siteFontSize,
      fill: COLORS.muted,
      fontFamily: FONT_FAMILY,
    }),
    '</svg>',
  ].join('');
}
