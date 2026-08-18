(() => {
  const script = document.querySelector('script[data-video-slug][data-video-duration]');
  const iframe = document.getElementById('stream-player');
  const label = document.getElementById('video-progress-label');
  const bar = document.getElementById('video-progress-bar');
  const slug = script?.dataset.videoSlug || '';
  const catalogDuration = Number(script?.dataset.videoDuration) || 0;
  let player = null;
  let savedPosition = 0;
  let lastSavedPosition = -1;
  let lastSaveAt = 0;
  let ready = false;
  let savedStatus = 'started';

  const updateUi = (position, duration, status = 'in_progress') => {
    const total = duration > 0 ? duration : catalogDuration;
    const percent = status === 'completed' ? 100 : Math.max(0, Math.min(100, Math.round((position / total) * 100) || 0));
    if (bar) bar.style.width = `${percent}%`;
    if (label) label.textContent = status === 'completed' ? 'Completed' : percent ? `${percent}% complete` : 'Not started';
  };

  const save = async (status, force = false, keepalive = false) => {
    if (!player || !slug) return;
    const positionSeconds = Math.max(0, Number(player.currentTime) || 0);
    const durationSeconds = Math.max(catalogDuration, Number(player.duration) || 0);
    const now = Date.now();
    if (!force && now - lastSaveAt < 15000 && Math.abs(positionSeconds - lastSavedPosition) < 12) return;
    lastSaveAt = now;
    lastSavedPosition = positionSeconds;
    const effectiveStatus = savedStatus === 'completed' ? 'completed' : status;
    if (effectiveStatus === 'completed') savedStatus = 'completed';
    updateUi(positionSeconds, durationSeconds, effectiveStatus);
    try {
      await fetch('/api/video-progress', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ slug, positionSeconds, durationSeconds, status: effectiveStatus }),
        cache: 'no-store',
        keepalive,
      });
    } catch {
      // Playback must remain available when progress sync is temporarily unavailable.
    }
  };

  const loadProgress = async () => {
    try {
      const response = await fetch(`/api/video-progress?slug=${encodeURIComponent(slug)}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Progress unavailable');
      const payload = await response.json();
      const row = payload.progress || null;
      savedPosition = Math.max(0, Number(row?.resume_position) || 0);
      savedStatus = row?.status || 'started';
      updateUi(savedPosition, catalogDuration, savedStatus);
    } catch {
      if (label) label.textContent = 'Progress sync unavailable';
    }
  };

  const attach = () => {
    if (ready || !iframe || typeof window.Stream !== 'function') return false;
    ready = true;
    player = window.Stream(iframe);
    player.addEventListener('loadedmetadata', () => {
      const duration = Number(player.duration) || catalogDuration;
      if (savedPosition > 2 && savedPosition < duration - 3) player.currentTime = savedPosition;
      updateUi(savedPosition, duration, savedStatus);
    });
    player.addEventListener('play', () => save('started', true));
    player.addEventListener('timeupdate', () => save('in_progress'));
    player.addEventListener('pause', () => save('in_progress', true));
    player.addEventListener('ended', () => { savedStatus = 'completed'; save('completed', true); });
    window.addEventListener('pagehide', () => save('in_progress', true, true));
    return true;
  };

  loadProgress().finally(() => {
    if (attach()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attach() || attempts >= 40) window.clearInterval(timer);
    }, 250);
  });
})();
