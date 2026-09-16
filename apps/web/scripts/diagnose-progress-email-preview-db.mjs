import { readMarketingEmailPreferences } from '../src/lib/marketing-email-preferences.js';

const QA_BRANCH = 'integration/newsletter-system-convergence';

function firstQaRecipient(environment) {
  const recipients = String(environment.PROGRESS_EMAIL_QA_RECIPIENTS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (recipients.length < 1) throw new Error('Progress QA recipient configuration is unavailable.');
  return recipients[0];
}

export async function diagnoseProgressEmailPreviewDatabase(environment = process.env) {
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  const commitRef = String(environment.VERCEL_GIT_COMMIT_REF ?? '').trim();
  if (vercelEnvironment !== 'preview' || commitRef !== QA_BRANCH) return null;

  try {
    await readMarketingEmailPreferences({
      email: firstQaRecipient(environment),
      environment,
    });
    console.log('Learning Progress Preview database diagnostic: preferences read OK.');
    return Object.freeze({ ok: true });
  } catch (error) {
    const message = String(error?.message ?? '');
    const upstreamStatus = message.match(/status\s+(\d{3})\b/i)?.[1] ?? 'unknown';
    const code = String(error?.code ?? error?.name ?? 'UNKNOWN_ERROR').replace(/[^A-Z0-9_]/gi, '_').slice(0, 80);
    console.error(`Learning Progress Preview database diagnostic: code ${code}; upstream HTTP ${upstreamStatus}.`);
    throw new Error('Learning Progress Preview database diagnostic failed.');
  }
}

await diagnoseProgressEmailPreviewDatabase(process.env);
