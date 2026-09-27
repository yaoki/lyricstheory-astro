/**
 * タイアップ（`song.tieup`）の表示用の文字列。
 *
 * カードページの見出し下・meta description・OG 画像の題の直下の 3 箇所が同じ書式を使う。
 * 書式を 1 箇所に置くのは、場所ごとに書き方が割れると検索面と SNS 面で作品名の表記が揃わなくなるため。
 */
export type Tieup = { medium?: string; work: string; role: string };

/** アニメ『スプーンおばさん』エンディング・テーマ（複数あれば「／」で区切る） */
export function formatTieup(tieup: readonly Tieup[] | undefined): string | undefined {
  if (!tieup || tieup.length === 0) return undefined;
  return tieup.map(({ medium, work, role }) => `${medium ?? ''}『${work}』${role}`).join('／');
}
