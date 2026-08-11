import { footer, frameBadge } from '../chrome';
import type { FigureContext, PairFigure } from '../figure';
import { ACCENTS, CANVAS, COLORS, FONT_FAMILY, MARGIN_X, PAIR, SYMMETRY } from '../layout';
import { escapeXml, textBlock, wrapText } from '../text';

/**
 * 離れた 2 箇所を上下に並べる。回帰反復のための図。
 *
 * 共通部分を 1 回に圧縮しない。圧縮すると「2 度現れた」という事実が消え、
 * 想起の成立根拠が図から落ちる。反復（動かない側）と差異（動く側）を同時に見せる。
 *
 * 行ラベルを小さくしないこと。回帰反復の定義は「構造的対応による想起」であり、
 * 距離は定義から棄却されている。図の中で構造的対応を担うのはラベルだけで、
 * 外すと上下に隣接した 2 行に見え、短期反復と取り違えられる。
 */
export function pair(figure: Omit<PairFigure, 'kind'>, ctx: FigureContext): string {
  const { rows, labels } = figure;
  const mode = figure.mode ?? 'aligned';

  // 一致の判定を表記の突き合わせで行うときだけ、CV反復のフレームに限る。
  // V反復で突き合わせると、母音が一致する「を／も」を差異と描き、左上のバッジと食い違う。
  //
  // 突き合わせを使うのは 2 箇所しかない。alignedSame（mode が aligned のときだけ）と
  // commonBlocks（correspondences を書かなかったときだけ）である。mode: expansion で
  // correspondences を明示すればどちらも通らず、色は correspondences から直接引かれ、
  // 差異の帯も出ない。このときだけ C反復・V反復のフレームでも図が嘘にならない
  // （2026-08-09 に緩和。それまでは理由を失ったままガードだけが効いていた）
  const matchesByNotation = mode === 'aligned' || figure.correspondences === undefined;
  if (matchesByNotation && ctx.repetition !== 'cv') {
    throw new Error(
      `pair の図は CV反復 のフレームでしか使えません（tags.repetition: ${ctx.repetition ?? 'なし'}）。\n` +
        '一致の判定を表記の突き合わせで行っているためです。\n' +
        'mode: expansion で correspondences を手で書けば、他のフレームでも使えます。',
    );
  }

  // 折り返し位置で各行を段に割る。長い展開をメロディの切れ目（2 小節ごと）で割ると、
  // 音数を減らさずに字を大きくできる（2026-08-04、やおき提案）。
  // 34 音を 1 行に引き伸ばしていたカードでは字が 17px まで落ちていた
  const wraps = figure.wraps ?? [[], []];
  const segments = rows.map((row, k) => {
    const cuts = [0, ...(wraps[k] ?? []), row.length];
    return cuts.slice(0, -1).map((start, i) => ({ start, end: cuts[i + 1] }));
  });
  const lineCount = segments[0].length + segments[1].length;
  // 列は最も長い段に取る。短い段は左を揃える（同じ 1 音の幅を段ごとに変えない）
  const cols = Math.max(...segments.flat().map((s) => s.end - s.start));

  // ラベル領域は実際の文字幅で取る。PAIR.labelWidth は「1-A」級の短いラベルを
  // 前提にした既定値でしかなく、「ラストサビ」のような語を入れると音に重なる。
  // ラベルは構造的対応を担う唯一の要素なので、縮めるのではなく領域を広げて逃がす
  const labelWidth = Math.max(PAIR.labelWidth, maxLabelEm(labels) * PAIR.labelFontSize + PAIR.gap);

  const available = CANVAS.width - MARGIN_X * 2 - labelWidth;
  // 展開の図は音数が増える。間隔を既定のままにすると隙間が幅を食って字が潰れるので、
  // 列数に応じて詰める
  const gap = Math.min(PAIR.gap, (available / cols) * 0.18);
  // 縦に積む段が増えたぶんは字を小さくする。使える縦の範囲から逆算するので、
  // 段が何段でも下端（タイトルの手前）を越えない。2 段なら従来と同じ値になる
  const byHeight =
    lineCount > 1
      ? (((PAIR.bottomLimit - PAIR.topLimit) / (lineCount - 1)) * PAIR.maxSize) /
        (PAIR.row2 - PAIR.row1)
      : PAIR.maxSize;
  const size = Math.min(PAIR.maxSize, (available - (cols - 1) * gap) / cols, byHeight);
  const totalWidth = cols * size + (cols - 1) * gap;
  const startX = MARGIN_X + labelWidth + (available - totalWidth) / 2;
  const at = (i: number) => startX + i * (size + gap) + size / 2;

  // 行間は字の大きさに従わせる。展開の図では音数が増えて字が小さくなるので、
  // 既定の間隔のままだと 2 行が離れて散り、上下の対応が読み取りにくくなる。
  // maxSize のときに従来の間隔と一致する係数にしてあり、既存カードの見た目は変わらない
  // ただし行ラベルは字の大きさに連動しない（構造的対応を担うので縮めない）。
  // 音に合わせて詰めるとラベル同士が重なるため、ラベルの高さを下限にする
  const center = (PAIR.row1 + PAIR.row2) / 2;
  // ラベルは各行の先頭の段にだけ付く。折り返して段が増えれば、ラベル同士の間隔は
  // 段数ぶん自然に開くので、下限もそのぶん緩めてよい
  const lineGap = Math.max(
    (PAIR.labelFontSize * 1.25) / segments[0].length,
    (size * (PAIR.row2 - PAIR.row1)) / PAIR.maxSize,
  );
  // 段は上から順に積む。上の行の段がすべて出てから、下の行の段が続く。
  // 中央に置くと下端がタイトルに食い込むので、下端で頭打ちにする
  const totalSpan = (lineCount - 1) * lineGap;
  const firstY = Math.min(center - totalSpan / 2, PAIR.bottomLimit - totalSpan);
  const yOf = (k: number, segIndex: number) =>
    firstY + (k === 0 ? segIndex : segments[0].length + segIndex) * lineGap;
  const row1 = yOf(0, 0);
  const row2 = yOf(1, 0);

  // 一致の見方は mode で変わる。
  //
  // aligned は同じ列どうしの突き合わせ。同位置の対比なのでこれで足りる。
  //
  // expansion は順序保存的な共通ブロックの突き合わせ。展開の定義は「もとの並びが
  // 順序保存的に保たれたまま、間隙に新しい要素が挿入される」であって、骨格は位置を
  // ずらして残る。列で突き合わせると、その骨格（「わら」「ように」）を差異と描いてしまい、
  // 展開が同位置の差し替えに見える
  const paired = (i: number) => rows[0][i] !== undefined && rows[1][i] !== undefined;
  const alignedSame = (i: number) => paired(i) && rows[0][i] === rows[1][i];

  // 位置がずれた対応は列で結べないので、ブロックごとに色を変えて結ぶ。
  // correspondences があればそれを使う（類音どうしや、順序が交差する対応は自動では拾えない）
  const groups: [number[], number[]][] =
    figure.correspondences?.map(([a, b]) => [
      typeof a === 'number' ? [a] : a,
      typeof b === 'number' ? [b] : b,
    ]) ?? commonBlocks(rows[0], rows[1]);

  const blockColor = new Map<string, string>();
  (mode === 'expansion' ? groups : []).forEach((block, k) => {
    const color = ACCENTS[k % ACCENTS.length].stroke;
    block.forEach((positions, row) => positions.forEach((i) => blockColor.set(`${row}:${i}`, color)));
  });

  // 展開・圧縮では、対応から外れた音を single と同じ薄色に落とす。本文色のままだと
  // 落ちた音のほうが濃く、骨格より目立ってしまう（2026-08-04、やおき指摘）。
  // aligned は差異を帯で示す設計なので、そちらの文字は本文色のまま
  const fillOf = (row: number, i: number) =>
    mode === 'expansion'
      ? (blockColor.get(`${row}:${i}`) ?? SYMMETRY.dimText)
      : alignedSame(i)
        ? ACCENTS[0].stroke
        : COLORS.text;

  // 差異は帯だけで示し、文字は本文色のままにする。
  // ACCENTS は「対応している音」を指す色なので、差異に使うと同じ色が
  // 反復と非反復の両方を指してしまう。
  //
  // 帯は同位置の対比でしか意味を持たない。展開では対応が列からずれるため、
  // 2 行をまたぐ矩形が「同じ位置の差異」を指さなくなる
  const band =
    mode === 'aligned'
      ? Array.from({ length: cols }, (_, i) =>
          !paired(i) || alignedSame(i)
            ? ''
            : `<rect x="${r(at(i) - size / 2 - gap / 2)}" y="${r(row1 - size * 0.95)}" ` +
              `width="${r(size + gap)}" height="${r(row2 - row1 + size * 1.2)}" rx="12" ` +
              `fill="${ACCENTS[1].fill}" opacity="0.5" />`,
        ).join('')
      : '';

  // 色（対応）は元の位置で決まるので、折り返しても対応の読み取りは変わらない
  const glyphs = rows
    .map((row, k) =>
      segments[k]
        .map((seg, si) =>
          row
            .slice(seg.start, seg.end)
            .map(
              (unit, j) =>
                `<text x="${r(at(j))}" y="${r(yOf(k, si))}" font-family="${FONT_FAMILY}" ` +
                `font-size="${r(size)}" font-weight="700" fill="${fillOf(k, seg.start + j)}" ` +
                `text-anchor="middle">${escapeXml(unit)}</text>`,
            )
            .join(''),
        )
        .join(''),
    )
    .join('');

  const rowLabels = labels
    .map(
      (text, k) =>
        `<text x="${MARGIN_X}" y="${r((k === 0 ? row1 : row2) - size * 0.16)}" ` +
        `font-family="${FONT_FAMILY}" font-size="${PAIR.labelFontSize}" font-weight="700" ` +
        `fill="${COLORS.text}">${escapeXml(text)}</text>`,
    )
    .join('');

  const lines = wrapText(ctx.title, (CANVAS.width - MARGIN_X * 2) / PAIR.titleFontSize, PAIR.titleMaxLines);
  const baseline = PAIR.titleCenterY - ((lines.length - 1) * PAIR.titleLineHeight) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${COLORS.bg}" />`,
    frameBadge(ctx.repetition),
    band,
    rowLabels,
    glyphs,
    textBlock(lines, {
      x: MARGIN_X,
      baseline,
      fontSize: PAIR.titleFontSize,
      lineHeight: PAIR.titleLineHeight,
      fill: COLORS.text,
      fontFamily: FONT_FAMILY,
      fontWeight: 700,
    }),
    footer(PAIR.siteY, PAIR.siteFontSize, ctx.lyricist),
    '</svg>',
  ].join('');
}

function r(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 2 行の順序保存的な共通ブロックを返す（[上の行の位置, 下の行の位置] の組）。
 *
 * 展開では骨格が位置をずらして残る（「わらえますように」／「わらいながら…のように」の
 * 「わら」「ように」）。列の突き合わせでは拾えないので、最長共通部分列で取る。
 *
 * 1 音だけの一致は落とす。助詞などの偶然の一致を骨格として描いてしまうため
 */
function commonBlocks(
  a: readonly string[],
  b: readonly string[],
  minLength = 2,
): [number[], number[]][] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const blocks: [number[], number[]][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      const last = blocks[blocks.length - 1];
      // 直前の一致と隣り合っていれば同じブロックに継ぐ
      if (last && last[0].at(-1) === i - 1 && last[1].at(-1) === j - 1) {
        last[0].push(i);
        last[1].push(j);
      } else {
        blocks.push([[i], [j]]);
      }
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return blocks.filter((block) => block[0].length >= minLength);
}

/** ラベルの最大幅を em で概算する。ASCII を半角、それ以外を全角として数える */
function maxLabelEm(labels: readonly string[]): number {
  const em = (text: string) =>
    [...text].reduce((sum, ch) => sum + (ch.charCodeAt(0) < 0x80 ? 0.5 : 1), 0);
  return Math.max(...labels.map(em));
}
