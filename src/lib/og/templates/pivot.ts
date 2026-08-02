import { footer } from '../chrome';
import type { FigureContext, PivotFigure, PivotRow } from '../figure';
import { ACCENTS, CANVAS, COLORS, FONT_FAMILY, MARGIN_X, PIVOT, SYMMETRY } from '../layout';
import { escapeXml, textBlock, widthEm, wrapText } from '../text';

/**
 * 子音ピボットを描く。軸の音だけを文字で出し、残りは伏せた印で置く。
 *
 * single が「呼応する音を大きく見せる」図なのに対し、これは「呼応が行のどこに
 * 散らばっているか」を見せる図である。だから伏せた枠が主役になり、
 * 「枠は描かず文字を大きく取る」（single の決めごと）とは別の設計になる。
 * 伏せた枠は線ではなく塗りにしてある。SNS で 1/3 に縮むと細い線は消えるため。
 *
 * kind は呼び出し側で振り分け済みなので受け取らない（single / pair と同じ理由）。
 */
export function pivot(figure: Omit<PivotFigure, 'kind'>, ctx: FigureContext): string {
  const { axis, rows } = figure;

  // セルの幅は、いちばん音数の多い行に合わせる。行ごとに変えると
  // 「同じ1音の幅」が行によって違うことになり、位置の対応が読めなくなる
  const longest = Math.max(...rows.map((row) => row.length));
  const available = CANVAS.width - MARGIN_X * 2;
  const cell = (available - (longest - 1) * PIVOT.gap) / longest;

  // 字がセルからはみ出さないようにする。複数文字の枠（拗音など）は文字数で割る
  const maxUnitEm = Math.max(...rows.flatMap((row) => row.pivots.map((p) => widthEm(p.unit))), 1);
  const size = Math.min(PIVOT.unitFontSize, cell / maxUnitEm);

  const centerX = (index: number, rowLength: number): number => {
    // 短い行は中央に寄せず左を揃える。軸の矢印が行をまたいで一続きに見えるようにするため
    const start = MARGIN_X;
    return start + index * (cell + PIVOT.gap) + cell / 2;
  };

  // 2 行のときは上に詰める。本文の図は y=400 で刈られるので、下段がそこを越えると欠ける
  const firstBaseline = rows.length >= 2 ? PIVOT.baselineTwoRows : PIVOT.baseline;

  const body = rows
    .map((row, rowIndex) => renderRow(row, rowIndex, firstBaseline, cell, size, centerX))
    .join('');

  // 軸の持続範囲。いちばん長い行の全幅にわたって伸ばす
  const axisLabel = `${escapeXml(axis)}`;
  const labelWidth = widthEm(axis) * PIVOT.axisFontSize;
  const arrowFrom = MARGIN_X + labelWidth + 24;
  const arrowTo = MARGIN_X + available;

  const maxTitleEm = available / PIVOT.titleFontSize;
  const lines = wrapText(ctx.title, maxTitleEm, PIVOT.titleMaxLines);
  const titleBaseline = PIVOT.titleCenterY - ((lines.length - 1) * PIVOT.titleLineHeight) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.bg}" />`,
    // 分析のフレーム（C反復 / V反復 / CV反復）のバッジは出さない。
    // あれはパターンと方向を表す語で、ピボットはパターンではないため（2026-08-02、やおき）。
    // 左上に掲げるのは軸そのもの（「カ行子音」）と、それが持続する範囲の矢印。
    `<text x="${MARGIN_X}" y="${PIVOT.axisY}" font-family="${FONT_FAMILY}" ` +
      `font-size="${PIVOT.axisFontSize}" font-weight="700" fill="${ACCENTS[0].stroke}">${axisLabel}</text>`,
    arrow(arrowFrom, arrowTo, PIVOT.axisY - PIVOT.axisFontSize * 0.3),
    body,
    textBlock(lines, {
      x: MARGIN_X,
      baseline: titleBaseline,
      fontSize: PIVOT.titleFontSize,
      lineHeight: PIVOT.titleLineHeight,
      fill: COLORS.text,
      fontFamily: FONT_FAMILY,
      fontWeight: 700,
    }),
    footer(PIVOT.siteY, PIVOT.siteFontSize, ctx.lyricist),
    '</svg>',
  ].join('');
}

/** 1 行ぶんの枠を描く。軸の音は文字、それ以外は伏せた印 */
function renderRow(
  row: PivotRow,
  rowIndex: number,
  firstBaseline: number,
  cell: number,
  size: number,
  centerX: (index: number, rowLength: number) => number,
): string {
  const baseline = firstBaseline + rowIndex * PIVOT.rowStep;
  const byIndex = new Map(row.pivots.map((p) => [p.at, p.unit]));
  const parts: string[] = [];

  for (let i = 0; i < row.length; i++) {
    const x = centerX(i, row.length);
    const unit = byIndex.get(i);
    if (unit === undefined) {
      // 伏せた音。文字を出さないので歌詞は再現されない
      const w = Math.max(cell - PIVOT.gap * 0.5, 6);
      parts.push(
        `<rect x="${r(x - w / 2)}" y="${r(baseline - PIVOT.maskOffset)}" width="${r(w)}" ` +
          `height="${PIVOT.maskHeight}" rx="${PIVOT.maskRadius}" fill="${SYMMETRY.dim}" />`,
      );
      continue;
    }
    parts.push(
      `<text x="${r(x)}" y="${r(baseline)}" font-family="${FONT_FAMILY}" ` +
        `font-size="${r(size)}" font-weight="700" fill="${ACCENTS[0].stroke}" ` +
        `text-anchor="middle">${escapeXml(unit)}</text>`,
    );
  }
  return parts.join('');
}

/** 軸が持続する範囲を示す右向きの矢印 */
function arrow(from: number, to: number, y: number): string {
  const head = 14;
  return (
    `<path d="M ${r(from)} ${r(y)} L ${r(to)} ${r(y)}" stroke="${ACCENTS[0].stroke}" ` +
    `stroke-width="3" fill="none" />` +
    `<path d="M ${r(to)} ${r(y)} L ${r(to - head)} ${r(y - head * 0.5)} L ${r(to - head)} ${r(y + head * 0.5)} Z" ` +
    `fill="${ACCENTS[0].stroke}" />`
  );
}

/** SVG 属性に長い小数を書かない */
function r(value: number): number {
  return Math.round(value * 100) / 100;
}
