import type { CollectionEntry } from 'astro:content';

/**
 * カード間の参照を、宣言した側から**逆向きにも**引けるようにする。
 *
 * これが要る理由は運用にある。`related` は宣言した側のページにしか出ないため、
 * 双方向に見せるには両方のカードに同じ関係を手で書く必要があった
 * （CLAUDE.md「新規 element カードのデプロイ workflow」手順5）。**カードを 1 枚足すたびに
 * 相手側のファイルも開いて `updated` まで直す**という手順が、すべての手作業の源になっている。
 *
 * 逆引きを 1 つ用意すれば、片側に書くだけで両側に出る。同じ仕組みが `terms`（用語カード）にも
 * `books` / `webrefs`（外部文献）にも効く——**参照の向きを逆にするという操作は同じ**で、
 * 違うのはフィールド名と、逆から見たときの意味づけだけである。
 */

type Element = CollectionEntry<'elements'>;
type Post = CollectionEntry<'blog'>;

/** カードから他のカードを指すフィールド。値はいずれも参照先の id / slug の配列。 */
export type ReferenceField = 'related' | 'terms' | 'books' | 'webrefs';

export interface CardLink {
  id: string;
  title: string;
  href: string;
  kind: 'element' | 'essay';
}

/**
 * 参照を逆向きに引けるようにする。`Map<参照先の id, 参照している側の id[]>`。
 *
 * `books` / `webrefs` の逆引き（「この本を使っているカード」）も同じ関数で取れる。
 * 段階4 で books / webrefs の個別ページを作るときは、ここへフィールド名を渡す。
 */
export function invertReferences(elements: Element[], field: ReferenceField): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const entry of elements) {
    for (const target of entry.data[field] ?? []) {
      const bucket = index.get(target) ?? [];
      if (!bucket.includes(entry.id)) bucket.push(entry.id);
      index.set(target, bucket);
    }
  }
  return index;
}

/**
 * カード 1 枚分のリンクを解決する。
 *
 * **未解決の id は黙って捨てる。**タイポを検出するのは `scripts/check-cards.mjs` の検査5 の
 * 仕事で、そちらはビルドを止める。ここで例外を投げると、検査より先にビルドが落ちて
 * 「どのカードのどの参照が壊れているか」の一覧が出せなくなる。
 */
export function resolveCardLinks(
  entry: Element,
  elements: Element[],
  posts: Post[],
  backlinks: { related: Map<string, string[]>; terms: Map<string, string[]> },
) {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const bySlug = new Map(posts.map((p) => [p.data.slug, p]));

  const toLink = (id: string): CardLink | null => {
    const element = byId.get(id);
    if (element) {
      return { id, title: element.data.title, href: `/elements/${element.id}/`, kind: 'element' };
    }
    const post = bySlug.get(id);
    if (post) {
      return { id, title: post.data.title, href: `/${post.data.slug}/`, kind: 'essay' };
    }
    return null;
  };

  const resolve = (ids: string[]): CardLink[] =>
    ids.map(toLink).filter((link): link is CardLink => link !== null);

  // 宣言した related と、他のカードから related された分を 1 つに束ねる。
  //
  // 既存の 241 組はほぼ相互に宣言されている（片方向は 1 本のみ）ため、統合するとほとんどが
  // 重複する。id で潰しておかないと、移行の途中で同じカードが 2 度並ぶ
  const declared = entry.data.related ?? [];
  const referencedBy = backlinks.related.get(entry.id) ?? [];
  const relatedIds = [...new Set([...declared, ...referencedBy])];

  // 用語カードから見た被参照は「この用語を使っているカード」＝実例のリストであって、
  // 対等な関連ではない。だから related には混ぜず、別の見出しで出す（2026-08-13、やおき裁定）
  const usedByIds = backlinks.terms.get(entry.id) ?? [];

  return {
    related: resolve(relatedIds),
    terms: resolve(entry.data.terms ?? []),
    usedBy: resolve(usedByIds),
  };
}
