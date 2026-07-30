import { normalizeHighlight, type VowelFigure } from '../figure';
import { vowelsOf } from '../kana';
import { ACCENTS, CANVAS, COLORS, FONT_FAMILY, MARGIN_X, SITE_NAME, VOWEL } from '../layout';
import { escapeXml, textBlock, widthEm, wrapText } from '../text';

type Accent = (typeof ACCENTS)[number];

interface Span {
  from: number;
  to: number;
  accent: Accent;
}

/**
 * 音節を上段に並べ、母音だけを下段に抜き出して塗る。
 * 子音が動いていても母音が留まっている、という形を一目で見せるための図。
 */
export function vowel(figure: Omit<VowelFigure, 'kind'>, title: string): string {
  const { units } = figure;
  const vowels = figure.vowels ?? vowelsOf(units);
  const groups = normalizeHighlight(figure.highlight);
  const n = units.length;

  const available = CANVAS.width - MARGIN_X * 2;
  const natural = n * VOWEL.boxSize + (n - 1) * VOWEL.boxGap;
  const scale = Math.min(1, available / natural);

  const box = VOWEL.boxSize * scale;
  const gap = VOWEL.boxGap * scale;
  const radius = VOWEL.boxRadius * scale;
  const totalWidth = n * box + (n - 1) * gap;
  const startX = (CANVAS.width - totalWidth) / 2;
  const boxTop = VOWEL.boxCenterY - box / 2;

  const centerX = (i: number) => startX + i * (box + gap) + box / 2;
  const accentOf = (i: number): Accent | null => {
    const group = groups.findIndex((g) => g.includes(i));
    return group === -1 ? null : ACCENTS[group % ACCENTS.length];
  };

  // 上段: 音節。母音が主役なので、枠は塗らず線だけで示す
  const boxes = units
    .map((unit, i) => {
      const x = startX + i * (box + gap);
      const accent = accentOf(i);
      const rect =
        `<rect x="${r(x)}" y="${r(boxTop)}" width="${r(box)}" height="${r(box)}" rx="${r(radius)}" ` +
        `fill="none" stroke="${accent ? accent.stroke : COLORS.boxStroke}" ` +
        `stroke-width="${r((accent ? 4 : 3) * scale)}" />`;
      const inner = box * 0.82;
      const fontSize = Math.min(
        VOWEL.unitFontSize * scale,
        inner / Math.max(widthEm(unit), 0.5),
      );
      return (
        rect +
        `<text x="${r(centerX(i))}" y="${r(VOWEL.boxCenterY + fontSize * 0.35)}" ` +
        `font-family="${FONT_FAMILY}" font-size="${r(fontSize)}" font-weight="700" ` +
        `fill="${accent ? accent.stroke : COLORS.text}" text-anchor="middle">${escapeXml(unit)}</text>`
      );
    })
    .join('');

  const badgeRadius = VOWEL.vowelBadgeRadius * scale;
  const vowelFontSize = VOWEL.vowelFontSize * scale;
  const vowelCenterY = VOWEL.vowelBaseline - vowelFontSize * 0.35;

  // 下段: 母音。強調するものだけ円で塗る（「ん」「っ」のように母音が無い音は空ける）
  const vowelMarks = vowels
    .map((v, i) => {
      if (v === null) return '';
      const accent = accentOf(i);
      const badge = accent
        ? `<circle cx="${r(centerX(i))}" cy="${r(vowelCenterY)}" r="${r(badgeRadius)}" fill="${accent.fill}" />`
        : '';
      return (
        badge +
        `<text x="${r(centerX(i))}" y="${r(VOWEL.vowelBaseline)}" font-family="${FONT_FAMILY}" ` +
        `font-size="${r(vowelFontSize)}" font-weight="700" fill="${accent ? accent.stroke : COLORS.muted}" ` +
        `text-anchor="middle">${escapeXml(v)}</text>`
      );
    })
    .join('');

  const spans: Span[] = groups.flatMap((group, i) =>
    group.length >= 2
      ? [{ from: Math.min(...group), to: Math.max(...group), accent: ACCENTS[i % ACCENTS.length] }]
      : [],
  );
  const arcs = spans
    .map((span) => arcPath(span, spans, centerX, vowelCenterY + badgeRadius, scale))
    .join('');

  const maxTitleEm = (CANVAS.width - MARGIN_X * 2) / VOWEL.titleFontSize;
  const lines = wrapText(title, maxTitleEm, VOWEL.titleMaxLines);
  const baseline = VOWEL.titleCenterY - ((lines.length - 1) * VOWEL.titleLineHeight) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.bg}" />`,
    boxes,
    vowelMarks,
    arcs,
    textBlock(lines, {
      x: MARGIN_X,
      baseline,
      fontSize: VOWEL.titleFontSize,
      lineHeight: VOWEL.titleLineHeight,
      fill: COLORS.text,
      fontFamily: FONT_FAMILY,
      fontWeight: 700,
    }),
    textBlock([SITE_NAME], {
      x: MARGIN_X,
      baseline: VOWEL.siteY,
      fontSize: VOWEL.siteFontSize,
      lineHeight: VOWEL.siteFontSize,
      fill: COLORS.muted,
      fontFamily: FONT_FAMILY,
    }),
    '</svg>',
  ].join('');
}

/** 母音どうしを結ぶ弧。symmetry と違い、母音の下側へ垂らす */
function arcPath(
  span: Span,
  all: Span[],
  centerX: (i: number) => number,
  bottom: number,
  scale: number,
): string {
  const nesting = all.filter(
    (other) =>
      other !== span &&
      other.from >= span.from &&
      other.to <= span.to &&
      (other.from > span.from || other.to < span.to),
  ).length;

  const y = bottom + VOWEL.arcGap * scale;
  const apex = bottom + VOWEL.arcDrop + nesting * VOWEL.arcNestStep;
  const cy = 2 * apex - y;
  const x1 = centerX(span.from);
  const x2 = centerX(span.to);
  return (
    `<path d="M ${r(x1)} ${r(y)} Q ${r((x1 + x2) / 2)} ${r(cy)} ${r(x2)} ${r(y)}" fill="none" ` +
    `stroke="${span.accent.stroke}" stroke-width="${r(VOWEL.arcWidth)}" stroke-linecap="round" />`
  );
}

function r(value: number): number {
  return Math.round(value * 100) / 100;
}
