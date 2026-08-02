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
// 型の対応先: src/lib/og/templates/single.ts の SingleFigure
// 行数＝図に載せる箇所の数。1 箇所なら single、離れた 2 箇所の対比なら pair。
// 図の形が表すのは「何箇所載るか」であって、何を見ているか（フレーム）ではない。
// フレームは tags.repetition が決め、左上のバッジと色で示す。
// 3 つ目の形を足す前に、この規則で説明がつくかを必ず判定すること。
const singleFigure = z
  .object({
    kind: z.literal('single'),
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
    // aligned = 同位置の対比。expansion = 展開の対比（一方が伸びていること自体が観察）
    mode: z.enum(['aligned', 'expansion']).default('aligned'),
    // 上下の対応を手で指定する。省略すると順序保存的な共通ブロックを自動で取る。
    // 類音どうしの対応や、順序が交差する対応は自動では拾えないため
    correspondences: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])).optional(),
  })
  .superRefine((figure, ctx) => {
    // 列を揃えることは「同じ位置」という主張。音数が違うまま並べると
    // 韻律の対応（対応の三要素の③）を断定したことになる。③は保留中なので止める。
    //
    // ただし展開の観察では、揃えるほうが嘘になる。一方が伸びていることが観察の本体で、
    // 揃う範囲まで切り詰めると、展開が同位置の差し替えに見える。mode で切り分ける
    if (figure.mode === 'aligned' && figure.rows[0].length !== figure.rows[1].length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rows'],
        message:
          `2行の音数が違います（${figure.rows[0].length} と ${figure.rows[1].length}）。` +
          '列が揃わない対比は、位置の対応を主張したことになるため描けません。' +
          '展開を見せたいなら mode: expansion を指定してください',
      });
    }
  });

// 子音ピボット。single の**表示のバリエーション**であって 3 つ目の形ではない。
// 箇所の数は 1（rows が 2 要素になるのは、観察が改行をまたいで途切れず続く場合。
// 離れた 2 箇所の対比＝pair とは別物）。
//
// 呼応しない音は文字を出さず伏せる。**上限 8 は総枠数ではなく「文字を出す枠の数」に
// 引き継ぐ**。上限の趣旨は歌詞の連続的な再現の防止であり、伏せ字はそれに当たらないため。
// 総枠数の 24 は著作権ではなくレイアウト上の都合。24 枠で 1 枠約 32px、
// カードページでは明瞭に読めるが SNS で 1/3 に縮むと苦しい（16 枠までが快適圏）。
const pivotFigure = z
  .object({
    kind: z.literal('pivot'),
    // 上部に掲げる軸のラベル。「カ行子音」など。tags.phoneme から機械生成しないのは、
    // 清濁をまたぐ軸（/t/ に「だ」「で」を含める等）の但し書きが自動では書けないため
    axis: z.string().min(1).max(12),
    rows: z
      .array(
        z.object({
          length: z.number().int().min(2).max(24),
          pivots: z
            .array(
              z.object({
                at: z.number().int().nonnegative(),
                unit: z.string().min(1).max(4),
              }),
            )
            .min(1),
        }),
      )
      .min(1)
      .max(2),
  })
  .superRefine((figure, ctx) => {
    const exposed = figure.rows.reduce((sum, row) => sum + row.pivots.length, 0);
    if (exposed > 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rows'],
        message:
          `文字を出す枠が ${exposed} 個あります（上限 8）。` +
          '上限は著作権上のガードレールで、伏せた枠は数に入りませんが、' +
          '出す文字の数は single と同じ制限を受けます',
      });
    }
    figure.rows.forEach((row, rowIndex) => {
      const seen = new Set<number>();
      for (const { at } of row.pivots) {
        if (at >= row.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rows', rowIndex, 'pivots'],
            message: `at の ${at} は length（${row.length}）の範囲外です`,
          });
        }
        if (seen.has(at)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rows', rowIndex, 'pivots'],
            message: `at の ${at} が重複しています。1 つの位置に置ける音は 1 つです`,
          });
        }
        seen.add(at);
      }
    });
  });

const figureSchema = z.union([singleFigure, pairFigure, pivotFigure]);

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
