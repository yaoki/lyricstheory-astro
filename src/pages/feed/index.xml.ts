import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { typeLabel } from '../../lib/element-types';

// elements には description フィールドが無く、本文（MDX）からの抜き出しも禁止
// （<LyricQuote> 等の JSX がそのまま流れる危険があるため）。
// type と tags.artist から短い説明文を機械生成する。歌詞は一切含めない。
function describeElement(type: string, artists: string[]): string {
  const label = typeLabel(type);
  return artists.length > 0
    ? `${label}の観察カード（${artists.join('・')}）`
    : `${label}の観察カード`;
}

export async function GET(context: APIContext) {
  const [posts, elements] = await Promise.all([
    getCollection('blog', ({ data }) => !data.draft),
    getCollection('elements'),
  ]);

  const blogItems = posts.map((post) => ({
    title: post.data.title,
    description: post.data.description,
    pubDate: post.data.pubDate,
    link: `/${post.data.slug}/`,
    categories: post.data.categories,
  }));

  const elementItems = elements.map((entry) => ({
    title: entry.data.title,
    description: describeElement(entry.data.type, entry.data.tags.artist),
    // 常緑運用（公開後も編集し続ける）のため updated ではなく created を使う。
    // updated を使うと編集のたびに購読者へ再通知が飛んでしまう。
    pubDate: entry.data.created,
    link: `/elements/${entry.id}/`,
  }));

  // essays 13本は 2015 年で更新が止まっており、今後増えない。全件残す。
  // 単純に全体を日付順で上位50件に切ると、2026 年の elements が全部上位を占めて
  // essays が1本もフィードに載らなくなる（実測で確認）。絞るのは elements だけにする。
  const recentElements = elementItems
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf())
    .slice(0, 50);

  const items = [...blogItems, ...recentElements].sort(
    (a, b) => b.pubDate.valueOf() - a.pubDate.valueOf(),
  );

  return rss({
    title: 'lyricstheory.com',
    description: '日本語歌詞の音韻分析',
    site: context.site ?? 'https://lyricstheory.com',
    items,
    customData: '<language>ja</language>',
  });
}
