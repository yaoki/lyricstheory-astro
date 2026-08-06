/**
 * カードの frontmatter が持つ figure の型。
 * 実体の検証は `src/content.config.ts` の figureSchema 側で行う（構造を変えるときは両方直す）。
 */

/**
 * 強調する位置。1 組なら [2, 4]、同じフレーズに複数の呼応があるなら [[2, 4], [5, 7]]。
 * 組ごとに色が変わり、それぞれ弧で結ばれる。
 */
export type Highlight = number[] | number[][];

/**
 * 音を横に並べ、呼応する音を弧で結ぶ。
 *
 * 図の形は 1 種類に統一してある。何を見ているか（C / V / CV のどのフレームか）は
 * 図の形ではなく、カードの tags.repetition が決めるバッジと色で示す。
 */
export interface SingleFigure {
  kind: 'single';
  units: string[];
  highlight: Highlight;
}

/**
 * 離れた 2 箇所の対比（回帰反復）。2 行をそのまま並べる。
 *
 * 共通部分を 1 回に圧縮しないのは、圧縮すると「2 度現れた」という事実が消え、
 * 想起の成立根拠が図から落ちるため。反復と差異を同時に見せる。
 */
export interface PairFigure {
  kind: 'pair';
  /** 上下に並べる 2 行。aligned では音数が揃っていること */
  rows: [string[], string[]];
  /** 左端に置く行ラベル（1-b / 2-b など）。回帰反復では構造的対応を担う要素 */
  labels: [string, string];
  /**
   * aligned（既定）= 同位置の対比。列を揃えることが「同じ位置」の主張になるため音数を揃える。
   * expansion = 展開の対比。一方が伸びていること自体が観察なので、揃えるほうが嘘になる。
   *
   * expansion で切り詰めると、展開が同位置の差し替えに見える。長さの差は省略できない。
   */
  mode?: 'aligned' | 'expansion';
  /**
   * 各行を折り返す位置（音の index。そこから次の行が始まる）。
   *
   * 長い展開をメロディの切れ目（2 小節ごと）で割ると、音数を減らさずに字を大きくできる
   * （2026-08-04、やおき提案）。34 音を 1 行に引き伸ばしていたカードでは字が 17px まで落ち、
   * 行ラベルのほうが歌詞より大きいという主従逆転が起きていた。
   *
   * 「展開では切り詰めない」を守ったまま読ませる唯一の手段。
   * aligned では使えない（列の突き合わせが成り立たなくなるため）
   */
  wraps?: [number[], number[]];
  /**
   * 上下の対応を手で指定する（[上の行の位置, 下の行の位置] の組）。
   * 省略すると順序保存的な共通ブロックを自動で取る。
   *
   * 自動では拾えない対応（類音どうし、順序が交差する対応）を描くための逃げ道。
   * 組ごとに色が変わる
   */
  correspondences?: [number, number][];
}

/**
 * 子音ピボット。軸の子音が、母音を変えながら行の端から端まで散らばって現れる。
 *
 * single の**表示のバリエーション**であって、3 つ目の「形」ではない。
 * 行数＝図に載せる箇所の数という規則の上では 1 箇所（rows が 2 要素になるのは
 * 観察が改行をまたいで途切れず続く場合で、離れた 2 箇所の対比ではない）。
 *
 * 呼応しない音は文字を出さず、伏せた印だけを置く。詳細は layout.ts の PIVOT。
 */
export interface PivotFigure {
  kind: 'pivot';
  /** 上部に掲げる軸のラベル（「カ行子音」など）。持続範囲の矢印がここから伸びる */
  axis: string;
  /** 1 行につき、総モーラ数と、軸の音が現れる位置 */
  rows: PivotRow[];
}

export interface PivotRow {
  /** その行の総モーラ数。伏せた枠を含む枠の総数になる */
  length: number;
  /** 軸の音。at は 0 起点の位置、unit は出す文字 */
  pivots: { at: number; unit: string }[];
  /**
   * その行の歌詞。伏せた枠が何の語だったかを、図の上に小さく添える（2026-08-06 追加）。
   *
   * 出すのはカード本文が既に <LyricQuote> で引用している範囲と同じものなので、
   * 引用の総量は増えない（consonant と同じ考え方）。省略すれば出ない。
   */
  text?: string;
}

/**
 * 子音の並びを、歌詞の上に振って見せる。
 *
 * 2 つ以上の子音が交替し続ける範囲を見るとき、単位は個々の音節ではなく子音の並びになる。
 * ただし**記号だけを並べても誰にも伝わらない**（2026-08-02、やおき指摘）。
 * どの音が t で、どの音が Φ なのかが図の中で結びついていないと、
 * 本文を読みに行かないと読めない絵になる。図は単体で流通するので、それでは届かない。
 *
 * だから行の仮名をそのまま並べ、該当する音の上に記号を振る。
 * 2014 年の記事の図が上段（抽象）と下段（歌詞）を矢印で結んでいたのと同じ考えで、
 * 抽象と実音の対応こそが図の本体である。
 */
export interface ConsonantFigure {
  kind: 'consonant';
  rows: ConsonantRow[];
}

export interface ConsonantRow {
  /** 行の音。1 音 1 枠で並ぶ */
  units: string[];
  /**
   * 記号を振る位置。at は units の添字、symbol は上の段（子音記号など）。
   *
   * sub は下の段。「保たれるもの（子音）」と「動くもの（母音）」を上下に分けて
   * 置くために使う。上下で別々に色が付くので、下だけが変わることが色でも見える
   */
  marks: { at: number; symbol: string; sub?: string }[];
}

export type Figure = SingleFigure | PairFigure | PivotFigure | ConsonantFigure;

/** 図に添える、figure 以外の情報 */
export interface FigureContext {
  title: string;
  /** 分析のフレーム（カードの tags.repetition） */
  repetition?: string;
  /** 引用の体裁として図に添える作詞者。取れなければ出さない */
  lyricist?: string;
}

/** [2, 4] と [[2, 4], [5, 7]] の両方を受けて、組の配列に揃える */
export function normalizeHighlight(highlight: Highlight): number[][] {
  if (highlight.length === 0) return [];
  return typeof highlight[0] === 'number' ? [highlight as number[]] : (highlight as number[][]);
}
