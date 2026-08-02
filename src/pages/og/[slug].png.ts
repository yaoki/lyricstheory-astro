import type { APIRoute, InferGetStaticPropsType } from 'astro';
import { getCollection } from 'astro:content';
import { renderPng } from '../../lib/og/render';
import { lyricistOf } from '../../lib/og/credit';
import { fallback } from '../../lib/og/templates/fallback';
import { pair } from '../../lib/og/templates/pair';
import { pivot } from '../../lib/og/templates/pivot';
import { single } from '../../lib/og/templates/single';

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
  const ctx = {
    title: data.title,
    // 分析のフレーム。図の左上に掲げる
    repetition: data.tags?.repetition,
    // 画像は単体で流通するため、引用の体裁として作詞者を図にも添える
    lyricist: lyricistOf(data.sources ?? []),
  };
  const svg =
    data.figure?.kind === 'pair'
      ? pair(data.figure, ctx)
      : data.figure?.kind === 'pivot'
        ? pivot(data.figure, ctx)
        : data.figure
          ? single(data.figure, ctx)
          : fallback(ctx);

  return new Response(new Uint8Array(renderPng(svg)), {
    headers: { 'Content-Type': 'image/png' },
  });
};
