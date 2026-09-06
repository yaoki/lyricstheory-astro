import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { getCollection } from 'astro:content';
import { cardSvg } from '../../lib/og/card-svg';
import { renderPng } from '../../lib/og/render';

/**
 * elements カード 1 枚につき OG 画像 1 枚をビルド時に生成する。
 * 出力先は /og/{slug}.png（slug は elements の id と同じ）。
 */
export async function getStaticPaths() {
  const cards = await getCollection('elements');
  return cards.map((card) => ({
    params: { slug: card.id },
    props: { card },
  }));
}

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export const GET: APIRoute<Props> = ({ props }) => {
  return new Response(new Uint8Array(renderPng(cardSvg(props.card.data))), {
    headers: { 'Content-Type': 'image/png' },
  });
};
