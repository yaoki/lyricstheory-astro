import { frameBadge, footer } from '../chrome';
import type { ConsonantFigure, ConsonantRow, FigureContext } from '../figure';
import {
  ACCENTS,
  CANVAS,
  COLORS,
  CONSONANT,
  FONT_FAMILY,
  FRAME_BADGE,
  MARGIN_X,
  SYMMETRY,
} from '../layout';
import { escapeXml, moraCount, textBlock, widthEm, wrapText } from '../text';

/** 子音を持たない位置。色は当てず、背景に落とす */
const EMPTY = 'Φ';

/** ベースラインより上へ字が伸びる比。仮名の近似 */
const ASCENT_RATIO = 0.78;
/** バッジの下端と、いちばん上の行の字の上端とのあいだに空ける隙間 */
const BADGE_GAP = 16;
/** バッジが出ないカードで、字の上端をここより上げない */
const TOP_LIMIT = 56;

/**
 * 子音の並びを、歌詞の上に振って見せる。
 *
 * 記号だけを並べた版を一度作ったが、それでは伝わらなかった（2026-08-02、やおき指摘）。
 * どの音が t で、どの音が Φ なのかが図の中で結びついていないと、本文を読みに
 * 行かないと読めない。**図はブログを読まずに単体で伝わる強度を持たなければならない。**
 *
 * だから行の音をそのまま並べ、該当する音の上に記号を振る。
 * 記号を持たない音は背景に落として、交替が起きている範囲を浮かび上がらせる。
 */
export function consonant(figure: Omit<ConsonantFigure, 'kind'>, ctx: FigureContext): string {
  const { rows } = figure;

  // 記号ごとの色。Φ を除いた出現順に割り当てる。交替が色の交互として見えるようにする。
  // 上の段と下の段は別々に色を配る。上が 1 色のまま下だけ変われば、
  // 「保たれるもの／動くもの」の差がそのまま色の差になる
  const palette = new Map<string, string>();
  for (const { symbol } of rows.flatMap((row) => row.marks)) {
    if (symbol === EMPTY || palette.has(symbol)) continue;
    palette.set(symbol, ACCENTS[palette.size % ACCENTS.length].stroke);
  }
  const subPalette = new Map<string, string>();
  for (const { sub } of rows.flatMap((row) => row.marks)) {
    if (sub === undefined || sub === EMPTY || subPalette.has(sub)) continue;
    subPalette.set(sub, ACCENTS[subPalette.size % ACCENTS.length].stroke);
  }

  const available = CANVAS.width - MARGIN_X * 2;
  // セル幅はいちばん長い行に合わせる。行ごとに変えると同じ 1 音の幅が行で変わり、
  // 位置の対応が読めなくなる
  const longest = Math.max(...rows.map((row) => row.units.length));
  const cell = (available - (longest - 1) * CONSONANT.gap) / longest;
  const layout = CONSONANT.layouts[rows.length] ?? CONSONANT.layouts[4];
  const hasSub = rows.some((row) => row.marks.some((m) => m.sub !== undefined));

  // 大きさは横と縦の両方から決める。
  //
  // 横: 行の全字を「いちばん幅の広い枠」で割らない。1 枠でも「ぱー」や「しゃ」が
  // 混じると行の全字が半分に縮み、1/3 に縮んだとき記号が判読不能な点になる
  // （2026-08-11 実測。「ぱー」1 枠のせいで 62px → 32.5px、記号は 20px）。
  // pivot.ts:34 が同じ事故を先に解いている。全体は割らず、枠に収まらない字だけ
  // その枠で個別に落とす（下の unitSize）。
  //
  // 縦: 横だけ直すと、字が大きくなったぶん行の積み上げが伸びて 1 行目がバッジへ
  // 食い込む（2026-08-11、ame-nochi-hare-tr-sequenz で実測）。行送り・下の余白・
  // 字の上端はすべて size に比例するので、比例項を集めて割れば収まる上限が出る
  const stepRatio = hasSub ? CONSONANT.rowStepRatioWithSub : CONSONANT.rowStepRatio;
  const tickRatio = (SYMMETRY.groupTickGap + SYMMETRY.groupTickHeight) / SYMMETRY.unitFontSize;
  const markStackRatio = CONSONANT.markRatio * (hasSub ? 1 + CONSONANT.subLineRatio : 1);
  // バッジは 2 行までのカードにしか出ない（下の frameBadge の条件と揃えること）
  const top =
    rows.length <= 2 && frameBadge(ctx.repetition) !== ''
      ? FRAME_BADGE.y + FRAME_BADGE.height + BADGE_GAP
      : TOP_LIMIT;
  const perSize = (rows.length - 1) * stepRatio + tickRatio + markStackRatio + ASCENT_RATIO;
  const size = Math.min(
    layout.maxSize,
    cell,
    // いちばん下の行が bottomLimit で止まるときの上限
    (CONSONANT.bottomLimit - top - CONSONANT.markGap) / perSize,
    // 1 行目が layout.baseline に座るときの上限
    (layout.baseline - top) / ASCENT_RATIO,
  );

  // 行送りは音の大きさから決める。1 行は音・括り・記号を縦に積むので、
  // 固定値だと音が大きいときに次の行の音が前の行の記号へ食い込む
  const step = size * (hasSub ? CONSONANT.rowStepRatioWithSub : CONSONANT.rowStepRatio);
  const span = (rows.length - 1) * step;
  // いちばん下の行は、括りと記号のぶんを見込んで手前で止める
  const below =
    (SYMMETRY.groupTickGap + SYMMETRY.groupTickHeight) * (size / SYMMETRY.unitFontSize) +
    CONSONANT.markGap +
    size * CONSONANT.markRatio * (hasSub ? 1 + CONSONANT.subLineRatio : 1);
  const first = Math.min(layout.baseline, CONSONANT.bottomLimit - span - below);

  const body = rows
    .map((row, i) => renderRow(row, first + i * step, cell, size, palette, subPalette))
    .join('');

  const maxTitleEm = available / CONSONANT.titleFontSize;
  const lines = wrapText(ctx.title, maxTitleEm, CONSONANT.titleMaxLines);
  const titleBaseline = CONSONANT.titleCenterY - ((lines.length - 1) * CONSONANT.titleLineHeight) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.bg}" />`,
    // 3 行以上のときは分析のフレームのバッジを出さない。
    // 図が上へ伸びてバッジの座る位置（左上）と重なるため
    rows.length <= 2 ? frameBadge(ctx.repetition) : '',
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

/**
 * 1 行ぶん。音を並べ、記号を持つ音の**下**に記号を振る。
 *
 * 記号は音の上ではなく下に置く（2026-08-02、やおき指示）。畳んだ枠には括りが付くので、
 * 記号を上に置くと括りと記号が音を挟んで離れ、どれがどの枠のものか読みにくくなる。
 * 括りのすぐ下に記号を置けば、「ここまでが 1 枠、その構造はこれ」と続けて読める。
 */
function renderRow(
  row: ConsonantRow,
  baseline: number,
  cell: number,
  size: number,
  palette: Map<string, string>,
  subPalette: Map<string, string>,
): string {
  const byIndex = new Map(row.marks.map((m) => [m.at, m.symbol]));
  const subByIndex = new Map(row.marks.flatMap((m) => (m.sub ? [[m.at, m.sub] as const] : [])));
  const parts: string[] = [];

  // 記号の縦位置は行のなかで揃える。畳んだ枠が 1 つでもあれば括りのぶんを見込む
  const k = size / SYMMETRY.unitFontSize;
  const hasTie = row.units.some((u) => moraCount(u) >= 2);
  const tieBottom = hasTie ? (SYMMETRY.groupTickGap + SYMMETRY.groupTickHeight) * k : 0;
  const markSize = size * CONSONANT.markRatio;
  const gapAbove = hasTie ? CONSONANT.markGapAfterTie : CONSONANT.markGap;
  const markBaseline = baseline + tieBottom + gapAbove + markSize * 0.94;

  for (let i = 0; i < row.units.length; i++) {
    const x = MARGIN_X + i * (cell + CONSONANT.gap) + cell / 2;
    const symbol = byIndex.get(i);
    // 記号を持たない音は背景に落とす。観察の範囲を浮かび上がらせるため
    const fill =
      symbol === undefined
        ? SYMMETRY.dimText
        : symbol === EMPTY
          ? COLORS.text
          : (palette.get(symbol) ?? COLORS.text);

    // 枠に収まらない字だけ、その枠で落とす。記号の段は行で揃えたままにする
    // （記号は行全体への注釈なので、枠ごとに大きさが変わると読みにくい）
    const unitSize = Math.min(size, cell / widthEm(row.units[i]));

    parts.push(
      `<text x="${r(x)}" y="${r(baseline)}" font-family="${FONT_FAMILY}" font-size="${r(unitSize)}" ` +
        `font-weight="700" fill="${fill}" text-anchor="middle">${escapeXml(row.units[i])}</text>`,
    );

    // 複数のモーラを 1 枠に畳んだ枠には、single と同じ括りを付ける
    if (moraCount(row.units[i]) >= 2) {
      const half = cell / 2 - size * 0.05;
      const ty = baseline + SYMMETRY.groupTickGap * k;
      const th = SYMMETRY.groupTickHeight * k;
      parts.push(
        `<path d="M ${r(x - half)} ${r(ty)} L ${r(x - half)} ${r(ty + th)} ` +
          `L ${r(x + half)} ${r(ty + th)} L ${r(x + half)} ${r(ty)}" fill="none" ` +
          `stroke="${fill}" stroke-width="${r(SYMMETRY.groupTickWidth * k)}" ` +
          `stroke-linecap="round" stroke-linejoin="round" />`,
      );
    }
    if (symbol === undefined) continue;

    // Φ は無彩色にする（ACCENTS を当てると「3 つ目の子音」に見える）が、
    // dim では薄すぎて読めないので muted を当てる
    parts.push(
      `<text x="${r(x)}" y="${r(markBaseline)}" font-family="${FONT_FAMILY}" ` +
        `font-size="${r(markSize)}" font-weight="700" ` +
        `fill="${symbol === EMPTY ? COLORS.muted : (palette.get(symbol) ?? COLORS.text)}" ` +
        `text-anchor="middle">${escapeXml(symbol)}</text>`,
    );

    // 下の段。上が保たれるもの、下が動くもの
    const sub = subByIndex.get(i);
    if (sub === undefined) continue;
    parts.push(
      `<text x="${r(x)}" y="${r(markBaseline + markSize * CONSONANT.subLineRatio)}" ` +
        `font-family="${FONT_FAMILY}" font-size="${r(markSize)}" font-weight="700" ` +
        `fill="${sub === EMPTY ? COLORS.muted : (subPalette.get(sub) ?? COLORS.text)}" ` +
        `text-anchor="middle">${escapeXml(sub)}</text>`,
    );
  }
  return parts.join('');
}

/** SVG 属性に長い小数を書かない */
function r(value: number): number {
  return Math.round(value * 100) / 100;
}
