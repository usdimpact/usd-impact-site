(() => {
  const form = document.getElementById('passwordless-sign-in');
  if (!form) return;
  const status = document.getElementById('sign-in-status');
  let checking = false;

  // Never send an existing session back through sign-in, auth callbacks, or APIs.
  const safeDestination = (value) => {
    const next = String(value || '').trim();
    if (!next.startsWith('/') || next.startsWith('//') || next.length > 512 || /[\\\x00-\x1f\x7f]/.test(next)) return '/account/';
    try {
      const url = new URL(next, window.location.origin);
      let path = url.pathname;
      for (let pass = 0; pass < 3; pass += 1) {
        const decoded = decodeURIComponent(path);
        if (decoded === path) break;
        path = decoded;
      }
      if (/[\\\x00-\x1f\x7f]/.test(path) || path.startsWith('//')) return '/account/';
      const normalized = new URL(path, window.location.origin);
      if (normalized.origin !== window.location.origin) return '/account/';
      path = normalized.pathname;
      if (url.origin !== window.location.origin || /[\\\x00-\x1f\x7f]/.test(path) || path.startsWith('//') || /^\/(?:auth|api)(?:\/|$)/i.test(path) || /^\/account\/sign-in(?:\/|$)/i.test(path)) return '/account/';
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return '/account/';
    }
  };

  // Capture before the existing form handlers: checking must not send another email.
  const blockWhileChecking = (event) => {
    if (checking && form.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  document.addEventListener('submit', blockWhileChecking, true);
  document.addEventListener('click', blockWhileChecking, true);

  const checkExistingSession = async () => {
    if (checking) return;
    checking = true;
    form.inert = true;
    form.setAttribute('aria-busy', 'true');
    if (status) {
      status.dataset.state = 'pending';
      status.textContent = 'Checking your existing sign-in...';
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    let continuing = false;
    try {
      // This endpoint validates/refreshes HttpOnly cookies on the server.
      // No token, account claim, or entitlement is trusted from browser storage.
      const response = await fetch('/api/account-access', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.status === 401) {
        if (status) { status.textContent = ''; status.dataset.state = ''; }
        return;
      }
      const body = await response.json();
      if (!response.ok || typeof body?.account?.id !== 'string' || !body.account.id || typeof body?.paidAccess?.allowed !== 'boolean') throw new Error('SESSION_CHECK_UNAVAILABLE');
      const requested = new URLSearchParams(window.location.search).get('next');
      const destination = body.account.status === 'active' ? safeDestination(requested) : '/account/';
      if (status) {
        status.dataset.state = 'success';
        status.textContent = 'You are already signed in. Continuing...';
      }
      // A signed-in unpaid account also continues: the destination enforces access.
      // Authentication must not be confused with entitlement eligibility.
      window.location.replace(destination);
      continuing = true;
    } catch {
      if (status) {
        status.dataset.state = 'error';
        status.textContent = 'Your existing sign-in could not be checked. Reload to retry, or use a sign-in option below.';
      }
    } finally {
      window.clearTimeout(timeout);
      if (!continuing) {
        checking = false;
        form.inert = false;
        form.removeAttribute('aria-busy');
      }
    }
  };
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) { checking = false; void checkExistingSession(); }
  });
  void checkExistingSession();
})();
