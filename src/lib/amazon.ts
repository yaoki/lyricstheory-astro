/**
 * 推薦図書から Amazon へ出るリンク。
 *
 * トラッキング ID は**経路ごとに分けてある**。どの経路が購入に繋がるかを分離して測るためで、
 * X から Amazon へ直接飛ばすときは ltx-22、ストアフロント経由は ltstore-22 を使う。
 * 自サイトの書棚（一覧 `/books/` と個別 `/books/{slug}/`）はまとめて ltgarden-22。
 *
 * 書棚の中を一覧と個別でさらに割るかどうかは未決である。割るなら Amazon 側で ID を
 * 追加する手作業が要る（アソシエイト管理画面での発行はこちらから自動化できない）ので、
 * 分けたくなった時点で決める。いま 1 つにしてあるのは、測る前に細分するより
 * 「書棚経由が効いているか」を先に見たいため。
 */
const TAG = 'ltgarden-22';

/** ASIN から書影ページの URL を組み立てる。frontmatter に URL を持たせないのは、ID を変えるとき 1 箇所で済ませるため。 */
export function amazonUrl(asin: string): string {
  return `https://www.amazon.co.jp/dp/${asin}?tag=${TAG}`;
}

/** アソシエイト・プログラムの開示文。景表法・Amazon の規約いずれの要請でもあるので、リンクを出すページには必ず添える。 */
export const AMAZON_DISCLOSURE =
  'Amazonのアソシエイトとして、lyricstheory.com は適格販売により収入を得ています。';
