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
export interface SymmetryFigure {
  kind: 'symmetry';
  units: string[];
  highlight: Highlight;
}

export type Figure = SymmetryFigure;

/** [2, 4] と [[2, 4], [5, 7]] の両方を受けて、組の配列に揃える */
export function normalizeHighlight(highlight: Highlight): number[][] {
  if (highlight.length === 0) return [];
  return typeof highlight[0] === 'number' ? [highlight as number[]] : (highlight as number[][]);
}
