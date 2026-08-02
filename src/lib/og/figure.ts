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
   * 上下の対応を手で指定する（[上の行の位置, 下の行の位置] の組）。
   * 省略すると順序保存的な共通ブロックを自動で取る。
   *
   * 自動では拾えない対応（類音どうし、順序が交差する対応）を描くための逃げ道。
   * 組ごとに色が変わる
   */
  correspondences?: [number, number][];
}

export type Figure = SingleFigure | PairFigure;

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
