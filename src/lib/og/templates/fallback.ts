import { frameBadge, footer, titleBlock } from '../chrome';
import type { FigureContext } from '../figure';
import { CANVAS, COLORS, FALLBACK, FONT_FAMILY, MARGIN_X } from '../layout';
import { textBlock, wrapText } from '../text';

/**
 * figure を持たないカード用。図は描かず、タイトルとサイト名だけを置く（仕様書 §6）。
 * 全カードに figure を書き終えるまでの移行期間を吸収する。
 */
export function fallback(ctx: FigureContext): string {
  const title = titleBlock(ctx, FALLBACK);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.bg}" />`,
    frameBadge(ctx.repetition),
    title.svg,
    footer(FALLBACK.siteY, FALLBACK.siteFontSize, ctx.lyricist),
    '</svg>',
  ].join('');
}
