import type { CollectionEntry } from 'astro:content';
import { lyricistOf } from './credit';
import { consonant } from './templates/consonant';
import { fallback } from './templates/fallback';
import { pair } from './templates/pair';
import { pivot } from './templates/pivot';
import { single } from './templates/single';

/**
 * elements カード 1 枚ぶんの figure.kind による dispatch を担う。
 *
 * `src/pages/og/[slug].png.ts`（1200×630 の OG 画像）と
 * `src/pages/og/thumb/[slug].png.ts`（320px のサムネ）の両方から
 * 同じロジックで同じ SVG を得るために切り出した。出力される SVG 文字列は
 * 元の `[slug].png.ts` と完全に一致する（バイト単位で同じ PNG が焼ける）。
 */
export function cardSvg(data: CollectionEntry<'elements'>['data']): string {
  const ctx = {
    title: data.title,
    // 分析のフレーム。図の左上に掲げる
    repetition: data.tags?.repetition,
    // 画像は単体で流通するため、引用の体裁として作詞者を図にも添える
    lyricist: lyricistOf(data.sources ?? []),
  };
  return data.figure?.kind === 'pair'
    ? pair(data.figure, ctx)
    : data.figure?.kind === 'pivot'
      ? pivot(data.figure, ctx)
      : data.figure?.kind === 'consonant'
        ? consonant(data.figure, ctx)
        : data.figure
          ? single(data.figure, ctx)
          : fallback(ctx);
}
