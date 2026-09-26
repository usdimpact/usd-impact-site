(() => {
  const script = document.querySelector('script[data-video-slug][data-video-duration]');
  const iframe = document.getElementById('stream-player');
  const label = document.getElementById('video-progress-label');
  const bar = document.getElementById('video-progress-bar');
  const sync = document.getElementById('video-progress-sync');
  const slug = script?.dataset.videoSlug || '';
  const catalogDuration = Number(script?.dataset.videoDuration) || 0;
  let player = null;
  let savedPosition = 0;
  // v2 is a new immutable URL. Keep the legacy asset unchanged for rollback.
  const MIN_SEND_GAP_MS = 1000;
  const REQUEST_TIMEOUT_MS = 8000;
  const MAX_RESPONSE_BYTES = 16384;
  const MAX_FAILURES = 3;
  let lastAttemptAt = -Infinity;
  let lastAttemptPosition = -1;
  let acknowledged = null;
  let latest = null;
  let inFlight = false;
  let forcePending = false;
  let failures = 0;
  let retryNotBefore = 0;
  let timer = null;
  let timerAt = Infinity;
  let blocked = false;
  let leaving = false;
  let exitAttempted = false;
  let ready = false;
  let playbackStarted = false;
  let resumeApplied = false;
  let resumeRequested = false;
  let savedStatus = 'started';

  const updateUi = (position, duration, status = 'in_progress') => {
    const total = duration > 0 ? duration : catalogDuration;
    const percent = status === 'completed' ? 100 : Math.max(0, Math.min(100, Math.round((position / total) * 100) || 0));
    if (bar) bar.style.width = `${percent}%`;
    if (label) label.textContent = status === 'completed' ? 'Completed' : percent ? `${percent}% complete` : 'Not started';
  };

  const applySavedPosition = () => {
    if (resumeApplied) return true;
    if (!player) return false;
    const duration = Number(player.duration) || 0;
    if (!(duration > 0)) return false;
    // The iframe may already be playing when the progress GET/SDK attaches.
    // Only an explicit SDK state (not a seek-generated timeupdate) establishes play.
    if (player.paused === false) playbackStarted = true;
    const shouldResume = savedStatus !== 'completed'
      && savedPosition > 2
      && savedPosition < duration - 3;
    if (!shouldResume) {
      resumeApplied = true;
      updateUi(savedPosition, duration, savedStatus);
      return true;
    }

    const currentPosition = Math.max(0, Number(player.currentTime) || 0);
    if (playbackStarted && resumeRequested && Math.abs(currentPosition - savedPosition) <= 2) {
      resumeApplied = true;
      updateUi(currentPosition, duration, savedStatus);
      return true;
    }

    // Cloudflare Stream can reject an early seek until its iframe is seek-ready.
    // Pre-arm the seek as soon as metadata exists, then retry across readiness and
    // playback events until the SDK reports the saved position back to us.
    player.currentTime = savedPosition;
    resumeRequested = true;
    const requestedPosition = Math.max(0, Number(player.currentTime) || 0);
    if (playbackStarted && Math.abs(requestedPosition - savedPosition) <= 2) {
      resumeApplied = true;
      updateUi(requestedPosition, duration, savedStatus);
      return true;
    }
    updateUi(savedPosition, duration, savedStatus);
    return false;
  };

  const setSync = (state, message) => {
    if (!sync) return;
    sync.dataset.state = state;
    if (sync.textContent !== message) sync.textContent = message;
  };

  const failure = (kind, status = 0, retryAfter = '') => Object.assign(
    new Error('Progress sync unavailable'), { kind, status, retryAfter },
  );

  // Reject malformed acknowledgements; never display server-provided error text.
  const readLimitedJson = async (response) => {
    if (!response.ok) throw failure('http', response.status, response.headers.get('retry-after') || '');
    const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const length = Number(response.headers.get('content-length'));
    if (type !== 'application/json' || length > MAX_RESPONSE_BYTES || !response.body?.getReader) {
      throw failure('protocol');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let text = '';
    try {
      while (true) {
        let chunk;
        try { chunk = await reader.read(); }
        catch { throw failure('transport'); }
        const { done, value } = chunk;
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) throw failure('protocol');
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      return JSON.parse(text);
    } catch (error) {
      void reader.cancel().catch(() => {});
      // Truncated transport is retryable; invalid UTF-8/JSON/size is not.
      throw error?.kind ? error : failure('protocol');
    } finally {
      reader.releaseLock();
    }
  };

  const requestJson = async (url, options = {}) => {
    const controller = new AbortController();
    let timeout;
    const deadline = new Promise((_, reject) => {
      timeout = window.setTimeout(() => {
        controller.abort();
        reject(failure('timeout'));
      }, REQUEST_TIMEOUT_MS);
    });
    try {
      return await Promise.race([
        fetch(url, {
          credentials: 'same-origin', cache: 'no-store', redirect: 'error',
          ...options, signal: controller.signal,
        }).then(readLimitedJson),
        deadline,
      ]);
    } finally {
      window.clearTimeout(timeout);
      controller.abort();
    }
  };

  const checkpoint = (payload, allowNull = false, sent = null) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || !Object.hasOwn(payload, 'progress')) throw failure('protocol');
    const row = payload.progress;
    if (row === null && allowNull) return null;
    if (!row || typeof row !== 'object' || Array.isArray(row)
      || row.content_id !== `video:${slug}`
      || !['started', 'in_progress', 'completed'].includes(row.status)) throw failure('protocol');
    const raw = row.resume_position;
    if (typeof raw !== 'number' && !(typeof raw === 'string' && /^\d+(?:\.\d+)?$/.test(raw))) {
      throw failure('protocol');
    }
    const position = Number(raw);
    if (!Number.isFinite(position) || position < 0 || position > catalogDuration + 0.11) {
      throw failure('protocol');
    }
    if (sent && (Math.abs(position - sent.positionSeconds) > 0.11
      || (sent.status === 'completed' && row.status !== 'completed'))) throw failure('protocol');
    return { positionSeconds: position, status: row.status };
  };

  const sameCheckpoint = (a, b) => !!a && !!b
    && Math.round(a.positionSeconds * 10) === Math.round(b.positionSeconds * 10)
    && (a.status === 'completed') === (b.status === 'completed');

  const clearScheduled = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    timerAt = Infinity;
  };

  const schedule = (at) => {
    if (leaving || blocked || timerAt <= at) return;
    clearScheduled();
    timerAt = at;
    timer = window.setTimeout(() => {
      timer = null;
      timerAt = Infinity;
      void flush();
    }, Math.max(0, at - Date.now()));
  };

  const retryDelay = (error) => {
    let providerWait = 0;
    if (error.retryAfter) {
      const value = error.retryAfter.trim();
      if (/^\d+$/.test(value)) {
        providerWait = Number(value) * 1000;
      } else {
        // Conservative automatic retry: only canonical IMF-fixdate is accepted.
        // Legacy/unsupported dates require reload rather than guessing an early retry.
        const httpDate = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;
        if (!httpDate.test(value)) return null;
        const timestamp = Date.parse(value);
        if (!Number.isFinite(timestamp) || new Date(timestamp).toUTCString() !== value) return null;
        providerWait = timestamp - Date.now();
      }
      if (!Number.isFinite(providerWait) || providerWait > 60000) return null;
    }
    return Math.max(0, providerWait, 2000 * (2 ** (failures - 1)) + Math.floor(Math.random() * 501));
  };

  const flush = async (onExit = false) => {
    if (blocked || inFlight || !latest || (leaving && !onExit) || (onExit && exitAttempted)) return;
    // A failed/ambiguous write may have changed remote state after the last ACK.
    // Reassert the latest intent even when it returns to that old checkpoint.
    if (failures === 0 && sameCheckpoint(latest, acknowledged)) { forcePending = false; return; }
    const now = Date.now();
    // Preserve the existing periodic cadence; forced events cannot bypass the
    // one-second global send gap, a retry wait, or the single-flight queue.
    if (!forcePending && now - lastAttemptAt < 15000
      && Math.abs(latest.positionSeconds - lastAttemptPosition) < 12) return;
    const notBefore = Math.max(lastAttemptAt + MIN_SEND_GAP_MS, retryNotBefore);
    if (now < notBefore) { if (!onExit) schedule(notBefore); return; }
    clearScheduled();
    const sent = { ...latest };
    inFlight = true;
    forcePending = false;
    lastAttemptAt = now;
    lastAttemptPosition = sent.positionSeconds;
    if (onExit) exitAttempted = true;
    setSync(onExit ? 'unconfirmed' : 'saving', onExit
      ? 'Final save is best effort; recent progress may not be saved.' : 'Saving progress...');
    try {
      const payload = await requestJson('/api/video-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(sent), keepalive: onExit,
      });
      const confirmed = checkpoint(payload, false, sent);
      if (leaving || blocked) return;
      acknowledged = confirmed;
      failures = 0;
      retryNotBefore = 0;
      if (confirmed.status === 'completed') {
        savedStatus = 'completed';
        latest = { ...latest, status: 'completed' };
      }
      const minutes = Math.floor(confirmed.positionSeconds / 60);
      const seconds = Math.floor(confirmed.positionSeconds % 60).toString().padStart(2, '0');
      setSync('saved', `Last confirmed save: ${minutes}:${seconds}.`);
    } catch (error) {
      if (leaving || blocked) return;
      failures += 1;
      const accessDenied = error.status === 401 || error.status === 403;
      const transient = !error.kind || error.kind === 'timeout' || error.kind === 'transport'
        || error.status === 408 || error.status === 429 || error.status >= 500;
      const delay = transient && failures < MAX_FAILURES ? retryDelay(error) : null;
      blocked = delay === null;
      if (blocked) {
        clearScheduled();
        setSync(accessDenied ? 'access-required' : 'unavailable', accessDenied
          ? 'Progress sync needs sign-in or active access. Reload after checking your account.'
          : 'Progress could not be confirmed. Playback can continue; reload to retry syncing.');
      } else {
        retryNotBefore = Date.now() + delay;
        forcePending = true;
        setSync('retrying', 'Progress sync is unavailable. A limited retry is pending; playback can continue.');
      }
    } finally {
      inFlight = false;
      if (!leaving && !blocked) void flush();
    }
  };

  const save = (status, force = false, onExit = false) => {
    if (!player || !slug) return;
    const position = Number(player.currentTime);
    if (!Number.isFinite(position) || position < 0 || !(catalogDuration > 0)) return;
    if (status === 'completed') savedStatus = 'completed';
    const positionSeconds = Math.min(position, catalogDuration);
    const effectiveStatus = savedStatus === 'completed' ? 'completed'
      : positionSeconds > 0 ? 'in_progress' : 'started';
    updateUi(positionSeconds, catalogDuration, effectiveStatus);
    // Keep only the latest intent in memory. A backward seek is valid: do not
    // replace this with max(position). No cross-tab/account persistence is added.
    latest = { slug, positionSeconds, durationSeconds: catalogDuration, status: effectiveStatus };
    forcePending ||= force;
    void flush(onExit);
  };

  const loadProgress = async () => {
    try {
      const payload = await requestJson(`/api/video-progress?slug=${encodeURIComponent(slug)}`, {
        headers: { Accept: 'application/json' },
      });
      const row = checkpoint(payload, true);
      if (leaving || blocked) return;
      acknowledged = row;
      savedPosition = row?.positionSeconds || 0;
      savedStatus = row?.status || 'started';
      updateUi(savedPosition, catalogDuration, savedStatus);
      setSync('ready', row ? 'Saved progress loaded.' : 'No saved progress yet.');
    } catch {
      // Do not overwrite an unknown saved resume point after a failed read.
      blocked = true;
      setSync('unavailable', 'Saved progress could not be loaded. Playback can continue; reload to enable syncing.');
    }
  };

  const attach = () => {
    if (ready || !iframe || typeof window.Stream !== 'function') return false;
    ready = true;
    player = window.Stream(iframe);
    player.addEventListener('loadedmetadata', applySavedPosition);
    player.addEventListener('durationchange', applySavedPosition);
    player.addEventListener('canplay', applySavedPosition);
    player.addEventListener('loadeddata', applySavedPosition);
    player.addEventListener('play', () => {
      playbackStarted = true;
      if (applySavedPosition()) save('started', true);
    });
    player.addEventListener('playing', () => {
      playbackStarted = true;
      if (applySavedPosition()) save('started', true);
    });
    player.addEventListener('timeupdate', () => { if (applySavedPosition()) save('in_progress'); });
    player.addEventListener('pause', () => { if (applySavedPosition()) save('in_progress', true); });
    player.addEventListener('ended', () => {
      savedStatus = 'completed';
      resumeApplied = true;
      save('completed', true);
    });
    applySavedPosition();
    return true;
  };

  window.addEventListener('pagehide', () => {
    if (leaving) return;
    leaving = true;
    clearScheduled();
    setSync('unconfirmed', 'Final save is best effort; recent progress may not be saved.');
    if (applySavedPosition()) save('in_progress', true, true);
  });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    // A restored page may outlive a sign-out/account change. Revalidate on reload.
    blocked = true;
    leaving = false;
    clearScheduled();
    setSync('unavailable', 'Reload to revalidate progress syncing after returning to this page.');
  });

  loadProgress().finally(() => {
    if (leaving) return;
    if (attach()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attach() || attempts >= 40) window.clearInterval(timer);
    }, 250);
  });
})();
