// Navigation is presentation only. Protected destinations enforce access on the server.
export const SITE_NAVIGATION = Object.freeze([
  { label: 'Learn', links: [
    { label: 'Start Here', href: '/start-here' },
    { label: 'Framework', href: '/framework/dollar-transmission-chain' },
    { label: 'Weekly Checklist', href: '/lead-magnets/weekly-dollar-regime-checklist' },
  ] },
  { label: 'Updates', links: [
    { label: 'Daily USD Impact', href: '/news' },
    { label: 'Weekly Score', href: '/score' },
    { label: 'Reports', href: '/reports' },
  ] },
  { label: 'Library', links: [
    { label: 'Guided Edition', href: '/guided-edition' },
    { label: 'Book', href: '/guided-edition/book' },
    { label: 'Audiobook', href: '/guided-edition/audiobook' },
    { label: 'Video Library', href: '/guided-edition/video-library' },
    { label: 'Library Pass details', href: '/book/read-the-dollar-first' },
  ] },
].map((group) => Object.freeze({
  ...group,
  links: Object.freeze(group.links.map((link) => Object.freeze(link))),
})));


export const SPANISH_PUBLIC_NAVIGATION = Object.freeze([
  Object.freeze({ label: 'Inicio', href: '/es/' }),
  Object.freeze({ label: 'Empieza aquí', href: '/es/start-here/' }),
  Object.freeze({ label: 'Marco del dólar', href: '/es/dollar-framework/' }),
  Object.freeze({ label: 'Cadena de transmisión', href: '/es/framework/dollar-transmission-chain/' }),
  Object.freeze({ label: 'Panel de tres diales', href: '/es/framework/three-dial-dashboard/' }),
]);

export const SITE_SHELL_COPY = Object.freeze({
  en: Object.freeze({
    skipLink: 'Skip to main content',
    menuLabel: 'Menu',
    navigationLabel: 'Main navigation',
    homeHref: '/',
    homeAriaLabel: 'USD Impact home',
    localeSwitchLabel: 'Español',
    localeSwitchLanguage: 'es',
    footerBrand: 'Practical education for reading the dollar first.',
  }),
  es: Object.freeze({
    skipLink: 'Saltar al contenido principal',
    menuLabel: 'Menú',
    navigationLabel: 'Navegación principal en español',
    homeHref: '/es/',
    homeAriaLabel: 'Inicio de USD Impact en español',
    localeSwitchLabel: 'English',
    localeSwitchLanguage: 'en',
    footerBrand: 'Educación práctica para leer primero el dólar.',
  }),
});

export function siteShellCopyForLocale(locale = 'en') {
  return SITE_SHELL_COPY[locale] ?? SITE_SHELL_COPY.en;
}

export function navigationLinkIsActive(currentPath, href) {
  const path = String(currentPath || '').replace(/\/+$/, '') || '/';
  const target = href.replace(/\/+$/, '') || '/';
  if (target === '/' || target === '/guided-edition') return path === target;
  return path === target || path.startsWith(`${target}/`);
}

export function renderMemberMainMenu() {
  const groups = SITE_NAVIGATION.map((group) => `<div class="member-main-menu-group"><strong>${group.label}</strong>${group.links.map((link) => `<a href="${link.href}">${link.label}</a>`).join('')}</div>`).join('');
  return `<details class="member-main-menu" data-member-main-menu><summary>Main menu</summary><nav class="member-main-menu-panel" aria-label="Main navigation"><div class="member-main-menu-group"><strong>USD Impact</strong><a href="/">Home</a><a href="/account">Account</a></div>${groups}</nav></details>`;
}

export function memberMainMenuAssets() {
  return '<link rel="stylesheet" href="/assets/member-main-menu.css"><script src="/assets/member-main-menu.js" defer></script>';
}
