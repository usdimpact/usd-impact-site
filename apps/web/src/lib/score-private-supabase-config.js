// Isolate the Score handoff's Development-only privileged key from unrelated
// Preview variables. The existing shared SUPABASE_SECRET_KEY must not be
// overwritten: other Preview branches may depend on it.
import { readSupabaseServerConfig } from './supabase-server.js';

export const SCORE_HANDOFF_PREVIEW_BRANCH = 'feat/score-membership-handoff-147';

export function readScorePrivateSupabaseConfig(environment = process.env) {
  if (environment?.VERCEL_ENV === 'preview' &&
      environment?.VERCEL_GIT_COMMIT_REF === SCORE_HANDOFF_PREVIEW_BRANCH) {
    // Deliberately DO NOT fall back to the global Preview SUPABASE_SECRET_KEY.
    // A missing, malformed or wrong-provider dedicated key must fail closed.
    return readSupabaseServerConfig({
      ...environment,
      SUPABASE_SECRET_KEY: environment.SCORE_PREVIEW_SUPABASE_SECRET_KEY,
    }, { requireSecret: true });
  }
  // Existing Production and non-Score behavior stays unchanged. These Score
  // endpoints are still protected by their separate disabled-by-default flags.
  return readSupabaseServerConfig(environment, { requireSecret: true });
}
