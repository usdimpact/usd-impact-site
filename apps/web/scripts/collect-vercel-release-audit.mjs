import assert from 'node:assert/strict';

const PROJECT_ID = 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7';
const PROJECT_NAME = 'usd-impact-site';
const TEAM_ID = 'team_1LuMlacGuM198mRjoID4O3Ct';
const API_BASE = 'https://api.vercel.com';
const CHECKOUT_KEY = 'PADDLE_CHECKOUT_ENABLED';

function normalizeTargets(target) {
  if (Array.isArray(target)) return target.map((item) => String(item).toLowerCase());
  if (typeof target === 'string') return [target.toLowerCase()];
  return [];
}

function checkoutStateFromValue(value) {
  if (typeof value === 'boolean') return value ? 'open' : 'closed';
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim().toLowerCase();
  if (['false', '0', 'closed', 'disabled', 'off'].includes(normalized)) return 'closed';
  if (['true', '1', 'open', 'enabled', 'on'].includes(normalized)) return 'open';
  return 'unknown';
}

async function readJson(response, label) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${label} failed with HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
  return response.json();
}

export async function collectVercelReleaseAudit({ token, fetchImpl = fetch, observedAt = new Date().toISOString() }) {
  assert.equal(typeof token, 'string', 'VERCEL_TOKEN is required');
  assert.ok(token.trim().length >= 8, 'VERCEL_TOKEN is required');
  assert.ok(Number.isFinite(Date.parse(observedAt)), 'observedAt must be a valid ISO timestamp');

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const team = `teamId=${encodeURIComponent(TEAM_ID)}`;

  const projectResponse = await fetchImpl(`${API_BASE}/v9/projects/${PROJECT_ID}?${team}`, {
    method: 'GET',
    headers,
  });
  const project = await readJson(projectResponse, 'Vercel project audit');
  assert.equal(project.id, PROJECT_ID, 'Unexpected Vercel project id');
  assert.equal(project.name, PROJECT_NAME, 'Unexpected Vercel project name');

  const envResponse = await fetchImpl(`${API_BASE}/v9/projects/${PROJECT_ID}/env?${team}`, {
    method: 'GET',
    headers,
  });
  const envPayload = await readJson(envResponse, 'Vercel environment audit');
  const envs = Array.isArray(envPayload.envs) ? envPayload.envs : [];
  assert.ok(envs.length > 0, 'Vercel environment audit returned no variables');

  const environmentVariables = [];
  let checkoutFound = false;

  for (const entry of envs) {
    if (!entry || typeof entry.key !== 'string') continue;
    const targets = normalizeTargets(entry.target);
    if (!targets.includes('production')) continue;

    const sanitized = {
      key: entry.key,
      target: targets,
    };

    if (entry.key === CHECKOUT_KEY) {
      checkoutFound = true;
      sanitized.state = checkoutStateFromValue(entry.value);
      assert.equal(sanitized.state, 'closed', 'Production checkout is not proven CLOSED');
    }

    environmentVariables.push(sanitized);
  }

  assert.equal(checkoutFound, true, 'PADDLE_CHECKOUT_ENABLED is missing from Production scope');

  const stamp = observedAt.replace(/[^0-9TZ]/g, '');
  return {
    provider: 'vercel',
    authenticated: true,
    readOnly: true,
    valuesExposed: false,
    source: 'vercel-api',
    observedAt,
    ref: `vercel-api:project-env:${PROJECT_ID}:${stamp}`,
    checkoutRef: `vercel-api:checkout-gate:${PROJECT_ID}:${stamp}`,
    project: {
      id: PROJECT_ID,
      name: PROJECT_NAME,
    },
    environmentVariables,
  };
}

async function main() {
  const snapshot = await collectVercelReleaseAudit({ token: process.env.VERCEL_TOKEN });
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Vercel release audit collector failed: ${error.message}`);
    process.exitCode = 1;
  });
}
