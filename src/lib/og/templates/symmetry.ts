import { ACCENTS, CANVAS, COLORS, FONT_FAMILY, MARGIN_X, SITE_NAME, SYMMETRY } from '../layout';
import { escapeXml, textBlock, widthEm, wrapText } from '../text';

/**
 * symmetry テンプレートが受け取る figure。
 * 実体の検証は `src/content.config.ts` の figureSchema 側で行う（構造を変えるときは両方直す）。
 */
export interface SymmetryFigure {
  kind: 'symmetry';
  units: string[];
  /**
   * 強調する位置。1 組なら [2, 4]、複数の呼応があるなら [[2, 4], [5, 7]]。
   * 組ごとに色が変わり、それぞれ弧で結ばれる。
   */
  highlight: number[] | number[][];
}

type Accent = (typeof ACCENTS)[number];

interface Span {
  from: number;
  to: number;
  accent: Accent;
}

/** [2, 4] と [[2, 4], [5, 7]] の両方を受けて、組の配列に揃える */
export function normalizeHighlight(highlight: number[] | number[][]): number[][] {
  if (highlight.length === 0) return [];
  return typeof highlight[0] === 'number' ? [highlight as number[]] : (highlight as number[][]);
}

export function symmetry(figure: SymmetryFigure, title: string): string {
  const { units } = figure;
  const groups = normalizeHighlight(figure.highlight);
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
  const accentOf = (i: number): Accent | null => {
    const group = groups.findIndex((g) => g.includes(i));
    return group === -1 ? null : ACCENTS[group % ACCENTS.length];
  };

  const boxes = units
    .map((unit, i) => {
      const x = startX + i * (box + gap);
      const accent = accentOf(i);
      const rect =
        `<rect x="${r(x)}" y="${r(boxTop)}" width="${r(box)}" height="${r(box)}" rx="${r(radius)}" ` +
        `fill="${accent ? accent.fill : 'none'}" stroke="${accent ? accent.stroke : COLORS.boxStroke}" ` +
        `stroke-width="${r((accent ? 5 : 3) * scale)}" />`;
      return rect + unitText(unit, centerX(i), box, scale, accent);
    })
    .join('');

  // 結ぶ相手がいない組（要素が 1 つ以下）には弧を描かない
  const spans: Span[] = groups.flatMap((group, i) =>
    group.length >= 2
      ? [{ from: Math.min(...group), to: Math.max(...group), accent: ACCENTS[i % ACCENTS.length] }]
      : [],
  );

  const arcs = spans
    .map((span) => arcPath(span, spans, centerX, boxTop, scale))
    .join('');

  const maxTitleEm = (CANVAS.width - MARGIN_X * 2) / SYMMETRY.titleFontSize;
  const lines = wrapText(title, maxTitleEm, SYMMETRY.titleMaxLines);
  // 行数が増えたぶん上へ持ち上げ、タイトル塊の重心を titleCenterY に保つ
  const baseline = SYMMETRY.titleCenterY - ((lines.length - 1) * SYMMETRY.titleLineHeight) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.bg}" />`,
    arcs,
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
function unitText(
  unit: string,
  cx: number,
  box: number,
  scale: number,
  accent: Accent | null,
): string {
  const inner = box * 0.82;
  const em = Math.max(widthEm(unit), 0.5);
  const fontSize = Math.min(SYMMETRY.unitFontSize * scale, inner / em);
  const baseline = SYMMETRY.boxCenterY + fontSize * 0.35;
  return (
    `<text x="${r(cx)}" y="${r(baseline)}" font-family="${FONT_FAMILY}" font-size="${r(fontSize)}" ` +
    `font-weight="700" fill="${accent ? accent.stroke : COLORS.text}" text-anchor="middle">${escapeXml(unit)}</text>`
  );
}

/**
 * 呼応する枠どうしを結ぶ弧。
 *
 * 二次ベジェは制御点の高さの半分までしか上がらないため、頂点を狙った高さに合わせるには
 * 制御点をその 2 倍に置く。入れ子になっている弧は、内側と重ならないよう段を上げる。
 */
function arcPath(
  span: Span,
  all: Span[],
  centerX: (i: number) => number,
  boxTop: number,
  scale: number,
): string {
  const nesting = all.filter(
    (other) =>
      other !== span &&
      other.from >= span.from &&
      other.to <= span.to &&
      (other.from > span.from || other.to < span.to),
  ).length;

  const y = boxTop - SYMMETRY.arcGap * scale;
  const apex = boxTop - (SYMMETRY.arcLift + nesting * SYMMETRY.arcNestStep);
  const cy = 2 * apex - y;
  const x1 = centerX(span.from);
  const x2 = centerX(span.to);
  return (
    `<path d="M ${r(x1)} ${r(y)} Q ${r((x1 + x2) / 2)} ${r(cy)} ${r(x2)} ${r(y)}" fill="none" ` +
    `stroke="${span.accent.stroke}" stroke-width="${r(SYMMETRY.arcWidth)}" stroke-linecap="round" />`
  );
}

/** SVG 属性に長い小数を書かない */
function r(value: number): number {
  return Math.round(value * 100) / 100;
}
