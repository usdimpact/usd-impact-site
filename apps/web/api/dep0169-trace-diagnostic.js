function sendJson(response, body, status = 200) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.end(JSON.stringify(body));
}

function recorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    end(body = '') {
      this.body = String(body);
    },
  };
}

function safeWarning(warning) {
  return {
    code: String(warning?.code ?? ''),
    name: String(warning?.name ?? ''),
    message: String(warning?.message ?? '').slice(0, 1_000),
    stack: String(warning?.stack ?? '').slice(0, 12_000),
  };
}

export const config = { maxDuration: 300 };

export default async function handler(request, response) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return sendJson(response, { error: 'Preview-only diagnostic.' }, 404);
  }
  if (request.method !== 'GET') {
    return sendJson(response, { error: 'Method not allowed.' }, 405);
  }

  const token = String(process.env.NEWSFEED_BEARER_TOKEN ?? '');
  if (!token) {
    return sendJson(response, { error: 'Preview NEWSFEED_BEARER_TOKEN is unavailable.' }, 503);
  }

  const warnings = [];
  const onWarning = (warning) => {
    if (warning?.code === 'DEP0169') warnings.push(safeWarning(warning));
  };
  const previousTrace = process.traceProcessWarnings;
  process.traceProcessWarnings = true;
  process.on('warning', onWarning);

  try {
    const { default: groundedHandler } = await import('./daily-news-grounded-background.js');
    const date = '2026-09-17';
    const innerResponse = recorder();
    const innerRequest = {
      method: 'POST',
      url: `/api/daily-news-grounded-background?date=${date}`,
      query: { date },
      headers: { authorization: `Bearer ${token}` },
    };

    await groundedHandler(innerRequest, innerResponse);
    await new Promise((resolve) => setTimeout(resolve, 250));

    return sendJson(response, {
      diagnostic: 'DEP0169_TRACE_PREVIEW_ONLY',
      invokedRoute: '/api/daily-news-grounded-background',
      invokedMethod: 'POST',
      underlyingStatus: innerResponse.statusCode,
      dep0169Count: warnings.length,
      warnings,
      secretsReturned: false,
    });
  } catch (error) {
    return sendJson(response, {
      diagnostic: 'DEP0169_TRACE_PREVIEW_ONLY',
      error: error instanceof Error ? error.message.slice(0, 1_000) : 'unknown error',
      dep0169Count: warnings.length,
      warnings,
      secretsReturned: false,
    }, 500);
  } finally {
    process.removeListener('warning', onWarning);
    process.traceProcessWarnings = previousTrace;
  }
}
