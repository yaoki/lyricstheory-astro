/**
 * カードの frontmatter が持つ figure の型。
 * 実体の検証は `src/content.config.ts` の figureSchema 側で行う（構造を変えるときは両方直す）。
 */

/**
 * 強調する位置。1 組なら [2, 4]、同じフレーズに複数の呼応があるなら [[2, 4], [5, 7]]。
 * 組ごとに色が変わり、それぞれ弧で結ばれる。
 */
export type Highlight = number[] | number[][];

/** 音を横に並べ、呼応する音を弧で結ぶ */
export interface SymmetryFigure {
  kind: 'symmetry';
  units: string[];
  highlight: Highlight;
}

/** 音節を上段に並べ、母音だけを下段に抜き出して塗る */
export interface VowelFigure {
  kind: 'vowel';
  units: string[];
  highlight: Highlight;
  /** 省略すると units の表記から自動で導く。導出が合わないときだけ明示する */
  vowels?: (string | null)[];
}

export type Figure = SymmetryFigure | VowelFigure;

/** [2, 4] と [[2, 4], [5, 7]] の両方を受けて、組の配列に揃える */
export function normalizeHighlight(highlight: Highlight): number[][] {
  if (highlight.length === 0) return [];
  return typeof highlight[0] === 'number' ? [highlight as number[]] : (highlight as number[][]);
}
