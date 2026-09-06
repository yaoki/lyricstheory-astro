import { getCollection } from 'astro:content';

// 通し番号 → slug の表。functions/e/[[path]].js が /e/<no>/ の 301 を返すときに引く。
// index.json（機械可読索引）と分けてあるのは、転送のたびに全カードの本文情報まで
// 読む必要が無いため。no 順で、値は slug だけ。
export async function GET() {
  const cards = await getCollection('elements');
  const map: Record<string, string> = {};
  for (const card of [...cards].sort((a, b) => a.data.no - b.data.no)) {
    map[String(card.data.no)] = card.id;
  }
  return new Response(JSON.stringify(map), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
