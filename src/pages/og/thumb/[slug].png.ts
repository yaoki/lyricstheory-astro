import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { getCollection } from 'astro:content';
import { cardSvg } from '../../../lib/og/card-svg';
import { renderPng } from '../../../lib/og/render';

/**
 * 索引ページ（/elements/atlas/）のコンタクトシート用に、幅 320px の軽いサムネを焼く。
 * 1200px の OG 画像をそのまま 132 枚並べると重すぎるための専用エンドポイント。
 *
 * SVG を 320 で直接描く。`scripts/thumbnail.mjs` の `shrinkPng` は
 * 1200px ラスタ→base64→再ラスタなので、こちらのほうが速く文字も鮮明。
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
  return new Response(new Uint8Array(renderPng(cardSvg(props.card.data), 320)), {
    headers: { 'Content-Type': 'image/png' },
  });
};
