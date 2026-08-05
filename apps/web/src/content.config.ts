import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import fs from 'node:fs';

const publicationStatus = z.enum(['draft', 'review', 'ready-for-build', 'published']);

const baseSchema = z.object({
  title: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  slug: z.string(),
  category: z.string(),
  status: publicationStatus,
  readingLevel: z.string(),
  lastReviewed: z.string(),
  complianceNote: z.string(),
  sources: z.array(z.string()).default([]),
  internalLinks: z.array(z.string()).default([]),
  ctaPrimary: z.string().optional(),
  ctaPrimaryHref: z.string().optional(),
  ctaSecondary: z.string().optional(),
  ctaSecondaryHref: z.string().optional(),
  ctaSecondaryDownload: z.boolean().optional(),
  hero: z.string().optional(),
  subhero: z.string().optional(),
});

const newsSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  url: z.string().url(),
  publishedAt: z.string(),
  sourceType: z.enum(['primary', 'reporting']),
});

const newsHighlightSchema = z.object({
  headline: z.string(),
  development: z.string(),
  whyItMatters: z.string(),
  assets: z.array(z.string()).min(1),
  importance: z.enum(['high', 'medium', 'low']),
  verification: z.enum(['verified-primary', 'verified-multiple']),
  sourceIds: z.array(z.string()).min(1),
});

const newsCatalystSchema = z.object({
  date: z.string(),
  event: z.string(),
  eventType: z.enum([
    'central-bank', 'inflation', 'labor', 'growth', 'liquidity', 'energy',
    'corporate', 'regulatory', 'geopolitical', 'other',
  ]).default('other'),
  assets: z.array(z.string()).default([]),
  importance: z.enum(['high', 'medium', 'low']).default('medium'),
  impactScore: z.number().int().min(1).max(5).default(2),
  extraBrief: z.boolean().default(false),
  whyItMatters: z.string().default(''),
  sourceIds: z.array(z.string()).min(1),
});

const catalystVerifiedFactSchema = z.object({
  statement: z.string(),
  verification: z.enum(['verified-primary', 'verified-multiple']),
  sourceIds: z.array(z.string()).min(1),
});

const catalystTransmissionSchema = z.object({
  channel: z.string(),
  conditionalImpact: z.string(),
});

const weeklyReportThemeSchema = z.object({
  title: z.string(),
  summary: z.string(),
  editionDates: z.array(z.string()).min(1),
});

const weeklyReportSourceSchema = z.object({
  date: z.string(),
  title: z.string(),
  url: z.string(),
});

const monthlyReportThemeSchema = z.object({
  title: z.string(),
  summary: z.string(),
  weeklyReportDates: z.array(z.string()).min(1),
});

const monthlyReportSourceSchema = z.object({
  periodEnd: z.string(),
  title: z.string(),
  url: z.string(),
});

const monthlyReportScorePointSchema = z.object({
  periodEnd: z.string(),
  value: z.number(),
  regime: z.string(),
});

const monthlyReportDirectory = new URL('./content/monthly-reports/', import.meta.url);
const hasMonthlyReportFiles = fs.readdirSync(monthlyReportDirectory).some((name) => name.endsWith('.md'));
const catalystBriefDirectory = new URL('./content/catalyst-briefs/', import.meta.url);
const hasCatalystBriefFiles = fs.readdirSync(catalystBriefDirectory).some((name) => name.endsWith('.md'));

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
    status: publicationStatus,
    doNotTranslate: z.boolean().default(false),
    definition: z.string(),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    slug: z.string(),
    date: z.string(),
    generatedAt: z.string(),
    lastReviewed: z.string(),
    status: publicationStatus,
    category: z.literal('Daily USD Impact'),
    marketRegime: z.string(),
    summary: z.string(),
    featured: z.boolean().default(false),
    assets: z.array(z.string()).min(1),
    highlights: z.array(newsHighlightSchema).min(3).max(7),
    catalysts: z.array(newsCatalystSchema).default([]),
    sources: z.array(newsSourceSchema).min(2),
    complianceNote: z.string(),
  }),
});

const catalystBriefs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/catalyst-briefs' }),
  schema: z.object({
    title: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    slug: z.string(),
    eventKey: z.string(),
    event: z.string(),
    eventDate: z.string(),
    sourceEditionDate: z.string(),
    phase: z.enum(['preview', 'outcome']),
    generatedAt: z.string(),
    lastReviewed: z.string(),
    status: publicationStatus,
    category: z.literal('USD Impact Catalyst Brief'),
    statusLabel: z.enum(['scheduled-confirmed', 'rescheduled', 'cancelled', 'released']),
    summary: z.string(),
    assets: z.array(z.string()).min(1),
    verifiedFacts: z.array(catalystVerifiedFactSchema).min(2).max(6),
    transmissionChannels: z.array(catalystTransmissionSchema).min(2).max(5),
    whatToWatch: z.array(z.string()).min(3).max(6),
    sources: z.array(newsSourceSchema).min(2),
    complianceNote: z.string(),
  }),
});

const weeklyReports = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/weekly-reports' }),
  schema: z.object({
    title: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    slug: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    generatedAt: z.string(),
    lastReviewed: z.string(),
    status: publicationStatus,
    category: z.literal('Weekly USD Impact Brief'),
    summary: z.string(),
    score: z.object({
      value: z.number(),
      regime: z.string(),
      weekOverWeekChange: z.number(),
      fourWeekChange: z.number(),
      nearestRegimeBoundary: z.number(),
      sourceUrl: z.string().url(),
    }),
    themes: z.array(weeklyReportThemeSchema).min(3).max(5),
    sourceEditions: z.array(weeklyReportSourceSchema).min(1),
    catalysts: z.array(z.object({
      date: z.string(),
      event: z.string(),
      sourceEditionDate: z.string(),
    })).default([]),
    complianceNote: z.string(),
  }),
});

const monthlyReports = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/monthly-reports' }),
  schema: z.object({
    title: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    slug: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    generatedAt: z.string(),
    lastReviewed: z.string(),
    status: publicationStatus,
    category: z.literal('Monthly USD Impact Report'),
    summary: z.string(),
    scorePath: z.array(monthlyReportScorePointSchema).min(4).max(4),
    themes: z.array(monthlyReportThemeSchema).min(3).max(6),
    sourceWeeklyReports: z.array(monthlyReportSourceSchema).min(4).max(4),
    complianceNote: z.string(),
  }),
});


const quizzes = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/quizzes' }),
  schema: z.object({
    quizId: z.string(),
    canonicalId: z.string(),
    language: z.string(),
    title: z.string(),
    seoTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    slug: z.string(),
    relatedLessonUrl: z.string(),
    sourceSlug: z.string().optional(),
    sourceRelatedLessonUrl: z.string().optional(),
    difficulty: z.string(),
    estimatedTime: z.string(),
    audience: z.string(),
    sourceDriveUrl: z.string(),
    format: z.string(),
    questionCount: z.number().int().positive(),
    learningObjective: z.array(z.string()),
    conceptsTested: z.array(z.string()),
    frameworkNote: z.string(),
    questions: z.array(z.object({
      number: z.number().int().positive(),
      difficulty: z.string(),
      skillTested: z.string(),
      type: z.enum(['multiple-choice', 'true-false']),
      question: z.string(),
      options: z.array(z.object({ key: z.string(), text: z.string() })),
      correctAnswer: z.string(),
      explanation: z.string(),
      wrongAnswerNotes: z.array(z.string()).optional(),
      sourceReference: z.string(),
    })),
    practicalApplications: z.array(z.object({
      title: z.string(),
      scenario: z.string(),
      bestInterpretation: z.string(),
      benchmarkThatMatters: z.array(z.string()),
      likelyDominantDriver: z.string(),
      secondSignalToValidate: z.array(z.string()),
      mistakeToAvoid: z.string(),
    })),
    commonMistakeCheckpoint: z.string().optional(),
    answerKey: z.array(z.object({
      question: z.number().int().positive(),
      correctAnswer: z.string(),
      conceptTested: z.string(),
      difficulty: z.string(),
    })),
    scoreInterpretation: z.array(z.object({ range: z.string(), meaning: z.string() })),
    followUpReadingPath: z.array(z.string()),
    complianceNote: z.string(),
    status: z.string(),
    version: z.string(),
  }),
});

export const collections = {
  pages,
  products,
  frameworks,
  leadMagnets,
  benchmarkModules,
  glossary,
  news,
  ...(hasCatalystBriefFiles ? { catalystBriefs } : {}),
  weeklyReports,
  ...(hasMonthlyReportFiles ? { monthlyReports } : {}),
  quizzes,
};
