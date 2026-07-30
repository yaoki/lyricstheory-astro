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
  accent: '#1d4ed8',
  accentFill: '#dbeafe',
  muted: '#64748b',
} as const;

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
