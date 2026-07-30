/**
 * OG 画像の寸法・色・座標。テンプレート（symmetry / fallback）が共通で参照する。
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

export const SYMMETRY = {
  /** 枠の一辺。units が多いときはこの値を上限として縮む（§5.3 の初期値） */
  boxSize: 140,
  boxRadius: 12,
  boxGap: 32,
  /** 枠の中心の縦位置。枠が縮んでもこの中心は動かさない */
  boxCenterY: 240,
  unitFontSize: 72,
  /** 弧の頂点を枠上端から何 px 上に置くか */
  arcLift: 70,
  /** 入れ子の弧を 1 段ぶん持ち上げる量 */
  arcNestStep: 48,
  /** 弧の端点と枠上端の隙間 */
  arcGap: 12,
  arcWidth: 5,
  /** タイトルの縦位置。複数行のときは行数に応じて上へずらし、重心を保つ */
  titleCenterY: 470,
  titleFontSize: 44,
  titleLineHeight: 56,
  titleMaxLines: 2,
  siteY: 570,
  siteFontSize: 28,
} as const;

export const FALLBACK = {
  titleCenterY: 320,
  titleFontSize: 56,
  titleLineHeight: 72,
  titleMaxLines: 3,
  siteY: 570,
  siteFontSize: 28,
} as const;
