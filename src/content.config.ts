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
// 行数＝図に載せる箇所の数。1 箇所なら symmetry、離れた 2 箇所の対比なら pair。
// 図の形が表すのは「何箇所載るか」であって、何を見ているか（フレーム）ではない。
// フレームは tags.repetition が決め、左上のバッジと色で示す。
// 3 つ目の形を足す前に、この規則で説明がつくかを必ず判定すること。
const symmetryFigure = z
  .object({
    kind: z.literal('symmetry'),
    // units の上限 8 は著作権上のガードレール（長い連続は歌詞の再現に近づく）。緩めないこと
    units: z.array(z.string().min(1).max(4)).min(2).max(8),
    // 1 組なら [2, 4]、同じフレーズに複数の呼応があるなら [[2, 4], [5, 7]]
    highlight: z
      .union([
        z.array(z.number().int().nonnegative()),
        z.array(z.array(z.number().int().nonnegative()).min(1)),
      ])
      .default([]),
  })
  .superRefine((figure, ctx) => {
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

// 離れた 2 箇所の対比（回帰反復）。カード本文が既に両方を引用している範囲に留めること。
// 縛りは音数ではなく行数（1 カードあたり 1〜2 行以内、CLAUDE.md の引用ルール）。
const pairFigure = z
  .object({
    kind: z.literal('pair'),
    rows: z.tuple([
      z.array(z.string().min(1).max(4)).min(2),
      z.array(z.string().min(1).max(4)).min(2),
    ]),
    // 回帰反復では構造的対応を担う要素。省略できない
    labels: z.tuple([z.string().min(1).max(8), z.string().min(1).max(8)]),
  })
  .superRefine((figure, ctx) => {
    // 列を揃えることは「同じ位置」という主張。音数が違うまま並べると
    // 韻律の対応（対応の三要素の③）を断定したことになる。③は保留中なので止める
    if (figure.rows[0].length !== figure.rows[1].length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rows'],
        message:
          `2行の音数が違います（${figure.rows[0].length} と ${figure.rows[1].length}）。` +
          '列が揃わない対比は、位置の対応を主張したことになるため描けません',
      });
    }
  });

const figureSchema = z.union([symmetryFigure, pairFigure]);

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
