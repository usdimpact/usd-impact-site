const PREVIEW_HOST_SUFFIX = '.vercel.app';

export class VercelProtectedPreviewFetchError extends Error {
  constructor(message, code = 'VERCEL_PROTECTED_PREVIEW_FETCH_INVALID') {
    super(message);
    this.name = 'VercelProtectedPreviewFetchError';
    this.code = code;
  }
}

function expectedPreviewOrigin(environment) {
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  const hostname = String(environment.VERCEL_URL ?? '').trim().toLowerCase();
  if (
    vercelEnvironment !== 'preview'
    || !hostname
    || hostname.includes('/')
    || !hostname.endsWith(PREVIEW_HOST_SUFFIX)
  ) {
    throw new VercelProtectedPreviewFetchError(
      'Protected artifact fetch requires the active Vercel Preview deployment origin.',
      'INVALID_VERCEL_PREVIEW_ORIGIN',
    );
  }
  return `https://${hostname}`;
}

function requireBypassSecret(environment) {
  const secret = String(environment.VERCEL_AUTOMATION_BYPASS_SECRET ?? '').trim();
  if (secret.length < 16 || /[\r\n]/.test(secret)) {
    throw new VercelProtectedPreviewFetchError(
      'VERCEL_AUTOMATION_BYPASS_SECRET is missing or invalid.',
      'VERCEL_AUTOMATION_BYPASS_SECRET_INVALID',
    );
  }
  return secret;
}

export function createVercelProtectedPreviewFetch({
  environment = process.env,
  fetchImpl = fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new VercelProtectedPreviewFetchError('A fetch implementation is required.');
  }

  return async (input, options = {}) => {
    const expectedOrigin = expectedPreviewOrigin(environment);
    const bypassSecret = requireBypassSecret(environment);
    let url;
    try {
      url = new URL(String(input));
    } catch {
      throw new VercelProtectedPreviewFetchError(
        'Protected artifact URL is invalid.',
        'INVALID_PROTECTED_PREVIEW_URL',
      );
    }
    if (
      url.origin !== expectedOrigin
      || url.protocol !== 'https:'
      || url.username
      || url.password
    ) {
      throw new VercelProtectedPreviewFetchError(
        'Protected artifact URL does not match the active Preview deployment.',
        'PROTECTED_PREVIEW_ORIGIN_MISMATCH',
      );
    }

    const headers = new Headers(options.headers || {});
    headers.set('x-vercel-protection-bypass', bypassSecret);
    return fetchImpl(url.toString(), { ...options, headers });
  };
}
