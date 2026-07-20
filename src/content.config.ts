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
        artist: z.array(z.string()).default([]),
        era: z.string().optional(),
        lang: z.string().default('ja'),
      })
      .default({ phoneme: [], artist: [], lang: 'ja' }),
    related: z.array(z.string()).default([]),
    sources: z.array(z.string()).default([]),
    created: z.coerce.date(),
    updated: z.coerce.date(),
  }),
});

export const collections = { blog, concept, author, elements };
