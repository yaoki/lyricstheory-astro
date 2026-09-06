import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

// Claude との対話でカードを特定するための機械可読索引。
//
// no（通し番号）昇順で並べ、E42 表記に対応する数値と、カードを一意に特定できる
// 最小限のフィールドだけを返す。本文（Markdown/MDX の中身）は含めない——索引は
// 「どのカードか」を特定するためのもので、内容を読ませる用途は個別ページ・llms.txt が担う。

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(_context: APIContext) {
  const site = 'https://lyricstheory.com';
  const cards = await getCollection('elements');

  const index = cards
    .slice()
    .sort((a, b) => a.data.no - b.data.no)
    .map((card) => ({
      no: card.data.no,
      id: card.id,
      url: `${site}/elements/${card.id}/`,
      title: card.data.title,
      type: card.data.type,
      song: card.data.song ?? null,
      tags: card.data.tags,
      maturity: card.data.maturity,
      terms: card.data.terms,
      related: card.data.related,
      created: iso(card.data.created),
      updated: iso(card.data.updated),
    }));

  return new Response(JSON.stringify(index, null, 1), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
