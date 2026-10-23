import { createHash } from 'node:crypto';
import fs from 'node:fs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function buildMethodologyIntegrityCertificate({
  methodologySource,
  repositoryCommit = process.env.GITHUB_SHA || null,
  generatedAt = null,
} = {}) {
  if (typeof methodologySource !== 'string' || !methodologySource.length) {
    throw new Error('methodologySource is required');
  }

  const specification = {
    score_version: 'v2',
    status: 'descriptive_non_predictive',
    production_start_date: '2015-01-01',
    normalization: 'full_sample',
    sample_std_ddof: 1,
    clipping: 3.5,
    absolute_weight_each: 0.125,
    signed_components: {
      DXY: 1,
      WTI: -1,
      SPX: -1,
      VIX: 1,
      BTC: -1,
      GOLD: -1,
      UST2Y: 1,
      UST10Y: 1,
    },
    thresholds: {
      strong_dollar_min: 1.0,
      firm_dollar_min: 0.3,
      soft_dollar_max: -0.3,
      weak_dollar_max: -1.0,
    },
  };

  const specificationHash = sha256(JSON.stringify(specification));
  const methodologySourceHash = sha256(methodologySource);

  return {
    certificate_type: 'usd-impact-methodology-integrity-shadow',
    certificate_version: 1,
    mode: 'shadow_non_production',
    generated_at: generatedAt,
    repository_commit: repositoryCommit,
    methodology_source_sha256: methodologySourceHash,
    specification_sha256: specificationHash,
    specification,
    invariants: {
      changes_production_score: false,
      changes_published_history: false,
      changes_methodology: false,
      authorizes_promotion: false,
    },
    certificate_sha256: sha256(JSON.stringify({
      certificate_version: 1,
      repository_commit: repositoryCommit,
      methodology_source_sha256: methodologySourceHash,
      specification_sha256: specificationHash,
    })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const source = fs.readFileSync(new URL('../apps/web/src/pages/score/methodology.astro', import.meta.url), 'utf8');
  const certificate = buildMethodologyIntegrityCertificate({ methodologySource: source });
  process.stdout.write(JSON.stringify(certificate, null, 2) + '\n');
}
