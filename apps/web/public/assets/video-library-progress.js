(() => {
  const status = document.getElementById('library-progress-status');

  const applyProgress = (row) => {
    if (!row || typeof row.content_id !== 'string') return;
    const slug = row.content_id.replace(/^video:/, '');
    const card = document.querySelector(`[data-video-slug="${CSS.escape(slug)}"]`);
    if (!card) return;
    const percent = Math.max(0, Math.min(100, Number(row.progress_percent) || 0));
    const label = card.querySelector('[data-progress-label]');
    const bar = card.querySelector('[data-progress-bar]');
    card.dataset.progressStatus = row.status || 'started';
    if (bar) bar.style.width = `${percent}%`;
    if (label) {
      label.textContent = row.status === 'completed'
        ? 'Completed'
        : percent > 0
          ? `${percent}% complete`
          : 'Started';
    }
  };

  fetch('/api/video-progress', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('Progress unavailable');
      return response.json();
    })
    .then((payload) => {
      const rows = Array.isArray(payload.progress) ? payload.progress : [];
      rows.forEach(applyProgress);
      const completed = rows.filter((row) => row.status === 'completed').length;
      if (status) status.textContent = completed
        ? `${completed} of 51 films completed.`
        : 'Your viewing progress will be saved automatically.';
    })
    .catch(() => {
      if (status) status.textContent = 'The library is ready. Progress sync will retry when you open a film.';
    });
})();
