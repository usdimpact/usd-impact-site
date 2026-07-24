# Astro Collection Schema — USD Impact Quizzes

Recommended destination:

```text
src/content/quizzes/en/
```

Recommended Astro content collection schema:

```ts
import { defineCollection, z } from "astro:content";

const quizzes = defineCollection({
  type: "data",
  schema: z.object({
    quizId: z.string(),
    canonicalId: z.string(),
    language: z.string(),
    title: z.string(),
    seoTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    slug: z.string(),
    relatedLessonUrl: z.string(),
    difficulty: z.string(),
    estimatedTime: z.string(),
    audience: z.string(),
    format: z.string(),
    questionCount: z.number(),
    learningObjective: z.array(z.string()),
    conceptsTested: z.array(z.string()),
    frameworkNote: z.string(),
    questions: z.array(z.object({
      number: z.number(),
      difficulty: z.string(),
      skillTested: z.string(),
      type: z.string(),
      question: z.string(),
      options: z.array(z.object({
        key: z.string(),
        text: z.string()
      })).optional(),
      correctAnswer: z.string(),
      explanation: z.string(),
      wrongAnswerNotes: z.array(z.string()).optional(),
      sourceReference: z.string()
    })),
    practicalApplications: z.array(z.object({
      title: z.string(),
      scenario: z.string(),
      bestInterpretation: z.string(),
      benchmarkThatMatters: z.array(z.string()),
      likelyDominantDriver: z.string(),
      secondSignalToValidate: z.array(z.string()),
      mistakeToAvoid: z.string()
    })),
    commonMistakeCheckpoint: z.string(),
    answerKey: z.array(z.object({
      question: z.number(),
      correctAnswer: z.string(),
      conceptTested: z.string(),
      difficulty: z.string()
    })),
    scoreInterpretation: z.array(z.object({
      range: z.string(),
      meaning: z.string()
    })),
    followUpReadingPath: z.array(z.string()),
    complianceNote: z.string(),
    sourceDriveUrl: z.string(),
    status: z.string(),
    version: z.string()
  })
});

export const collections = { quizzes };
```

Implementation rule:
- Do not display sourceDriveUrl publicly unless used in an internal QA/admin view.
- Preserve complianceNote on every quiz page.
- Use canonicalId to connect localized versions later.
