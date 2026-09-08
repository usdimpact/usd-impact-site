(() => {
  const supportsWebAuthn = () => Boolean(
    window.isSecureContext
    && 'PublicKeyCredential' in window
    && navigator.credentials
    && typeof navigator.credentials.create === 'function'
    && typeof navigator.credentials.get === 'function'
  );

  const supportsConditionalMediation = async () => {
    if (!supportsWebAuthn()) return false;
    if (typeof PublicKeyCredential.isConditionalMediationAvailable !== 'function') return false;
    try {
      return await PublicKeyCredential.isConditionalMediationAvailable();
    } catch {
      return false;
    }
  };

  const base64UrlToBytes = (value) => {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
    const binary = atob(normalized + padding);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  };

  const bytesToBase64Url = (value) => {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  const parseCreationOptions = (options) => {
    if (!options || typeof options !== 'object') throw new Error('Passkey registration options are invalid.');
    if (typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function') {
      return PublicKeyCredential.parseCreationOptionsFromJSON(options);
    }
    const result = {
      ...options,
      challenge: base64UrlToBytes(options.challenge).buffer,
      user: {
        ...options.user,
        id: base64UrlToBytes(options.user?.id).buffer,
      },
    };
    if (Array.isArray(options.excludeCredentials)) {
      result.excludeCredentials = options.excludeCredentials.map((credential) => ({
        ...credential,
        id: base64UrlToBytes(credential.id).buffer,
        type: credential.type || 'public-key',
      }));
    }
    return result;
  };

  const parseRequestOptions = (options) => {
    if (!options || typeof options !== 'object') throw new Error('Passkey authentication options are invalid.');
    if (typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function') {
      return PublicKeyCredential.parseRequestOptionsFromJSON(options);
    }
    const result = {
      ...options,
      challenge: base64UrlToBytes(options.challenge).buffer,
    };
    if (Array.isArray(options.allowCredentials)) {
      result.allowCredentials = options.allowCredentials.map((credential) => ({
        ...credential,
        id: base64UrlToBytes(credential.id).buffer,
        type: credential.type || 'public-key',
      }));
    }
    return result;
  };

  const serializeCredential = (credential) => {
    if (!credential || typeof credential !== 'object') throw new Error('Passkey credential is missing.');
    if (typeof credential.toJSON === 'function') return credential.toJSON();

    const response = credential.response;
    const common = {
      id: credential.id,
      rawId: credential.id,
      type: 'public-key',
      clientExtensionResults: typeof credential.getClientExtensionResults === 'function'
        ? credential.getClientExtensionResults()
        : {},
      ...(credential.authenticatorAttachment ? { authenticatorAttachment: credential.authenticatorAttachment } : {}),
    };

    if (response && 'attestationObject' in response) {
      return {
        ...common,
        response: {
          attestationObject: bytesToBase64Url(response.attestationObject),
          clientDataJSON: bytesToBase64Url(response.clientDataJSON),
        },
      };
    }

    if (response && 'authenticatorData' in response) {
      return {
        ...common,
        response: {
          authenticatorData: bytesToBase64Url(response.authenticatorData),
          clientDataJSON: bytesToBase64Url(response.clientDataJSON),
          signature: bytesToBase64Url(response.signature),
          ...(response.userHandle ? { userHandle: bytesToBase64Url(response.userHandle) } : {}),
        },
      };
    }

    throw new Error('The browser returned an unsupported passkey credential.');
  };

  const create = async (options) => {
    if (!supportsWebAuthn()) throw new Error('Passkeys are not supported in this browser or context.');
    const credential = await navigator.credentials.create({ publicKey: parseCreationOptions(options) });
    if (!credential) throw new Error('Passkey registration was cancelled.');
    return serializeCredential(credential);
  };

  const get = async (options, requestOptions = {}) => {
    if (!supportsWebAuthn()) throw new Error('Passkeys are not supported in this browser or context.');
    const credential = await navigator.credentials.get({
      publicKey: parseRequestOptions(options),
      ...(requestOptions.mediation ? { mediation: requestOptions.mediation } : {}),
      ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
    });
    if (!credential) throw new Error('Passkey sign-in was cancelled.');
    return serializeCredential(credential);
  };

  const safeNextPath = (value) => {
    const next = String(value || '').trim();
    if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\') || next.length > 512) return '/account/';
    try {
      const parsed = new URL(next, window.location.origin);
      if (parsed.origin !== window.location.origin) return '/account/';
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return '/account/';
    }
  };

  const restoreCheckoutReturnFromReferrer = () => {
    if (window.location.pathname !== '/account/sign-in/') return false;
    const nextInput = document.getElementById('account-next');
    if (!(nextInput instanceof HTMLInputElement)) return false;

    try {
      const referrer = new URL(document.referrer || '', window.location.origin);
      if (referrer.origin !== window.location.origin || referrer.pathname !== '/checkout/') return false;
      const current = new URL(window.location.href);
      const requestedNext = current.searchParams.get('next');
      if (requestedNext && requestedNext !== '/account/') return false;

      nextInput.value = `${referrer.pathname}${referrer.search}`;
      const status = document.getElementById('sign-in-status');
      if (status instanceof HTMLElement && !status.textContent?.trim()) {
        status.textContent = 'Sign in to continue your Library Pass checkout. After verification, you will return to checkout automatically.';
        status.dataset.state = 'pending';
      }
      return true;
    } catch {
      return false;
    }
  };

  const readTurnstileToken = () => String(
    document.querySelector('input[name="cf-turnstile-response"]')?.value || ''
  ).trim();

  const resetTurnstile = () => {
    const container = document.getElementById('account-turnstile');
    if (!container || !window.turnstile?.reset) return;
    try {
      window.turnstile.reset('#account-turnstile');
    } catch {
      // The widget can recover independently; email remains available.
    }
  };

  const waitForTurnstileToken = async (signal) => {
    if (!document.getElementById('account-turnstile')) return '';
    while (!signal?.aborted) {
      const token = readTurnstileToken();
      if (token) return token;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    throw new DOMException('Passkey request cancelled.', 'AbortError');
  };

  const openEmailFallback = ({ focus = false } = {}) => {
    const emailAlternative = document.getElementById('email-sign-in-alternative');
    const emailInput = document.getElementById('account-email');
    if (emailAlternative instanceof HTMLDetailsElement) emailAlternative.open = true;
    if (emailInput instanceof HTMLInputElement) {
      emailInput.setAttribute('autocomplete', 'email webauthn');
      if (focus) {
        try {
          emailInput.focus({ preventScroll: true });
        } catch {
          emailInput.focus();
        }
      }
    }
  };

  const startConditionalSignIn = async () => {
    if (window.location.pathname !== '/account/sign-in/') return;

    const emailInput = document.getElementById('account-email');
    const passkeyButton = document.getElementById('passkey-sign-in-button');
    const passkeyHelp = document.getElementById('passkey-sign-in-help');
    const form = document.getElementById('passwordless-sign-in');
    const nextInput = document.getElementById('account-next');
    const rememberDeviceInput = document.getElementById('remember-device');
    const status = document.getElementById('sign-in-status');
    if (!(emailInput instanceof HTMLInputElement)) return;

    openEmailFallback();

    const controller = new AbortController();
    const stopConditionalRequest = () => {
      if (!controller.signal.aborted) controller.abort();
    };

    passkeyButton?.addEventListener('click', stopConditionalRequest, { capture: true, once: true });
    form?.addEventListener('submit', stopConditionalRequest, { capture: true, once: true });
    window.addEventListener('pagehide', stopConditionalRequest, { once: true });

    try {
      const statusResponse = await fetch('/api/account?action=passkey&op=status', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });
      const statusBody = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok || statusBody.enabled !== true || !supportsWebAuthn()) {
        openEmailFallback({ focus: true });
        return;
      }

      if (!(await supportsConditionalMediation())) {
        openEmailFallback();
        if (passkeyHelp) {
          passkeyHelp.textContent = 'Use your saved passkey, or continue with email below.';
        }
        return;
      }

      if (passkeyHelp) {
        passkeyHelp.textContent = 'A saved passkey can appear automatically. You can also continue with email below.';
      }

      const captchaToken = await waitForTurnstileToken(controller.signal);
      const optionsResponse = await fetch('/api/account?action=passkey&op=authentication-options', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(captchaToken ? { 'X-Turnstile-Token': captchaToken } : {}),
        },
        body: '{}',
        signal: controller.signal,
      });
      const optionsBody = await optionsResponse.json().catch(() => ({}));
      resetTurnstile();
      if (!optionsResponse.ok) {
        openEmailFallback({ focus: true });
        return;
      }

      const credential = await get(optionsBody.options, {
        mediation: 'conditional',
        signal: controller.signal,
      });

      const verifyResponse = await fetch('/api/account?action=passkey&op=authentication-verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: optionsBody.challengeId,
          credential,
          next: nextInput instanceof HTMLInputElement ? nextInput.value : '/account/',
          rememberDevice: rememberDeviceInput instanceof HTMLInputElement
            ? rememberDeviceInput.checked
            : true,
        }),
        signal: controller.signal,
      });
      const verifyBody = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok) {
        openEmailFallback({ focus: true });
        if (status instanceof HTMLElement) {
          status.dataset.state = 'error';
          status.textContent = 'That passkey could not sign you in. Continue with email below.';
        }
        return;
      }

      if (status instanceof HTMLElement) {
        status.dataset.state = 'success';
        status.textContent = 'Passkey accepted. Continuing…';
      }
      window.location.replace(safeNextPath(
        verifyBody.redirect || (nextInput instanceof HTMLInputElement ? nextInput.value : '/account/')
      ));
    } catch (error) {
      const cancelled = controller.signal.aborted
        || error?.name === 'AbortError'
        || error?.name === 'NotAllowedError';
      openEmailFallback({ focus: !cancelled });
      if (!cancelled && status instanceof HTMLElement && !status.textContent?.includes('checkout')) {
        status.dataset.state = 'error';
        status.textContent = 'Passkey sign-in is unavailable right now. Continue with email below.';
      }
    }
  };

  window.addEventListener('DOMContentLoaded', () => {
    restoreCheckoutReturnFromReferrer();
    void startConditionalSignIn();
  }, { once: true });

  window.USDImpactPasskeys = Object.freeze({
    supported: supportsWebAuthn,
    conditionalSupported: supportsConditionalMediation,
    create,
    get,
  });
})();
