const RESEND_API = 'https://api.resend.com';
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requestHeader(request, name) {
  const headers = request.headers ?? {};
  if (typeof headers.get === 'function') return headers.get(name) ?? '';

  const value = headers[name.toLowerCase()] ?? headers[name];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function sendJson(response, body, status = 200, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');

  for (const [name, value] of Object.entries(extraHeaders)) {
    response.setHeader(name, value);
  }

  response.end(JSON.stringify(body));
}

function requestBody(request) {
  const body = request.body;

  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    return body;
  }

  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    return JSON.parse(body.toString());
  }

  throw new TypeError('Request body is missing or invalid.');
}

async function resendRequest(path, apiKey, options = {}) {
  return fetch(`${RESEND_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, { error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  }

  if (requestHeader(request, 'sec-fetch-site') === 'cross-site') {
    return sendJson(response, { error: 'Cross-site submissions are not allowed.' }, 403);
  }

  const contentType = requestHeader(request, 'content-type');
  if (!contentType.includes('application/json')) {
    return sendJson(response, { error: 'Content type must be application/json.' }, 415);
  }

  let payload;
  try {
    payload = requestBody(request);
  } catch {
    return sendJson(response, { error: 'Invalid request body.' }, 400);
  }

  const email = normalizeEmail(payload.email);
  const consent = payload.consent === true;
  const company = String(payload.company ?? '').trim();

  // Honeypot submissions receive a neutral success response.
  if (company) {
    return sendJson(response, { ok: true });
  }

  if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    return sendJson(response, { error: 'Enter a valid email address.' }, 400);
  }

  if (!consent) {
    return sendJson(response, { error: 'Consent is required to join the waitlist.' }, 400);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const segmentId = process.env.RESEND_WAITLIST_SEGMENT_ID;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO;

  if (!apiKey || !segmentId || !fromEmail) {
    console.error('Waitlist configuration is incomplete.');
    return sendJson(response, { error: 'The waitlist is temporarily unavailable. Please try again later.' }, 503);
  }

  let contactResponse;
  try {
    contactResponse = await resendRequest('/contacts', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        email,
        unsubscribed: false,
        segments: [{ id: segmentId }],
      }),
    });
  } catch (error) {
    console.error(`Waitlist contact request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return sendJson(response, { error: 'The waitlist is temporarily unavailable. Please try again later.' }, 502);
  }

  if (contactResponse.status === 409) {
    let segmentResponse;
    try {
      segmentResponse = await resendRequest(
        `/contacts/${encodeURIComponent(email)}/segments/${encodeURIComponent(segmentId)}`,
        apiKey,
        { method: 'POST' },
      );
    } catch (error) {
      console.error(`Waitlist segment request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return sendJson(response, { error: 'The waitlist is temporarily unavailable. Please try again later.' }, 502);
    }

    if (!segmentResponse.ok && segmentResponse.status !== 409) {
      console.error(`Waitlist segment assignment failed with status ${segmentResponse.status}.`);
      return sendJson(response, { error: 'The waitlist is temporarily unavailable. Please try again later.' }, 502);
    }
  } else if (!contactResponse.ok) {
    console.error(`Waitlist contact creation failed with status ${contactResponse.status}.`);
    return sendJson(response, { error: 'The waitlist is temporarily unavailable. Please try again later.' }, 502);
  }

  let confirmationResponse;
  try {
    confirmationResponse = await resendRequest('/emails', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: "You're on the Read the Dollar First waitlist",
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#161a1f;max-width:620px;margin:0 auto;padding:24px;">
            <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#8a6b32;font-weight:700;">USD Impact</p>
            <h1 style="font-size:30px;line-height:1.15;color:#071a33;">You’re on the waitlist.</h1>
            <p>Thank you for joining the waitlist for <strong><em>Read the Dollar First</em></strong>.</p>
            <p>We will email the purchase link when the book becomes available.</p>
            <p style="font-size:13px;color:#5a6472;margin-top:28px;">Educational product information only. This is not investment, legal, tax, trading, or financial advice.</p>
          </div>
        `,
      }),
    });
  } catch (error) {
    console.error(`Waitlist confirmation request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return sendJson(response, { error: 'Your address was saved, but the confirmation email could not be sent. Please try again later.' }, 502);
  }

  if (!confirmationResponse.ok) {
    console.error(`Waitlist confirmation email failed with status ${confirmationResponse.status}.`);
    return sendJson(response, { error: 'Your address was saved, but the confirmation email could not be sent. Please try again later.' }, 502);
  }

  return sendJson(response, { ok: true });
}
