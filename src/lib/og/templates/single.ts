import { frameBadge, footer } from '../chrome';
import { normalizeHighlight, type FigureContext, type SingleFigure } from '../figure';
import { ACCENTS, CANVAS, COLORS, FONT_FAMILY, MARGIN_X, SYMMETRY } from '../layout';
import { escapeXml, moraCount, textBlock, widthEm, wrapText } from '../text';

type Accent = (typeof ACCENTS)[number];

interface Span {
  from: number;
  to: number;
  accent: Accent;
}

/**
 * 音を横一列に並べ、呼応する音を弧で結ぶ。
 *
 * 枠は描かず、色の差だけで呼応を示す。SNS のタイムラインでは画像が 1/3 ほどに縮むため、
 * 装飾を削って文字を大きく取ったほうが一瞥で読める。
 *
 * kind は呼び出し側で振り分け済みなので受け取らない
 * （zod の推論は判別ユニオンにならず、kind 付きのまま渡すと型が合わないため）。
 * repetition はカードの tags.repetition（c | v | cv）。分析のフレームとして左上に掲げる。
 */
export function single(figure: Omit<SingleFigure, 'kind'>, ctx: FigureContext): string {
  const { units, phrases } = figure;
  const groups = normalizeHighlight(figure.highlight);

  // 「した」のように 1 枠が複数文字のこともあるため、幅は文字数から積む
  const available = CANVAS.width - MARGIN_X * 2;
  const natural =
    units.reduce((sum, unit) => sum + SYMMETRY.unitFontSize * unitEm(unit), 0) +
    (units.length - 1) * SYMMETRY.gap;
  const scale = Math.min(1, available / natural);

  const size = SYMMETRY.unitFontSize * scale;
  const gap = SYMMETRY.gap * scale;
  const widths = units.map((unit) => size * unitEm(unit));
  const totalWidth = widths.reduce((a, b) => a + b, 0) + (units.length - 1) * gap;

  const centers: number[] = [];
  let cursor = (CANVAS.width - totalWidth) / 2;
  for (const width of widths) {
    centers.push(cursor + width / 2);
    cursor += width + gap;
  }

  const accentOf = (i: number): Accent | null => {
    const group = groups.findIndex((g) => g.includes(i));
    return group === -1 ? null : ACCENTS[group % ACCENTS.length];
  };

  const glyphs = units
    .map((unit, i) => {
      const accent = accentOf(i);
      return (
        `<text x="${r(centers[i])}" y="${r(SYMMETRY.baseline)}" font-family="${FONT_FAMILY}" ` +
        `font-size="${r(size)}" font-weight="700" fill="${accent ? accent.stroke : SYMMETRY.dimText}" ` +
        `text-anchor="middle">${escapeXml(unit)}</text>`
      );
    })
    .join('');

  // 複数のモーラを 1 枠に畳んだ枠には、下に括りを付ける。
  // 「かな」のような 2 モーラのフィギュアが、隣り合う 2 枠と見分けがつかなくなるため。
  // 拗音（2 文字だが 1 モーラ）には付けない。
  // phrases があるときは、畳まずに並べた語のまとまりのほうを括る
  const tieRanges: { from: number; to: number; accent: Accent | null }[] = phrases
    ? phrases.map(([from, to]) => ({ from, to, accent: ACCENTS[0] }))
    : units.flatMap((unit, i) =>
        moraCount(unit) < 2 ? [] : [{ from: i, to: i, accent: accentOf(i) }],
      );

  const ties = tieRanges
    .map(({ from, to, accent }) => {
      const y = SYMMETRY.baseline + SYMMETRY.groupTickGap * scale;
      const h = SYMMETRY.groupTickHeight * scale;
      const x1 = centers[from] - widths[from] / 2 + size * 0.05;
      const x2 = centers[to] + widths[to] / 2 - size * 0.05;
      return (
        `<path d="M ${r(x1)} ${r(y)} L ${r(x1)} ${r(y + h)} L ${r(x2)} ${r(y + h)} L ${r(x2)} ${r(y)}" ` +
        `fill="none" stroke="${accent ? accent.stroke : SYMMETRY.dimText}" ` +
        `stroke-width="${r(SYMMETRY.groupTickWidth * scale)}" stroke-linecap="round" stroke-linejoin="round" />`
      );
    })
    .join('');

  // 弧を張る位置。phrases があれば語のまとまりの中心、なければ枠の中心
  const arcAnchors = phrases
    ? phrases.map(([from, to]) => {
        const left = centers[from] - widths[from] / 2;
        const right = centers[to] + widths[to] / 2;
        return (left + right) / 2;
      })
    : centers;

  // 順序の軸が立たないカードは弧を引かない（figure.arcs: false）。呼応は色だけが示す。
  // phrases があるときは語どうしを 1 本で結ぶ。色は音の側が担うので、弧は先頭の色で引く。
  // なければ従来どおり組ごとに結び、結ぶ相手がいない組（要素が 1 つ以下）には弧を描かない
  const spans: Span[] = figure.arcs === false
    ? []
    : phrases
      ? [{ from: 0, to: phrases.length - 1, accent: ACCENTS[0] }]
      : groups.flatMap((group, i) =>
          group.length >= 2
            ? [
                {
                  from: Math.min(...group),
                  to: Math.max(...group),
                  accent: ACCENTS[i % ACCENTS.length],
                },
              ]
            : [],
        );
  const arcs = spans.map((span) => arcPath(span, spans, arcAnchors, size, scale)).join('');

  const maxTitleEm = available / SYMMETRY.titleFontSize;
  const lines = wrapText(ctx.title, maxTitleEm, SYMMETRY.titleMaxLines);
  // 行数が増えたぶん上へ持ち上げ、タイトル塊の重心を titleCenterY に保つ
  const baseline = SYMMETRY.titleCenterY - ((lines.length - 1) * SYMMETRY.titleLineHeight) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.bg}" />`,
    frameBadge(ctx.repetition),
    arcs,
    glyphs,
    ties,
    textBlock(lines, {
      x: MARGIN_X,
      baseline,
      fontSize: SYMMETRY.titleFontSize,
      lineHeight: SYMMETRY.titleLineHeight,
      fill: COLORS.text,
      fontFamily: FONT_FAMILY,
      fontWeight: 700,
    }),
    footer(SYMMETRY.siteY, SYMMETRY.siteFontSize, ctx.lyricist),
    '</svg>',
  ].join('');
}

/**
 * 呼応する音どうしを結ぶ弧。
 *
 * 二次ベジェは制御点の高さの半分までしか上がらないため、頂点を狙った高さに合わせるには
 * 制御点をその 2 倍に置く。入れ子になっている弧は、内側と重ならないよう段を上げる。
 */
function arcPath(
  span: Span,
  all: Span[],
  anchors: number[],
  size: number,
  scale: number,
): string {
  const nesting = all.filter(
    (other) =>
      other !== span &&
      other.from >= span.from &&
      other.to <= span.to &&
      (other.from > span.from || other.to < span.to),
  ).length;

  // 日本語グリフの上端はおよそベースラインから 0.88em 上
  const top = SYMMETRY.baseline - size * 0.88;
  const y = top - SYMMETRY.arcGap * scale;
  const apex = y - (SYMMETRY.arcLift + nesting * SYMMETRY.arcNestStep) * scale;
  const cy = 2 * apex - y;
  const x1 = anchors[span.from];
  const x2 = anchors[span.to];
  return (
    `<path d="M ${r(x1)} ${r(y)} Q ${r((x1 + x2) / 2)} ${r(cy)} ${r(x2)} ${r(y)}" fill="none" ` +
    `stroke="${span.accent.stroke}" stroke-width="${r(SYMMETRY.arcWidth * scale)}" stroke-linecap="round" />`
  );
}

/** 1 枠が占める幅（em）。1 文字なら 1em を下限とし、詰まりすぎないようにする */
function unitEm(unit: string): number {
  return Math.max(widthEm(unit), 1);
}

/** SVG 属性に長い小数を書かない */
function r(value: number): number {
  return Math.round(value * 100) / 100;
}
