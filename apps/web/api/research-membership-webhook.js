import { requestHeader, sendJson } from '../src/lib/supabase-server.js';
import {
  processResearchMembershipWebhook,
  publicResearchMembershipWebhookError,
} from '../src/lib/research-membership-webhook-handler.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BODY_BYTES = 1024 * 1024;

async function readRawBody(request) {
  if (!request || typeof request[Symbol.asyncIterator] !== 'function') return Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new Error('REQUEST_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export default async function handler(request, response) {
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }
  if (!requestHeader(request, 'content-type').toLowerCase().includes('application/json')) {
    return sendJson(response, 415, { error: 'Content type must be application/json.', code: 'INVALID_CONTENT_TYPE' });
  }

  try {
    const rawBody = await readRawBody(request);
    const signature = requestHeader(request, 'x-signature');
    const result = await processResearchMembershipWebhook({ rawBody, signature });
    return sendJson(response, 200, { ok: true, ...result });
  } catch (error) {
    if (error?.message === 'REQUEST_BODY_TOO_LARGE') {
      return sendJson(response, 413, { error: 'Request body is too large.', code: 'REQUEST_BODY_TOO_LARGE' });
    }
    const safe = publicResearchMembershipWebhookError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}
