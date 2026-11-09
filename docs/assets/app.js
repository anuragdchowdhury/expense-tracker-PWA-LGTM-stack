// 1. Dark Mode Toggle (follows dark-mode-toggle guide)
const STORAGE_KEY = 'docs-color-scheme';
const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
const themeToggleBtn = document.getElementById('theme-toggle');

function getSystemScheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getEffectiveScheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return getSystemScheme();
}

function applyScheme(value) {
  if (!metaColorScheme) return;
  metaColorScheme.content = value === 'light' || value === 'dark' ? value : 'light dark';
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const current = getEffectiveScheme();
    const target = current === 'dark' ? 'light' : 'dark';
    const system = getSystemScheme();

    try {
      if (target === system) {
        localStorage.removeItem(STORAGE_KEY);
        applyScheme('light dark');
      } else {
        localStorage.setItem(STORAGE_KEY, target);
        applyScheme(target);
      }
    } catch {
      applyScheme(target);
    }
  });
}

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    applyScheme(event.newValue || 'light dark');
  }
});

// 2. Scrollspy Navigation (follows scrollspy guide)
const tocLinks = document.querySelectorAll('.toc-nav a');
const tocSections = document.querySelectorAll('.doc-content section[id]');

if (tocLinks.length > 0 && tocSections.length > 0) {
  if (CSS.supports('scroll-target-group: auto')) {
    const syncAriaCurrent = () => {
      const currentLink = document.querySelector('.toc-nav a:target-current');
      tocLinks.forEach((link) => {
        link.setAttribute('aria-current', link === currentLink ? 'true' : 'false');
      });
    };
    syncAriaCurrent();
    document.addEventListener('scrollend', syncAriaCurrent);
  } else {
    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            tocLinks.forEach((link) => {
              const active = link.getAttribute('href') === `#${id}`;
              link.classList.toggle('target-current', active);
              link.setAttribute('aria-current', String(active));
            });
          }
        });
      },
      { rootMargin: '-25% 0px -65% 0px', threshold: 0 }
    );
    tocSections.forEach((sec) => spyObserver.observe(sec));
  }
}

// 3. Mobile Navigation Drawer (follows navigation-drawer guide)
const drawer = document.getElementById('docs-drawer');
const drawerOpenBtn = document.getElementById('drawer-open');
const drawerCloseBtn = document.getElementById('drawer-close');
const docsMainShell = document.getElementById('docs-shell');

if (drawer && drawerOpenBtn) {
  const scroller = drawer.querySelector('.Drawer-scroller');
  const sheet = drawer.querySelector('.Drawer-sheet');
  let isOpening = false;

  const openDrawer = async () => {
    isOpening = true;
    drawer.showPopover();
    if (!CSS.supports('scroll-initial-target', 'nearest')) {
      scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'instant' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    scroller.scrollTo({ left: 0, behavior: 'auto' });
  };

  const closeDrawer = () => {
    isOpening = false;
    scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'auto' });
  };

  const onDrawerOpened = () => {
    isOpening = false;
    if (docsMainShell) docsMainShell.inert = true;
    drawerOpenBtn.setAttribute('aria-expanded', 'true');
    sheet.focus();
  };

  const onDrawerClosed = () => {
    isOpening = false;
    if (drawer.matches(':popover-open')) {
      drawer.hidePopover();
    }
    if (docsMainShell) docsMainShell.inert = false;
    drawerOpenBtn.setAttribute('aria-expanded', 'false');
  };

  const visibleThreshold = 1 / Math.max(window.innerWidth, 320);
  const drawerObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries.at(-1);
      if (!entry) return;
      if (entry.intersectionRatio >= visibleThreshold) isOpening = false;
      if (!isOpening && entry.intersectionRatio < visibleThreshold) onDrawerClosed();
      if (entry.intersectionRatio === 1) onDrawerOpened();
    },
    { root: drawer, threshold: [visibleThreshold, 1] }
  );
  drawerObserver.observe(sheet);

  if (!CSS.supports('animation-timeline: scroll()')) {
    scroller.addEventListener('scroll', () => {
      const ratio = Math.max(0, Math.min(1, 1 - scroller.scrollLeft / Math.max(sheet.offsetWidth, 1)));
      drawer.style.setProperty('--drawer-backdrop', String(ratio));
    });
  }

  drawerOpenBtn.addEventListener('click', openDrawer);
  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);
  drawer.addEventListener('click', (event) => {
    if (!sheet.contains(event.target)) closeDrawer();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.matches(':popover-open')) closeDrawer();
  });
}

// 4. Copy Code Buttons
document.querySelectorAll('.code-block').forEach((block) => {
  const btn = block.querySelector('.copy-btn');
  const codeEl = block.querySelector('pre code');
  if (!btn || !codeEl) return;

  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(codeEl.textContent || '');
      const prev = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => {
        btn.textContent = prev;
      }, 1500);
    } catch {
      btn.textContent = 'Press Ctrl+C';
    }
  });
});

// 5. Cross-Page Quick Search Index
const SEARCH_INDEX = [
  { title: 'Project Overview & Quick Start', page: 'Overview & Tech Stack', url: './index.html#overview' },
  { title: 'Frontend Stack (React, Vite PWA, Tailwind, Temporal)', page: 'Overview & Tech Stack', url: './index.html#frontend-stack' },
  { title: 'Backend Stack (FastAPI, SQLAlchemy, SQLite WAL)', page: 'Overview & Tech Stack', url: './index.html#backend-stack' },
  { title: 'Observability Stack (OTel, Prometheus, Loki, Tempo, Grafana)', page: 'Overview & Tech Stack', url: './index.html#observability-stack' },
  { title: 'Directory Structure & GitHub Pages Hosting', page: 'Overview & Tech Stack', url: './index.html#directory-structure' },
  { title: 'System Context & Container Topology', page: 'High-Level Design', url: './hld.html#system-architecture' },
  { title: 'Docker Bridge Network & Volumes', page: 'High-Level Design', url: './hld.html#network-storage' },
  { title: 'Offline-First PWA & Sync Flow', page: 'High-Level Design', url: './hld.html#offline-pwa' },
  { title: 'Nginx Reverse Proxy & PWA Caching Strategy', page: 'High-Level Design', url: './hld.html#nginx-proxy' },
  { title: 'SQLite Database Schema & ER Diagram', page: 'Low-Level Design', url: './lld.html#database-schema' },
  { title: 'FastAPI Endpoints & Validation Contracts', page: 'Low-Level Design', url: './lld.html#api-contracts' },
  { title: 'Dashboard Trend & Category Aggregation Logic', page: 'Low-Level Design', url: './lld.html#aggregation-logic' },
  { title: 'Frontend Modules (Currency INR, Temporal, OfflineStore)', page: 'Low-Level Design', url: './lld.html#frontend-modules' },
  { title: 'Telemetry Signals Pipeline (Traces, Metrics, Logs)', page: 'Observability & LGTM', url: './observability.html#pipeline' },
  { title: 'FastAPI & SQLite3 OTel Instrumentation', page: 'Observability & LGTM', url: './observability.html#backend-otel' },
  { title: 'OTel Collector Contrib Configuration', page: 'Observability & LGTM', url: './observability.html#collector-config' },
  { title: 'Prometheus, Loki v3, and Tempo v3 Setup', page: 'Observability & LGTM', url: './observability.html#storage-backends' },
  { title: 'Grafana Datasources & Trace-to-Logs Correlation', page: 'Observability & LGTM', url: './observability.html#grafana-correlation' },
];

const searchInput = document.getElementById('doc-search');
const searchResults = document.getElementById('search-results');

if (searchInput && searchResults) {
  const renderResults = (query) => {
    const q = query.trim().toLowerCase();
    if (!q) {
      searchResults.hidden = true;
      searchResults.innerHTML = '';
      return;
    }
    const matches = SEARCH_INDEX.filter(
      (item) => item.title.toLowerCase().includes(q) || item.page.toLowerCase().includes(q)
    ).slice(0, 7);

    if (matches.length === 0) {
      searchResults.innerHTML = '<div class="search-result-item">No matching sections found.</div>';
    } else {
      searchResults.innerHTML = matches
        .map(
          (m) =>
            `<a class="search-result-item" href="${m.url}"><strong>${m.title}</strong><span class="search-result-meta">${m.page}</span></a>`
        )
        .join('');
    }
    searchResults.hidden = false;
  };

  searchInput.addEventListener('input', (e) => renderResults(e.target.value));
  searchInput.addEventListener('focus', (e) => {
    if (e.target.value.trim()) renderResults(e.target.value);
  });
  document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchInput) {
      searchResults.hidden = true;
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault();
      searchInput.focus();
    }
  });
}
