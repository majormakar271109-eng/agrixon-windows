/* AGRIXON — shared top navigation.
   One structure on every page: five primary destinations plus a More menu.
   The static links stay in the HTML (no-JS fallback); this file only
   re-groups them, paints icons and keeps the active state honest. */
(() => {
  'use strict';
  if (window.__agrixonNavInitialized) return;
  window.__agrixonNavInitialized = true;

  const PRIMARY = ['/', '/sensors', '/tools', '/table', '/soil'];

  const ICONS = {
    map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z M9 3v15M15 6v15',
    grid: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18',
    calendar: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h3M8 17h3',
    shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3zM8 12l3 3 5-6',
    layers: 'M12 3L2 8l10 5 10-5-10-5zM3 12l9 5 9-5M3 16l9 5 9-5',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10 3h4l1 3 3 1 3 2v4l-3 2-1 3-3 3h-4l-1-3-3-1-3-2v-4l3-2 1-3 3-3z',
    leaf: 'M20 3C7 3 3 8 5 14c2 7 13 7 15-11zM4 21L16 9',
    crosshair: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 2v6M12 16v6M2 12h6M16 12h6',
    download: 'M12 3v13M7 11l5 5 5-5M4 17v4h16v-4',
    refresh: 'M20 5v6h-6M4 19v-6h6M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    target: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z',
    list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01'
  };

  const norm = (path) => {
    const value = (path || '/').split('?')[0].split('#')[0];
    if (value.length > 1 && value.endsWith('/')) return value.slice(0, -1);
    return value;
  };

  function paintIcons(root = document) {
    root.querySelectorAll('[data-nav-icon]').forEach((el) => {
      if (el.querySelector('svg')) return;
      const path = ICONS[el.dataset.navIcon] || ICONS.layers;
      el.insertAdjacentHTML(
        'afterbegin',
        `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`
      );
    });
  }

  function ensureStyles() {
    if (document.querySelector('link[data-redesign], link[href^="/redesign.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/redesign.css?v=1';
    link.dataset.redesign = '1';
    document.head.appendChild(link);
  }

  function restructure() {
    const nav = document.querySelector('.topnav');
    if (!nav) return;
    const more = nav.querySelector('[data-nav-more]');
    const menu = more && more.querySelector('.nav-more-menu');
    if (!more || !menu) return;

    const links = [...nav.querySelectorAll('a[data-nav-link]')];
    const byPath = new Map();
    links.forEach((link) => {
      byPath.set(norm(link.dataset.path || link.getAttribute('href')), link);
    });

    links.forEach((link) => {
      const path = norm(link.dataset.path || link.getAttribute('href'));
      if (!PRIMARY.includes(path)) menu.appendChild(link);
    });
    PRIMARY.forEach((path) => {
      const link = byPath.get(path);
      if (link) nav.insertBefore(link, more);
    });
    menu.querySelectorAll('a').forEach((link) => link.setAttribute('role', 'menuitem'));
    nav.setAttribute('aria-label', nav.getAttribute('aria-label') || 'Main navigation');
  }

  function syncActive() {
    const current = norm(location.pathname);
    const more = document.querySelector('[data-nav-more]');
    let moreActive = false;
    document.querySelectorAll('[data-nav-link]').forEach((link) => {
      const target = norm(link.dataset.path || link.getAttribute('href'));
      const on = target === current;
      link.classList.toggle('active', on);
      if (on) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      if (on && more && more.contains(link)) moreActive = true;
    });
    if (more) {
      more.classList.toggle('active', moreActive);
      const button = more.querySelector('[data-nav-more-button]');
      if (button) button.setAttribute('aria-expanded', String(more.classList.contains('open')));
    }
    const active = document.querySelector('.topnav a.active');
    const nav = document.querySelector('.topnav');
    if (active && nav && nav.scrollWidth > nav.clientWidth + 2) {
      active.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }

  function closeMenus(except, restoreFocus) {
    document.querySelectorAll('[data-nav-more].open').forEach((wrap) => {
      if (wrap === except) return;
      wrap.classList.remove('open');
      const button = wrap.querySelector('[data-nav-more-button]');
      if (button) {
        button.setAttribute('aria-expanded', 'false');
        if (restoreFocus) button.focus();
      }
    });
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-nav-more-button]');
    if (button) {
      event.preventDefault();
      const wrap = button.closest('[data-nav-more]');
      const open = !wrap.classList.contains('open');
      closeMenus(wrap);
      wrap.classList.toggle('open', open);
      button.setAttribute('aria-expanded', String(open));
      if (open) {
        const first = wrap.querySelector('.nav-more-menu a');
        if (first) first.focus();
      }
      return;
    }
    if (event.target.closest('.nav-more-menu a')) {
      closeMenus(null);
      return;
    }
    if (!event.target.closest('[data-nav-more]')) closeMenus(null);
  });

  document.addEventListener('keydown', (event) => {
    const wrap = document.querySelector('[data-nav-more].open');
    if (event.key === 'Escape' && wrap) {
      closeMenus(null, true);
      return;
    }
    if (!wrap) return;
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = [...wrap.querySelectorAll('.nav-more-menu a')];
    if (!items.length) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown'
      ? (index + 1) % items.length
      : (index - 1 + items.length) % items.length;
    items[next].focus();
  });

  /* The workspace is a SPA: pushState does not fire popstate. */
  const pushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    const result = pushState(...args);
    window.dispatchEvent(new Event('agrixon:route'));
    return result;
  };

  window.addEventListener('popstate', syncActive);
  window.addEventListener('agrixon:route', syncActive);

  ensureStyles();
  paintIcons();
  restructure();
  syncActive();
  window.addEventListener('DOMContentLoaded', () => {
    paintIcons();
    restructure();
    syncActive();
  });
})();
