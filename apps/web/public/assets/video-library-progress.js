(() => {
  const status = document.getElementById('library-progress-status');
  const filterLinks = [...document.querySelectorAll('[data-video-filter]')];
  const collectionSections = [...document.querySelectorAll('[data-video-collection]')];
  const resultCount = document.querySelector('[data-video-result-count]');
  const continuePanel = document.querySelector('[data-video-continue]');
  const continueLink = document.querySelector('[data-video-continue-link]');
  const continueTitle = document.querySelector('[data-video-continue-title]');

  const collectionFor = (id) => collectionSections.find((section) => section.dataset.videoCollection === id);
  const currentHash = () => {
    try {
      return decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return '';
    }
  };

  const applyFilter = (requestedId) => {
    const selected = requestedId !== 'all' && collectionFor(requestedId) ? requestedId : 'all';
    collectionSections.forEach((section) => {
      section.hidden = selected !== 'all' && section.dataset.videoCollection !== selected;
    });
    filterLinks.forEach((link) => {
      if (link.dataset.videoFilter === selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (!resultCount) return;
    if (selected === 'all') {
      const total = document.querySelectorAll('[data-video-card]').length;
      resultCount.textContent = `Showing ${total} films across all ${collectionSections.length} collections.`;
      return;
    }
    const section = collectionFor(selected);
    const visible = section?.querySelectorAll('[data-video-card]').length || 0;
    const label = section?.dataset.collectionTitle || 'this collection';
    resultCount.textContent = `Showing ${visible} ${visible === 1 ? 'film' : 'films'} in ${label}.`;
  };

  filterLinks.forEach((link) => {
    link.addEventListener('click', () => applyFilter(link.dataset.videoFilter));
  });
  window.addEventListener('hashchange', () => {
    const id = currentHash();
    applyFilter(id === 'video-library-all' ? 'all' : id);
  });
  const initialId = currentHash();
  applyFilter(initialId === 'video-library-all' ? 'all' : initialId);

  // The public catalog shares the collection filter but must never request private progress.
  if (!status) return;

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

  const updatedAt = (row) => {
    const value = Date.parse(row?.updated_at || '');
    return Number.isFinite(value) ? value : 0;
  };

  const showContinue = (rows) => {
    if (!continuePanel || !continueLink || !continueTitle) return;
    const next = rows
      .filter((row) => row?.status !== 'completed' && Number(row?.progress_percent) > 0)
      .filter((row) => document.querySelector(`[data-video-slug="${CSS.escape(String(row.content_id || '').replace(/^video:/, ''))}"]`))
      .sort((left, right) => updatedAt(right) - updatedAt(left))[0];
    if (!next) return;
    const slug = String(next.content_id).replace(/^video:/, '');
    const card = document.querySelector(`[data-video-slug="${CSS.escape(slug)}"]`);
    const number = card?.dataset.videoNumber || '';
    const title = card?.dataset.videoTitle || 'Continue your film';
    continueTitle.textContent = `${number ? `Film ${number} · ` : ''}${title}`;
    continueLink.href = `/guided-edition/video-library/${encodeURIComponent(slug)}/`;
    continueLink.textContent = `Continue from ${Math.max(1, Math.min(99, Number(next.progress_percent) || 1))}%`;
    continuePanel.hidden = false;
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
      showContinue(rows);
      const completed = rows.filter((row) => row.status === 'completed').length;
      if (status) status.textContent = completed
        ? `${completed} of 51 films completed.`
        : 'Your viewing progress will be saved automatically.';
    })
    .catch(() => {
      if (status) status.textContent = 'The library is ready. Progress sync will retry when you open a film.';
    });
})();
