// /elements/atlas/ が使う純粋関数を切り出したモジュール。
//
// サーバー側（index.astro の frontmatter、五十音図とマトリクスの集計）と
// クライアント側（<script> 内の絞り込み）の両方から同じ関数を呼ぶ。
// ここに切り出してあるのは検証のためでもある——`<script>` の中身は Astro が
// バンドルしてしまうため直接テストできないが、ここに置いた関数なら
// Node からそのまま import して jsdom 無しでロジックだけ検算できる。

import { MORAIC_N, MORAIC_Q, parseTag } from '../../../lib/phoneme/axis';

export type PhonemeClassification = {
  /** onset と vowel の両方があるタグの交点（`k|a` の形）。カード内で重複しても 1 回だけ数える */
  cells: Set<string>;
  /** 裸の子音タグ（vowels 空）と、コーダのみのタグ（撥音・促音）。行の「行のみ」列に数える対象 */
  rowOnly: Set<string>;
  /** 裸の母音タグ（onset 無し）。「母音のみ」行に数える対象 */
  vowelOnly: Set<string>;
};

/**
 * 1 枚のカードが持つ `tags.phoneme` を、五十音図の 3 つの領域（交点・行のみ・母音のみ）へ分類する。
 *
 * **onset×vowel の直積を取ってはいけない。** `[k, a]` のカードに存在しない「か」が
 * 立ってしまう（CLAUDE.md 依頼文の警告）。ここではタグごとに `parseTag` を呼び、
 * そのタグ自身が申告している交点だけを拾う——`kei` なら k×e と k×i の両方、
 * `k` 単体なら「カ行・行のみ」だけで、どの母音とも交点を持たない。
 */
export function classifyPhonemeTags(tags: readonly string[]): PhonemeClassification {
  const cells = new Set<string>();
  const rowOnly = new Set<string>();
  const vowelOnly = new Set<string>();
  for (const tag of tags) {
    const { onset, vowels, coda } = parseTag(tag);
    if (onset && vowels.length > 0) {
      for (const v of vowels) cells.add(`${onset}|${v}`);
    } else if (onset && vowels.length === 0) {
      rowOnly.add(onset);
    } else if (!onset && vowels.length > 0) {
      for (const v of vowels) vowelOnly.add(v);
    } else if (!onset && vowels.length === 0 && coda) {
      // 撥音・促音単体（`q` など）。裸の子音と同じ「行のみ」列に数える
      rowOnly.add(coda);
    }
  }
  return { cells, rowOnly, vowelOnly };
}

/** `MORAIC_N` / `MORAIC_Q` を再輸出（呼び出し側が axis.ts を二重 import しなくて済むように） */
export { MORAIC_N, MORAIC_Q };

/**
 * カードの `tags.phoneme` から、一覧の絞り込み用モーラ（`ka` のような onset+vowel の
 * 文字列）を取る。五十音図のセルを押したときの `data-cv` に使う。
 *
 * `classifyPhonemeTags` の `cells`（`k|a` 区切り）とは表記が違う——こちらはハッシュや
 * data 属性にそのまま入れるための平文（`ka`）。
 */
export function moraTokensOf(tags: readonly string[]): string[] {
  const { cells } = classifyPhonemeTags(tags);
  return [...cells].map((key) => key.replace('|', ''));
}

/**
 * カードの表題から短い表示名を取る。
 *
 * 楽曲カードの題は `アーティスト『曲名』：観察名` の形なので「：」以降（観察名）を使う。
 * 用語・記述方針カードは `半シラブル化──モーラを保ったまま閉じる` の形なので
 * 「──」より前（用語そのもの）を使う。どちらの記号も無ければ全文を返す。
 */
export function shortTitle(title: string): string {
  const colonIdx = title.indexOf('：');
  if (colonIdx >= 0) return title.slice(colonIdx + 1);
  const dashIdx = title.indexOf('──');
  if (dashIdx >= 0) return title.slice(0, dashIdx);
  return title;
}

/** 用語カード（type: term）の列見出し。表題の「──」より前、無ければ全文 */
export function termColumnTitle(title: string): string {
  const dashIdx = title.indexOf('──');
  return dashIdx >= 0 ? title.slice(0, dashIdx) : title;
}

/**
 * 一覧の `<li>` が持つ dataset の型。実際は `HTMLElement.dataset`（DOMStringMap）を渡すが、
 * ここではテストのためにプレーンオブジェクトでも渡せるよう緩く型付けしてある。
 */
export type FilterableDataset = {
  cv?: string;
  c?: string;
  v?: string;
  artist?: string;
  type?: string;
  repetition?: string;
  terms?: string;
};

/**
 * `<li>` の dataset と、`種類|キー` 形式のフィルタキーを突き合わせる。
 *
 * - `cv|ka` — 五十音図の交点セル（そのモーラを申告しているカード）
 * - `c|t` — 五十音図の「行のみ」セル。data-c は裸の子音タグ（と撥音・促音）の申告そのもの
 *   なので、セルの数字と押したときの枚数が一致する。軸レベル（`axesOf`）で広く見るのは
 *   /elements/sounds/ の仕事で、索引は数えたものをそのまま出す
 * - `v|a` — 「母音のみ」セル。c と同じく裸の母音タグの申告そのもの
 * - `matrix|artist|colKind|colKey` — 作家 × 手法マトリクスのセル。`artist` が空文字なら
 *   song を持たないカードの行（「用語と方針」）を指す
 */
export function matchesFilter(dataset: FilterableDataset, filter: string | null): boolean {
  if (!filter) return true;
  const parts = filter.split('|');
  const kind = parts[0];
  if (kind === 'cv') return (dataset.cv ?? '').split(' ').includes(parts[1]);
  if (kind === 'c') return (dataset.c ?? '').split(' ').includes(parts[1]);
  if (kind === 'v') return (dataset.v ?? '').split(' ').includes(parts[1]);
  if (kind === 'matrix') {
    const [, artist, colKind, colKey] = parts;
    if ((dataset.artist ?? '') !== (artist ?? '')) return false;
    if (colKind === 'type') return dataset.type === colKey;
    if (colKind === 'rep') return dataset.repetition === colKey;
    if (colKind === 'term') return (dataset.terms ?? '').split(' ').includes(colKey ?? '');
    return false;
  }
  return false;
}

/**
 * `location.hash` を内部のフィルタキー（`cv|ka` の形）へ変換する。
 * `#cv=ka` `#c=t` `#v=a` の3形式だけを受ける。対応しない形は null（マトリクスの
 * セルは URL から指定できない——依頼文が挙げているのはこの3形式だけである）。
 */
export function hashToFilter(hash: string): string | null {
  const raw = decodeURIComponent(hash.replace(/^#/, ''));
  if (raw.startsWith('cv=')) return `cv|${raw.slice(3)}`;
  if (raw.startsWith('c=')) return `c|${raw.slice(2)}`;
  if (raw.startsWith('v=')) return `v|${raw.slice(2)}`;
  return null;
}
