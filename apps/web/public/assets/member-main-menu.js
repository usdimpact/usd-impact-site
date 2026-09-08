(() => {
  const menu = document.querySelector('[data-member-main-menu]');
  if (!menu) return;
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) menu.removeAttribute('open');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menu.hasAttribute('open')) return;
    menu.removeAttribute('open');
    menu.querySelector('summary')?.focus();
  });
  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => menu.removeAttribute('open'));
  });
})();
