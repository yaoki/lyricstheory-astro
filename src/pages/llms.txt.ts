import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { TYPE_ORDER, typeLabel } from '../lib/element-types';

// 旧 public/llms.txt（2026-07-19 手書き）は elements が生まれる前のもので、
// blog 13本しか案内していなかった。カードが増えるたびに手で書き足す形だと必ず古くなるため、
// content collection から組み立てる形に移した（2026-08-04）。

// blog の1行説明。schema の description は本文冒頭の自動抽出（abstract-handwrite-todo.md 参照）で
// 冗長なため、旧 llms.txt の手書き説明を正とする。配列の順序がそのまま出力順になる。
// ここに無い記事は description にフォールバックして末尾へ付くので、追加しても漏れない。
const BLOG_NOTES: Array<[string, string]> = [
  ['sheena-ringo-repeated-consonance', '子音ピボットという独自概念の初出記事。'],
  [
    'how-to-write-like-an-asian-kung-fu-generation',
    'メロディ1ノートに歌詞2音を詰め込む技術6ヶ条の解説。',
  ],
  ['i-dan-consonance-exercises', 'い段子音を利用した作詞課題。'],
  ['public-memo', '個別議論のメモ集。'],
  ['utada-hikaru-like-mora-syllable-articulation', '半シラブル化仮説の初出記事。'],
  ['how-to-accent-consonances-like-utada-hikaru', '宇多田カットと子音強調の分析。'],
  ['where-to-place-nn-consonances-like-utada-hikaru', '拍位置と「ん」音の配置分析。'],
  ['where-to-place-ii-like-utada-hikaru', '拍位置と「い」音の強調分析。'],
  ['essay-on-art-of-utada-hikarus-alliteration-and-rhyme', '頭韻とライムのエセー。'],
  ['essay-on-glay-like-repetition-and-little-rhyme', 'GLAY のたたみかけ技法のエセー。'],
  ['how-to-write-lyrics-bop-writing', 'バップライティングという発想法の解説。'],
  ['how-to-start-writing-lyrics', '歌詞分析と作詞の基本手順。'],
  [
    'sekai-no-owari-dragon-night-closed-syllable-consonant',
    'クローズド・シラブル発音のケーススタディ。',
  ],
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(_context: APIContext) {
  const site = 'https://lyricstheory.com';

  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const bySlug = new Map(posts.map((p) => [p.data.slug, p]));
  const orderedPosts: Array<{ title: string; slug: string; note: string }> = [];
  for (const [slug, note] of BLOG_NOTES) {
    const post = bySlug.get(slug);
    if (!post) continue;
    orderedPosts.push({ title: post.data.title, slug, note });
    bySlug.delete(slug);
  }
  // BLOG_NOTES に無い記事（今後追加されるもの）は description を使って末尾へ
  for (const post of [...bySlug.values()].sort(
    (a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf(),
  )) {
    orderedPosts.push({
      title: post.data.title,
      slug: post.data.slug,
      note: post.data.description,
    });
  }

  const cards = await getCollection('elements');
  const byType = new Map<string, typeof cards>();
  for (const card of cards) {
    const list = byType.get(card.data.type) ?? [];
    list.push(card);
    byType.set(card.data.type, list);
  }
  // 推奨語彙に無い type が現れても落とさない
  const types = [
    ...TYPE_ORDER.filter((t) => byType.has(t)),
    ...[...byType.keys()].filter((t) => !TYPE_ORDER.includes(t)).sort(),
  ];

  const elementSections = types
    .map((type) => {
      const list = (byType.get(type) ?? [])
        .slice()
        .sort((a, b) => b.data.updated.valueOf() - a.data.updated.valueOf());
      const heading = `${typeLabel(type)}（${type}）`;
      const lines = list
        .map(
          (card) =>
            `- [${card.data.title}](${site}/elements/${card.id}/): 更新 ${iso(card.data.updated)}`,
        )
        .join('\n');
      return `### ${heading}\n\n${lines}`;
    })
    .join('\n\n');

  const latest = cards
    .slice()
    .sort((a, b) => b.data.updated.valueOf() - a.data.updated.valueOf())[0];

  const body = `# lyricstheory.com

> 日本語歌詞の音韻分析を扱う批評サイト。著者やおき（the 8 rise）が独自フレームワーク（子音ピボット、半シラブル化仮説、クローズド・シラブル、宇多田カット、バップライティング等）で J-POP の歌詞・作詞を分析する。

サイトは Astro による静的 HTML で配信され、JavaScript 実行なしで本文が読める。全記事は日本語。ライセンスは記事本文の教育・研究目的での引用を歓迎する（要出典明記）。

内容は二層に分かれる。**essays** は完成した批評記事（13本、2014-2015年）。**elements**（音韻要素の庭）は分析の最小単位を1件1カードで持つ常緑の層で、現在 ${cards.length} 枚あり、いまも増え続けている（最終更新 ${iso(latest.data.updated)}）。用語の定義と記述規範は elements 側が正本である。

## 記事一覧（essays）

${orderedPosts.map((p) => `- [${p.title}](${site}/${p.slug}/): ${p.note}`).join('\n')}

## 音韻要素の庭（elements）

分析の最小単位を1件1カードで持つ。公開後も編集を続ける常緑運用のため、記事と違って内容が更新される。一覧は ${site}/elements/ にある。

カードは成熟度（seed = 観察メモ / budding = 他カードとの関連が張られた状態 / evergreen = 定義・事例・反例が揃った状態）で管理される。

${elementSections}

## 独自フレームワーク（概念）

- **子音ピボット**: ある子音を軸として固定し、母音を変えながらフレーズの全長にわたって散らす分布。パターンではなく分布の観察である（椎名林檎の分析より提唱）
- **半シラブル化仮説**: モーラ的な日本語歌詞の中で子音を強調して発音することで擬似的にシラブル境界を発生させる仮説（宇多田ヒカルの分析より）
- **宇多田カット**: 半シラブル化を実現する具体的なカット技法
- **クローズド・シラブル vs オープン・シラブル**: 英語的発音と日本語的発音の対比軸
- **バップライティング**: ジャズのバップ演奏に着想を得た、音の合間を埋めるように歌詞を書く発想法
- **反復の三類型**: C反復（子音のみ一致）／ V反復（母音のみ一致）／ CV反復（両方一致）。類型であって単位ではない

用語の厳密な定義と記述規範の正本は、リポジトリ内の以下にある。要約ではなく原文を参照すること。

- 理論用語集: https://raw.githubusercontent.com/yaoki/lyricstheory-astro/main/docs/theory-glossary.md
- 記述規範: https://raw.githubusercontent.com/yaoki/lyricstheory-astro/main/docs/style-rules.md

## 引用について

- 記事本文からの引用は学術的・教育的用途を歓迎します
- 引用時は URL と著者名（やおき / the 8 rise）を明記してください
- 歌詞の引用は原曲の著作権を尊重してください（本サイトも短い引用のみ）
- ライセンスの詳細: ${site}/license/
- 著者情報: ${site}/author/yaoki/

## Sitemap

- [sitemap-index.xml](${site}/sitemap-index.xml)
- [RSS フィード](${site}/feed/index.xml)
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
