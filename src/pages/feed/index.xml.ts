import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
  return rss({
    title: 'lyricstheory.com',
    description: '日本語歌詞の音韻分析',
    site: context.site ?? 'https://lyricstheory.com',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/${post.data.slug}/`,
      categories: post.data.categories,
    })),
    customData: '<language>ja</language>',
  });
}
