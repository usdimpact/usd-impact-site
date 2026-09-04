import {
  collections,
  getAdjacentVideos,
  getCollection,
  getCollectionVideos,
  getVideoNumber,
  libraryMeta,
  videos,
} from '../data/video-library.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderHeader() {
  return `<header class="vl-site-header">
    <div class="vl-shell vl-header-inner">
      <a class="vl-brand" href="/" aria-label="USD Impact home">
        <img src="/assets/logo/USDImpact_Horizontal_Color_NoTagline_2048.png" alt="" width="2048" height="614">
        <span>USD Impact</span>
      </a>
      <nav class="vl-site-nav" aria-label="Library navigation">
        <a href="/guided-edition/">Guided Edition</a>
        <a href="/guided-edition/book/">Book</a>
        <a href="/guided-edition/audiobook/">Audiobook</a>
        <a href="/guided-edition/video-library/" aria-current="page">Video Library</a>
        <a href="/account/">Account</a>
      </nav>
    </div>
  </header>`;
}

function renderFooter() {
  return `<footer class="vl-footer"><div class="vl-shell">
    <strong>USD Impact</strong>
    <p>${escapeHtml(libraryMeta.compliance)}</p>
    <p><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/compliance/">Compliance</a></p>
  </div></footer>`;
}

function renderDocument({ title, description, body, scripts = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="stylesheet" href="/assets/video-library.css">
</head>
<body class="vl-body">
  ${renderHeader()}
  ${body}
  ${renderFooter()}
  ${scripts}
</body>
</html>`;
}

function renderCatalogCard(video) {
  const number = getVideoNumber(video);
  return `<li class="vl-card" data-video-card data-video-slug="${escapeHtml(video.slug)}" data-video-number="${String(number).padStart(2, '0')}" data-video-title="${escapeHtml(video.title)}">
    <a href="/guided-edition/video-library/${escapeHtml(video.slug)}/">
      <div class="vl-card-art vl-theme-${escapeHtml(video.collectionId)}" aria-hidden="true">
        <span>${String(number).padStart(2, '0')}</span><i></i><i></i><i></i>
      </div>
      <div class="vl-card-copy">
        <div class="vl-card-meta"><span>Film ${String(number).padStart(2, '0')}</span><time>${escapeHtml(video.durationLabel)}</time></div>
        <h3>${escapeHtml(video.title)}</h3>
        <p>${escapeHtml(video.description)}</p>
        <div class="vl-progress-line"><span data-progress-label>Not started</span><i><b data-progress-bar></b></i></div>
      </div>
    </a>
  </li>`;
}

function renderCollectionToolbar() {
  const collectionLinks = collections.map((collection) => {
    const count = getCollectionVideos(collection.id).length;
    return `<a href="#${escapeHtml(collection.id)}" data-video-filter="${escapeHtml(collection.id)}"><span>${collection.order}. ${escapeHtml(collection.title)}</span><span aria-hidden="true">${count}</span></a>`;
  }).join('');

  return `<div class="vl-collection-toolbar">
    <p class="vl-toolbar-label">Choose a learning path</p>
    <nav class="vl-collection-filter" aria-label="Filter videos by collection">
      <a href="#video-library-all" data-video-filter="all" aria-current="location"><span>All ${videos.length} films</span><span aria-hidden="true">${videos.length}</span></a>
      ${collectionLinks}
    </nav>
    <p class="vl-result-count" data-video-result-count role="status" aria-live="polite" aria-atomic="true">Showing ${videos.length} films across all ${collections.length} collections.</p>
  </div>`;
}

export function renderProtectedVideoCatalog() {
  const collectionHtml = collections.map((collection) => {
    const items = getCollectionVideos(collection.id);
    return `<section class="vl-collection" id="${escapeHtml(collection.id)}" aria-labelledby="${escapeHtml(collection.id)}-title" data-video-collection="${escapeHtml(collection.id)}" data-collection-title="${escapeHtml(collection.title)}">
      <div class="vl-section-heading">
        <div><p class="vl-eyebrow">Path ${collection.order} of ${collections.length} · ${escapeHtml(collection.kicker)}</p><h2 id="${escapeHtml(collection.id)}-title">${escapeHtml(collection.title)}</h2></div>
        <p>${escapeHtml(collection.description)}</p>
      </div>
      <ol class="vl-grid">${items.map(renderCatalogCard).join('')}</ol>
    </section>`;
  }).join('');

  return renderDocument({
    title: 'Video Library | Guided Interactive Edition | USD Impact',
    description: 'Secure access to the 51-film USD Impact educational video library.',
    body: `<main>
      <section class="vl-hero"><div class="vl-shell">
        <p class="vl-eyebrow">Guided Interactive Edition</p>
        <h1>Read the dollar system visually.</h1>
        <p class="vl-lead">51 verified films across five collections, with English captions and saved viewing progress.</p>
        <div class="vl-stat-row"><span><strong>51</strong> films</span><span><strong>5</strong> collections</span><span><strong>${escapeHtml(libraryMeta.totalDurationLabel)}</strong> total</span><span><strong>EN</strong> captions</span></div>
      </div></section>
      <div class="vl-shell vl-main" id="video-library-all">
        <div class="vl-library-status" id="library-progress-status" role="status">Loading your progress…</div>
        <div class="vl-continue-panel" data-video-continue hidden>
          <div><span>Your next film</span><strong data-video-continue-title></strong></div>
          <a class="vl-button" data-video-continue-link href="/guided-edition/video-library/">Continue watching</a>
        </div>
        ${renderCollectionToolbar()}
        ${collectionHtml}
      </div>
    </main>`,
    scripts: '<script src="/assets/video-library-progress.js" defer></script>',
  });
}

export function renderProtectedVideoLesson({ video, signedToken, customerCode }) {
  const collection = getCollection(video.collectionId);
  const collectionVideos = getCollectionVideos(video.collectionId);
  const adjacent = getAdjacentVideos(video);
  const number = getVideoNumber(video);
  const query = new URLSearchParams({
    primaryColor: '#C9A35B',
    letterboxColor: '#020A14',
    preload: 'metadata',
    defaultTextTrack: 'en',
  });
  const playerUrl = `https://customer-${customerCode}.cloudflarestream.com/${encodeURIComponent(signedToken)}/iframe?${query}`;
  const concepts = video.concepts.map((concept) => `<li>${escapeHtml(concept)}</li>`).join('');
  const sources = video.sources.map((source) => `<li>${escapeHtml(source)}</li>`).join('');
  const previous = adjacent.previous
    ? `<a href="/guided-edition/video-library/${escapeHtml(adjacent.previous.slug)}/"><span>← Previous</span><strong>${escapeHtml(adjacent.previous.shortTitle)}</strong></a>`
    : '<span></span>';
  const next = adjacent.next
    ? `<a href="/guided-edition/video-library/${escapeHtml(adjacent.next.slug)}/"><span>Next →</span><strong>${escapeHtml(adjacent.next.shortTitle)}</strong></a>`
    : '<a href="/guided-edition/video-library/"><span>Collection complete</span><strong>Return to library</strong></a>';

  return renderDocument({
    title: `${video.title} | USD Impact Video Library`,
    description: video.description,
    body: `<main class="vl-watch">
      <div class="vl-shell vl-main">
        <nav class="vl-breadcrumb" aria-label="Breadcrumb"><a href="/guided-edition/video-library/">Video Library</a><span>/</span><a href="/guided-edition/video-library/#${escapeHtml(collection.id)}">${escapeHtml(collection.title)}</a><span>/</span><span>Film ${String(number).padStart(2, '0')}</span></nav>
        <div class="vl-player-shell">
          <iframe id="stream-player" src="${escapeHtml(playerUrl)}" title="${escapeHtml(video.title)}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" referrerpolicy="no-referrer" allowfullscreen></iframe>
        </div>
        <div class="vl-watch-grid">
          <article>
            <p class="vl-eyebrow">${video.format === 'masterclass' ? 'Masterclass' : 'Short explainer'} · ${escapeHtml(video.durationLabel)}</p>
            <h1>${escapeHtml(video.title)}</h1>
            <p class="vl-deck">${escapeHtml(video.description)}</p>
            <h2>Core concepts</h2><ul class="vl-pills">${concepts}</ul>
          </article>
          <aside class="vl-aside">
            <div><span>Viewing progress</span><strong id="video-progress-label">Loading…</strong><div class="vl-watch-progress"><i id="video-progress-bar"></i></div></div>
            <div><span>Collection</span><strong>${String(video.order).padStart(2, '0')} / ${String(collectionVideos.length).padStart(2, '0')}</strong><p>${escapeHtml(collection.title)}</p></div>
            <div><span>Accessibility</span><p>Verified English captions and keyboard-ready adaptive playback.</p></div>
            <div><span>Primary sources</span><ul>${sources}</ul></div>
            <div class="vl-compliance"><span>Use</span><p>${escapeHtml(libraryMeta.compliance)}</p></div>
          </aside>
        </div>
        <nav class="vl-lesson-nav" aria-label="Lesson navigation">${previous}${next}</nav>
      </div>
    </main>`,
    scripts: `<script src="https://embed.cloudflarestream.com/embed/sdk.latest.js" defer></script>
      <script src="/assets/video-library-player.js" data-video-slug="${escapeHtml(video.slug)}" data-video-duration="${Number(video.durationSeconds)}" defer></script>`,
  });
}

export function renderVideoUnavailable({ video = null } = {}) {
  const title = video ? video.title : 'Video Library';
  return renderDocument({
    title: `${title} temporarily unavailable | USD Impact`,
    description: 'Secure video delivery is temporarily unavailable.',
    body: `<main><section class="vl-hero vl-hero-compact"><div class="vl-shell"><p class="vl-eyebrow">Secure delivery</p><h1>Playback is temporarily unavailable.</h1><p class="vl-lead">Your access remains active. Please retry in a few minutes.</p><p><a class="vl-button" href="${video ? `/guided-edition/video-library/${escapeHtml(video.slug)}/` : '/guided-edition/video-library/'}">Retry</a> <a class="vl-button vl-button-secondary" href="/guided-edition/video-library/">Return to library</a></p></div></section></main>`,
  });
}

export function videoLibraryContentSecurityPolicy(customerCode) {
  const streamOrigin = `https://customer-${customerCode}.cloudflarestream.com`;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `frame-src ${streamOrigin}`,
    "img-src 'self' data:",
    "style-src 'self'",
    "script-src 'self' https://embed.cloudflarestream.com",
    "connect-src 'self'",
  ].join('; ');
}
