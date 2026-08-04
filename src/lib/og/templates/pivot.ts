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
  const layout = PIVOT.layouts[rows.length] ?? PIVOT.layouts[4];

  // セル幅だけで字の大きさを決めると、枠数の多い行（20 超）で 32px まで細り、
  // SNS で 1/3 に縮んだとき読めなくなる（2026-08-04、やおき指摘）。
  // ピボットの字は隣り合わず散在するため、セルをはみ出して書いても重ならない。
  // 伏せた帯は字の手前で切るので、はみ出しても帯には食い込まない
  const size = Math.min(layout.maxSize, Math.max(cell, PIVOT.minSize) / maxUnitEm);

  const centerX = (index: number, rowLength: number): number => {
    // 短い行は中央に寄せず左を揃える。軸の矢印が行をまたいで一続きに見えるようにするため
    const start = MARGIN_X;
    return start + index * (cell + PIVOT.gap) + cell / 2;
  };

  // 行が増えたぶんは上に詰める。本文の図は y=400 で刈られるので、下の行がそこを越えると欠ける
  const step = size * PIVOT.rowStepRatio;
  const span = (rows.length - 1) * step;
  const firstBaseline = Math.min(layout.baseline, PIVOT.bottomLimit - span);

  const body = rows
    .map((row, rowIndex) => renderRow(row, firstBaseline + rowIndex * step, cell, size, centerX))
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
  baseline: number,
  cell: number,
  size: number,
  centerX: (index: number, rowLength: number) => number,
): string {
  const byIndex = new Map(row.pivots.map((p) => [p.at, p.unit]));
  const parts: string[] = [];

  // 帯は字と同じ視覚的中心に置き、高さも字に比例させる。
  // ベースラインからの距離を固定値にしていたため、字が細る図で帯だけが上に浮いていた
  const maskHeight = Math.max(size * PIVOT.maskHeightRatio, 8);
  const maskTop = baseline - size * PIVOT.opticalCenterRatio - maskHeight / 2;
  // 字の左右に空ける余白。ここで帯を切るので、字が枠幅を超えても帯に食い込まない
  const clearance = size * 0.55;

  // 伏せた音は、連続するぶんを1本の帯に畳む。1音ずつ四角を並べると、枠数が20を超えた
  // あたりで点の列にしか見えず、軸の音がそこに埋もれる（2026-08-04、やおき指摘）。
  // 畳んでも各音の位置は動かないので、ピボットの本体である粗密は保たれる
  let runStart: number | null = null;

  const flushRun = (endExclusive: number): void => {
    if (runStart === null) return;
    const head = runStart > 0 ? clearance : PIVOT.gap / 2;
    const tail = endExclusive < row.length ? clearance : PIVOT.gap / 2;
    const left = centerX(runStart, row.length) - cell / 2 + head;
    const right = centerX(endExclusive - 1, row.length) + cell / 2 - tail;
    runStart = null;
    // 字と字の隙間に置ける帯が短すぎるときは出さない。点になって散らかるだけで、
    // そこに音があることは字と字の間隔がすでに示している
    if (right - left < PIVOT.minMaskWidth) return;
    parts.push(
      `<rect x="${r(left)}" y="${r(maskTop)}" width="${r(right - left)}" ` +
        `height="${r(maskHeight)}" rx="${PIVOT.maskRadius}" fill="${SYMMETRY.dim}" />`,
    );
  };

  for (let i = 0; i < row.length; i++) {
    const unit = byIndex.get(i);
    if (unit === undefined) {
      if (runStart === null) runStart = i;
      continue;
    }
    flushRun(i);
    parts.push(
      `<text x="${r(centerX(i, row.length))}" y="${r(baseline)}" font-family="${FONT_FAMILY}" ` +
        `font-size="${r(size)}" font-weight="700" fill="${ACCENTS[0].stroke}" ` +
        `text-anchor="middle">${escapeXml(unit)}</text>`,
    );
  }
  flushRun(row.length);
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
