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
  /**
   * 複数のモーラを 1 枠に畳んだとき、その下に付ける括り（2026-08-02、やおき提案）。
   *
   * 「かな」のように 2 モーラで 1 つのフィギュアをなす枠は、字間がわずかに詰まるだけでは
   * 隣り合う 2 つの枠と見分けがつかない（実測で枠内 91px・枠間 110px の 17% 差しかなく、
   * SNS で 1/3 に縮むと 6px になる）。括りで「ここまでが 1 枠」を明示する。
   *
   * 拗音（「しゃ」）には付けない。2 文字だが 1 モーラで、畳んだものではないため
   */
  groupTickGap: 18,
  groupTickHeight: 12,
  groupTickWidth: 3,
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

/**
 * 子音の並びを、歌詞の上に振って見せる図。
 * 2 つ以上の子音が交替し続ける範囲を見るときに使う。
 *
 * 記号だけを並べた版を一度作ったが、それでは誰にも伝わらなかった（2026-08-02、やおき指摘）。
 * **図はブログを読みに行かなくても単体で伝わる強度を持たなければならない。**
 * 抽象（子音記号）と実音（歌詞）の対応こそが図の本体である。
 * 2014 年の記事の図が上段と下段を矢印で結んでいたのも同じ理由による。
 *
 * 歌詞の行は、カード本文が既に <LyricQuote> で引用している範囲と同じものを出す。
 * 図に出しても引用の総量は増えず、単体流通時の体裁は右下の作詞者クレジットが担う。
 *
 * 記号の種類ごとに色を割り当てる（出現順に ACCENTS）。記号を持たない音は dim に落とし、
 * 交替が起きている範囲を浮かび上がらせる。
 */
export const CONSONANT = {

  /** 音と音の間隔 */
  gap: 10,
  /** 音の上に振る記号の、音に対する大きさの比 */
  markRatio: 0.62,
  /** 記号と、その上にあるもの（音、または括り）との隙間 */
  markGap: 12,
  /** 括りがある行では詰める。括りと記号を近づけたぶん、次の行との距離が稼げる */
  markGapAfterTie: 4,
  /** 2 段目の記号を、1 段目からどれだけ下げるか（記号の大きさに対する比） */
  subLineRatio: 1.15,
  /**
   * 行数ごとの、1 行目のベースラインの目安と、音の大きさの上限。
   *
   * 行を増やすのはメロディの切れ目で割るためで（重音節が行頭に立つことが見える）、
   * 増えたぶんは 1 行を小さくして収める。
   *
   * **行送りは固定値にせず、音の大きさから計算する**（rowStepRatio）。
   * 1 行は「記号（上）＋音＋括り（下）」を占めるので、固定値だと音が大きいときに
   * 次の行の記号が前の行の括りへ食い込む。
   */
  layouts: {
    1: { baseline: 300, maxSize: 62 },
    2: { baseline: 250, maxSize: 62 },
    3: { baseline: 200, maxSize: 46 },
    4: { baseline: 160, maxSize: 34 },
  } as Record<number, { baseline: number; maxSize: number }>,
  /** 行送り＝音の大きさ × これ。1 行の占有（音＋括り＋記号）を賄う */
  rowStepRatio: 2.2,
  /**
   * いちばん下の行のベースラインをここより下げない。
   * カードページの本文は OG 画像を y=400 で刈るので、括りのぶんを見て手前で止める
   */
  bottomLimit: 380,
  titleCenterY: 470,
  titleFontSize: 40,
  titleLineHeight: 50,
  titleMaxLines: 2,
  siteY: 570,
  siteFontSize: 26,
} as const;

/**
 * 子音ピボット。軸の子音が、母音を変えながら行の端から端まで散らばって現れる現象を描く。
 *
 * single と違い、呼応しない音は**文字を出さず**、伏せた印（dim の塗り矩形）だけを置く。
 * ピボットは「散らばり」そのものが観察の本体で、軸となる音は行の全長にわたるため、
 * 呼応する音を全部残すと single の上限8に収まらない（実測で9〜20音）。
 *
 * 伏せることで、行の長さと軸の位置を保ったまま歌詞を再現せずに済む。
 * **点の数は制限しない**。single の上限8は連続した音が並ぶことによる制約で、
 * 伏せ字を挟んで散在する点は何個あっても歌詞にならないため（`src/content.config.ts`）。
 *
 * 2014 年の記事 `sheena-ringo-repeated-consonance` にある著者自作の図法に由来する。
 * ただし当時の図が持っていた下段（歌詞の全行）は持たない。単体で流通する OG 画像に
 * 歌詞1行を焼くことになり、公開ポリシー（1カード1〜2行以内）と衝突するため。
 * 「どの語のどこか」はカード本文の <LyricQuote> が担う。
 */
export const PIVOT = {
  /**
   * 軸のラベルと、持続範囲を示す矢印の縦位置。
   * ここは他のテンプレートで FRAME_BADGE（C反復 / V反復 / CV反復）が座る場所だが、
   * ピボットはパターンではないのでバッジを出さない。代わりに軸そのものを掲げる
   */
  axisY: 112,
  axisFontSize: 34,
  /** 枠の列のベースライン（1 行のとき） */
  baseline: 310,
  /**
   * 2 行のときの 1 行目のベースライン。上に詰めてある。
   * カードページの本文は OG 画像を y=400 で刈って出す（`src/pages/elements/[slug]/index.astro`）。
   * 1 行めの位置のまま 2 行めを足すと、そこを越えて下段が欠ける
   */
  baselineTwoRows: 248,
  /** 2 行のとき、2 行目をこれだけ下げる */
  rowStep: 88,
  /** 枠と枠の間隔 */
  gap: 12,
  /** 文字を出す枠の最大の字の大きさ。セル幅がこれより狭ければセル幅に従う */
  unitFontSize: 76,
  /** 伏せた枠の高さと角丸。幅はセル幅から gap を引いたもの */
  maskHeight: 26,
  maskRadius: 6,
  /** 伏せた枠の上端を、その行のベースラインから何 px 上に置くか */
  maskOffset: 42,
  titleCenterY: 470,
  titleFontSize: 40,
  titleLineHeight: 50,
  titleMaxLines: 2,
  siteY: 570,
  siteFontSize: 26,
} as const;
