/**
 * OG 画像の寸法・色・座標。テンプレート（single / fallback）が共通で参照する。
 * 色はサイト本体の配色に合わせてある（リンク色 blue-700 を強調色として流用）。
 */

export const CANVAS = { width: 1200, height: 630 } as const;

/** 左右の版面マージン。タイトル・サイト名・図の最大幅はここから決まる */
export const MARGIN_X = 80;

export const COLORS = {
  bg: '#f8fafc',
  text: '#0f172a',
  boxStroke: '#94a3b8',
  muted: '#64748b',
} as const;

/**
 * 呼応の組ごとの色。1 枚の図に複数の呼応があるとき、どの枠とどの枠が対応するかを色で分ける。
 * 先頭はサイトのリンク色に合わせてある。
 */
export const ACCENTS = [
  { stroke: '#1d4ed8', fill: '#dbeafe' }, // blue
  { stroke: '#b45309', fill: '#fef3c7' }, // amber
  { stroke: '#0f766e', fill: '#ccfbf1' }, // teal
] as const;

export const FONT_FAMILY = 'Noto Sans JP';

export const SITE_NAME = 'lyricstheory.com';
export const AUTHOR_NAME = 'やおき';
/** 図の左下に置く署名 */
export const SIGNATURE = `${AUTHOR_NAME} / ${SITE_NAME}`;

/**
 * 分析のフレームを示すバッジ。図の左上に置き、読み始める前に目に入るようにする。
 *
 * これは個々の音の構造（音節が C+V でできていること）ではなく、
 * **この図をどの枠で見ているか**の宣言である。三類型は類型であって単位ではない。
 */
export const FRAME_BADGE = {
  x: MARGIN_X,
  y: 56,
  width: 168,
  height: 56,
  radius: 10,
  fontSize: 30,
} as const;

export const REPETITION_LABELS: Record<string, string> = {
  c: 'C反復',
  v: 'V反復',
  cv: 'CV反復',
};

/**
 * 音を横一列に並べ、呼応する音を弧で結ぶ図。
 *
 * 枠を持たないのは、SNS のタイムラインで縮小表示されることを前提にしているため。
 * 装飾を削って文字を大きく取り、色の差だけで呼応を示す。
 */
export const SYMMETRY = {
  unitFontSize: 108,
  /** 音と音の間隔 */
  gap: 22,
  /** 音のベースライン */
  baseline: 320,
  /** 呼応していない音の色。読めるが前に出ない濃度にする */
  dim: '#cbd5e1',
  /** 弧の頂点を文字の上端から何 px 上に置くか */
  arcLift: 60,
  /** 弧の端点と文字の隙間 */
  arcGap: 10,
  /** 入れ子の弧を 1 段ぶん持ち上げる量 */
  arcNestStep: 44,
  arcWidth: 6,
  /** タイトルの縦位置。複数行のときは行数に応じて上へずらし、重心を保つ */
  titleCenterY: 470,
  titleFontSize: 40,
  titleLineHeight: 50,
  titleMaxLines: 2,
  siteY: 570,
  siteFontSize: 26,
} as const;

/**
 * 音節を上段に並べ、母音だけを下段に抜き出して塗る図。
 * 弧は母音の側（下）に描く。結んでいるのが音節ではなく母音であることを、位置で示すため。
 */
export const VOWEL = {
  boxSize: 130,
  boxRadius: 12,
  boxGap: 32,
  boxCenterY: 190,
  unitFontSize: 64,
  /** 母音のベースライン */
  vowelBaseline: 318,
  vowelFontSize: 42,
  /** 強調した母音の下敷きにする円の半径 */
  vowelBadgeRadius: 42,
  /** 弧の端点と母音バッジの隙間 */
  arcGap: 10,
  /** 弧が下へ垂れる深さ */
  arcDrop: 46,
  arcNestStep: 38,
  arcWidth: 5,
  titleCenterY: 480,
  titleFontSize: 44,
  titleLineHeight: 56,
  titleMaxLines: 2,
  siteY: 570,
  siteFontSize: 28,
} as const;

/**
 * 離れた 2 箇所を上下に並べる図（回帰反復）。
 * 行ラベルは構造的対応を担う要素なので、本文と同じ濃さで大きく置く。
 */
export const PAIR = {
  row1: 258,
  row2: 372,
  maxSize: 92,
  gap: 16,
  /** 行ラベルのぶんだけ音の領域を右に寄せる */
  labelWidth: 118,
  labelFontSize: 42,
  titleCenterY: 482,
  titleFontSize: 40,
  titleLineHeight: 50,
  titleMaxLines: 2,
  siteY: 572,
  siteFontSize: 26,
} as const;

export const FALLBACK = {
  titleCenterY: 320,
  titleFontSize: 56,
  titleLineHeight: 72,
  titleMaxLines: 3,
  siteY: 570,
  siteFontSize: 28,
} as const;
