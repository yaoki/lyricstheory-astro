import { CANVAS, COLORS, FONT_FAMILY, MARGIN_X, SITE_NAME, SYMMETRY } from '../layout';
import { escapeXml, textBlock, widthEm, wrapText } from '../text';

/**
 * symmetry テンプレートが受け取る figure。
 * 実体の検証は `src/content.config.ts` の figureSchema 側で行う（構造を変えるときは両方直す）。
 */
export interface SymmetryFigure {
  kind: 'symmetry';
  units: string[];
  highlight: number[];
}

export function symmetry(figure: SymmetryFigure, title: string): string {
  const { units, highlight } = figure;
  const n = units.length;

  // units が多いと 140px 固定では版面をはみ出すため、使える幅に収まるよう一様に縮める
  const available = CANVAS.width - MARGIN_X * 2;
  const natural = n * SYMMETRY.boxSize + (n - 1) * SYMMETRY.boxGap;
  const scale = Math.min(1, available / natural);

  const box = SYMMETRY.boxSize * scale;
  const gap = SYMMETRY.boxGap * scale;
  const radius = SYMMETRY.boxRadius * scale;
  const totalWidth = n * box + (n - 1) * gap;
  const startX = (CANVAS.width - totalWidth) / 2;
  const boxTop = SYMMETRY.boxCenterY - box / 2;

  const centerX = (i: number) => startX + i * (box + gap) + box / 2;
  const isHighlighted = (i: number) => highlight.includes(i);

  const boxes = units
    .map((unit, i) => {
      const x = startX + i * (box + gap);
      const on = isHighlighted(i);
      const rect =
        `<rect x="${r(x)}" y="${r(boxTop)}" width="${r(box)}" height="${r(box)}" rx="${r(radius)}" ` +
        `fill="${on ? COLORS.accentFill : 'none'}" stroke="${on ? COLORS.accent : COLORS.boxStroke}" ` +
        `stroke-width="${r(on ? 5 * scale : 3 * scale)}" />`;
      return rect + unitText(unit, centerX(i), box, scale, on);
    })
    .join('');

  // highlight が 1 つ以下なら結ぶ相手がいないので弧を描かない（§5.3）
  const sorted = [...highlight].sort((a, b) => a - b);
  const arc =
    sorted.length >= 2
      ? arcPath(centerX(sorted[0]), centerX(sorted[sorted.length - 1]), boxTop, scale)
      : '';

  const maxTitleEm = (CANVAS.width - MARGIN_X * 2) / SYMMETRY.titleFontSize;
  const lines = wrapText(title, maxTitleEm, SYMMETRY.titleMaxLines);
  // 行数が増えたぶん上へ持ち上げ、タイトル塊の重心を titleCenterY に保つ
  const baseline = SYMMETRY.titleCenterY - ((lines.length - 1) * SYMMETRY.titleLineHeight) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.bg}" />`,
    arc,
    boxes,
    textBlock(lines, {
      x: MARGIN_X,
      baseline,
      fontSize: SYMMETRY.titleFontSize,
      lineHeight: SYMMETRY.titleLineHeight,
      fill: COLORS.text,
      fontFamily: FONT_FAMILY,
      fontWeight: 700,
    }),
    textBlock([SITE_NAME], {
      x: MARGIN_X,
      baseline: SYMMETRY.siteY,
      fontSize: SYMMETRY.siteFontSize,
      lineHeight: SYMMETRY.siteFontSize,
      fill: COLORS.muted,
      fontFamily: FONT_FAMILY,
    }),
    '</svg>',
  ].join('');
}

/**
 * 枠内の音。
 * 「/t/」のような複数文字も入るため、推定幅が枠に収まるところまでフォントを落とす。
 * 縦位置は dominant-baseline を使わず、em の中心がおよそ 0.35em 上にある前提で置く。
 */
function unitText(unit: string, cx: number, box: number, scale: number, on: boolean): string {
  const inner = box * 0.82;
  const em = Math.max(widthEm(unit), 0.5);
  const fontSize = Math.min(SYMMETRY.unitFontSize * scale, inner / em);
  const baseline = SYMMETRY.boxCenterY + fontSize * 0.35;
  return (
    `<text x="${r(cx)}" y="${r(baseline)}" font-family="${FONT_FAMILY}" font-size="${r(fontSize)}" ` +
    `font-weight="700" fill="${on ? COLORS.accent : COLORS.text}" text-anchor="middle">${escapeXml(unit)}</text>`
  );
}

/**
 * highlight 同士を結ぶ弧。
 * 二次ベジェは制御点の高さの半分までしか上がらないため、頂点を arcLift に合わせるには
 * 制御点をその 2 倍の高さに置く（仕様書の式をそのまま書くと弧が浅くなる）。
 */
function arcPath(x1: number, x2: number, boxTop: number, scale: number): string {
  const y = boxTop - SYMMETRY.arcGap * scale;
  const apex = boxTop - SYMMETRY.arcLift;
  const cy = 2 * apex - y;
  const cx = (x1 + x2) / 2;
  return (
    `<path d="M ${r(x1)} ${r(y)} Q ${r(cx)} ${r(cy)} ${r(x2)} ${r(y)}" fill="none" ` +
    `stroke="${COLORS.accent}" stroke-width="${r(SYMMETRY.arcWidth)}" stroke-linecap="round" />`
  );
}

/** SVG 属性に長い小数を書かない */
function r(value: number): number {
  return Math.round(value * 100) / 100;
}
