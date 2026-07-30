import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().min(20).max(400),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    song: z
      .object({
        title: z.string(),
        artist: z.string(),
        lyricist: z.string(),
        composer: z.string(),
        releaseYear: z.number().int(),
      })
      .optional(),
    tags: z.array(z.string()).default([]),
    categories: z.array(z.string()).default([]),
    concepts: z.array(z.string()).default([]),
    slug: z.string().regex(/^[a-z0-9-]+$/, 'slug は英小文字・数字・ハイフンのみ'),
    xThreadUrl: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

const concept = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/concept' }),
  schema: z.object({
    title: z.string(),
    description: z.string().min(20).max(400),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    aliases: z.array(z.string()).default([]),
    references: z
      .array(
        z.object({
          citation: z.string(),
          url: z.string().url().optional(),
        }),
      )
      .default([]),
    relatedConcepts: z.array(z.string()).default([]),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

const author = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/author' }),
  schema: z.object({
    name: z.string(),
    alternateName: z.array(z.string()).default([]),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    url: z.string().url(),
    sameAs: z.array(z.string().url()).default([]),
    jobTitle: z.string().optional(),
    affiliation: z.array(z.string()).default([]),
    frameworks: z.array(z.string()).default([]),
    description: z.string(),
  }),
});

// OG 画像（/og/{slug}.png）に描く図の指定。任意。
// figure を持たないカードは図なしのフォールバックで生成される。
// 仕様: ../tasks/lyricstheory-og-symmetry-spec.md
// 型の対応先: src/lib/og/templates/symmetry.ts の SymmetryFigure
const figureSchema = z
  .object({
    // symmetry: 音を並べて呼応を弧で結ぶ / vowel: 音節を並べて母音を下段に抜き出す
    kind: z.enum(['symmetry', 'vowel']),
    // units の上限 8 は著作権上のガードレール（長い連続は歌詞の再現に近づく）。緩めないこと
    units: z.array(z.string().min(1).max(4)).min(2).max(8),
    // 1 組なら [2, 4]、同じフレーズに複数の呼応があるなら [[2, 4], [5, 7]]
    highlight: z
      .union([
        z.array(z.number().int().nonnegative()),
        z.array(z.array(z.number().int().nonnegative()).min(1)),
      ])
      .default([]),
    // kind: vowel のときだけ。省略すると units の表記から自動で導かれる
    vowels: z.array(z.string().min(1).max(2)).optional(),
  })
  .superRefine((figure, ctx) => {
    if (figure.vowels && figure.vowels.length !== figure.units.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vowels'],
        message: `vowels は units と同じ ${figure.units.length} 要素にしてください（いまは ${figure.vowels.length} 要素）`,
      });
    }
    const groups: number[][] =
      figure.highlight.length === 0
        ? []
        : typeof figure.highlight[0] === 'number'
          ? [figure.highlight as number[]]
          : (figure.highlight as number[][]);
    for (const index of groups.flat()) {
      if (index >= figure.units.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['highlight'],
          message: `highlight の ${index} は units（${figure.units.length} 要素）の範囲外です`,
        });
      }
    }
  });

const elements = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/elements' }),
  schema: z.object({
    title: z.string(),
    // enum ではなく string。10〜20枚溜まってから enum 化を検討する（推奨語彙は CLAUDE.md 参照）
    type: z.string(),
    maturity: z.enum(['seed', 'budding', 'evergreen']).default('seed'),
    tags: z
      .object({
        phoneme: z.array(z.string()).default([]),
        // 反復の類型（既刊の三類型）。c=子音のみ / v=母音のみ / cv=両方が反復に参与
        // 類型であって単位ではない。単位は譜割シラブルとその内部の C・V
        repetition: z.enum(['cv', 'v', 'c']).optional(),
        artist: z.array(z.string()).default([]),
        era: z.string().optional(),
        lang: z.string().default('ja'),
      })
      .default({ phoneme: [], artist: [], lang: 'ja' }),
    related: z.array(z.string()).default([]),
    sources: z.array(z.string()).default([]),
    figure: figureSchema.optional(),
    created: z.coerce.date(),
    updated: z.coerce.date(),
  }),
});

export const collections = { blog, concept, author, elements };
