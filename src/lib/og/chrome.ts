/**
 * 図の外枠。どのテンプレートでも同じ位置に同じものが出るように、ここに集約する。
 *
 * - 左上: 分析のフレーム（C反復 / V反復 / CV反復）
 * - 左下: 署名
 * - 右下: 作詞者（引用の体裁。画像は単体で流通するため図の側にも添える）
 */
import {
  ACCENTS,
  CANVAS,
  COLORS,
  FONT_FAMILY,
  FRAME_BADGE,
  MARGIN_X,
  REPETITION_LABELS,
  SIGNATURE,
} from './layout';
import { escapeXml, textBlock } from './text';

/**
 * 分析のフレームを左上に掲げる。図を読み始める前に、どの枠で見ているかを知らせる。
 * tags.repetition を持たないカードでは何も描かない。
 */
export function frameBadge(repetition: string | undefined): string {
  const label = repetition ? REPETITION_LABELS[repetition] : undefined;
  if (!label) return '';
  const { x, y, width, height, radius, fontSize } = FRAME_BADGE;
  return (
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="none" ` +
    `stroke="${ACCENTS[0].stroke}" stroke-width="2" />` +
    `<text x="${x + width / 2}" y="${y + height / 2 + fontSize * 0.35}" font-family="${FONT_FAMILY}" ` +
    `font-size="${fontSize}" font-weight="700" fill="${ACCENTS[0].stroke}" ` +
    `text-anchor="middle">${escapeXml(label)}</text>`
  );
}

/** 左下の署名と、取れていれば右下の作詞者 */
export function footer(baseline: number, fontSize: number, lyricist?: string): string {
  const signature = textBlock([SIGNATURE], {
    x: MARGIN_X,
    baseline,
    fontSize,
    lineHeight: fontSize,
    fill: COLORS.muted,
    fontFamily: FONT_FAMILY,
  });
  if (!lyricist) return signature;
  return (
    signature +
    `<text x="${CANVAS.width - MARGIN_X}" y="${baseline}" font-family="${FONT_FAMILY}" ` +
    `font-size="${fontSize}" fill="${COLORS.muted}" text-anchor="end">作詞：${escapeXml(lyricist)}</text>`
  );
}
