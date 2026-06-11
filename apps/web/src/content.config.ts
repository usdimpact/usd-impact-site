import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const baseSchema = z.object({
  title: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  slug: z.string(),
  category: z.string(),
  status: z.enum(['draft', 'review', 'ready-for-build', 'published']),
  readingLevel: z.string(),
  lastReviewed: z.string(),
  complianceNote: z.string(),
  sources: z.array(z.string()).default([]),
  internalLinks: z.array(z.string()).default([]),
  ctaPrimary: z.string().optional(),
  ctaSecondary: z.string().optional(),
  hero: z.string().optional(),
  subhero: z.string().optional(),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: baseSchema,
});

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: baseSchema,
});

const frameworks = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/frameworks' }),
  schema: baseSchema.extend({ visual: z.string().optional() }),
});

const leadMagnets = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/lead-magnets' }),
  schema: baseSchema.extend({ downloadPath: z.string().optional() }),
});

const benchmarkModules = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/benchmark-modules' }),
  schema: baseSchema.extend({ inputs: z.array(z.string()).default([]), refreshCadence: z.string().optional() }),
});

const glossary = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/glossary' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    status: z.enum(['draft', 'review', 'ready-for-build', 'published']),
    doNotTranslate: z.boolean().default(false),
    definition: z.string(),
  }),
});

export const collections = { pages, products, frameworks, leadMagnets, benchmarkModules, glossary };
