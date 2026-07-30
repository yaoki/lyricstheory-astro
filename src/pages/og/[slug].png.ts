import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { getCollection } from 'astro:content';
import { renderPng } from '../../lib/og/render';
import { fallback } from '../../lib/og/templates/fallback';
import { symmetry } from '../../lib/og/templates/symmetry';

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
  const { data } = props.card;
  // 反復の類型は C/V スロットのどちらを色づけるかを決める
  const repetition = data.tags?.repetition;
  const svg = data.figure
    ? symmetry(data.figure, data.title, repetition)
    : fallback(data.title);

  return new Response(new Uint8Array(renderPng(svg)), {
    headers: { 'Content-Type': 'image/png' },
  });
};
