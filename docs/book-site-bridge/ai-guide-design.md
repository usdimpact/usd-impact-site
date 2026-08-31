# Ask the USD Impact Framework - deferred design

Status: design only. No OpenAI API integration, key, vector store, endpoint, data flow or public assistant is created in Phase 1.

Date: 2026-08-28

## Decision

Do not build an AI guide before the deterministic companion, content registry, version labels, source hierarchy, privacy boundary and evaluation set are approved.

A later guide may explain the framework. It must not operate as a general financial chatbot.

## Approved future corpus

Only versioned and approved material:

- certified book chapters and glossary;
- public Score methodology and version notes;
- chapter/tool registry;
- primary-source registry;
- current dated Daily edition;
- current archived Score vintage;
- current Weekly synthesis;
- approved video transcripts.

Every retrieved item must carry source type, date, edition or methodology version, chapter/tool IDs and access classification.

## Required response structure

1. Framework concept.
2. Current evidence with date and source.
3. Active transmission channel.
4. Evidence supporting the reading.
5. Evidence challenging the reading.
6. Relevant book chapter.
7. Relevant site tool.
8. Educational limitation.

## Mandatory behavior

- Separate durable framework statements from current evidence.
- Cite the book and current sources.
- Prefer primary institutional sources.
- Treat the Score as descriptive, not predictive.
- Reframe forecast requests into conditions, channels, confirmation and invalidation.
- Refuse personalized entries, exits, targets, position sizes, suitability decisions and guaranteed outcomes.
- Do not retain holdings, objectives or other financial-profile information.
- State when evidence is stale, mixed, absent or outside the corpus.

## Technical boundary

A later prototype should be server-side, behind a disabled Production feature flag, and isolated from public activation. It requires:

- a separate OpenAI project and least-privilege key;
- explicit logging and retention decisions;
- a documented privacy/data-flow update;
- rate and cost limits;
- grounded retrieval only;
- deterministic citation validation;
- an evaluation suite for advice leakage, stale-data mixing and unsupported claims;
- Preview/internal access before any public test.

## Minimum evaluation set

Include tests for:

- DXY versus broad USD divergence;
- oil supply shock overriding the dollar overlay;
- gold real-yield and confidence-channel conflict;
- Bitcoin short-run liquidity versus long-run thesis;
- gas regional infrastructure overriding a global shortcut;
- FX pair-specific versus broad-dollar interpretation;
- Score methodology/version mismatch;
- requests for a trade, target, forecast, allocation or personalized recommendation;
- a question whose current evidence is unavailable or stale.

No API key setup is required for the approved Phase 0-1 work.
