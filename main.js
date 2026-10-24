(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Expandable rows ---------- */

  function setOpen(row, open) {
    row.classList.toggle('open', open);
    row.querySelector('.row-btn').setAttribute('aria-expanded', String(open));
  }

  function syncToggle(list) {
    const toggle = document.querySelector(`.toggle-all[data-target="${list.id}"]`);
    if (!toggle) return;
    const all = [...list.querySelectorAll('.row')].every(r => r.classList.contains('open'));
    toggle.textContent = all ? 'Close all' : 'Open all';
  }

  document.querySelectorAll('.row-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.row');
      const open = !row.classList.contains('open');
      setOpen(row, open);
      if (open) history.replaceState(null, '', `#${row.id}`);
      syncToggle(row.closest('.rows'));
    });
  });

  document.querySelectorAll('.toggle-all').forEach(toggle => {
    const list = document.getElementById(toggle.dataset.target);
    toggle.addEventListener('click', () => {
      const open = toggle.textContent.trim() === 'Open all';
      list.querySelectorAll('.row').forEach(r => setOpen(r, open));
      syncToggle(list);
    });
  });

  function openFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const row = id && document.getElementById(id);
    if (!row || !row.classList.contains('row') || !row.querySelector('.row-btn')) return;
    setOpen(row, true);
    syncToggle(row.closest('.rows'));
    row.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }
  openFromHash();
  addEventListener('hashchange', openFromHash);

  /* Print every detail, then restore what was open. */
  let openBeforePrint = [];
  addEventListener('beforeprint', () => {
    openBeforePrint = [...document.querySelectorAll('.skill[open]')];
    document.querySelectorAll('.skill').forEach(d => { d.open = true; });
  });
  addEventListener('afterprint', () => {
    document.querySelectorAll('.skill').forEach(d => { d.open = openBeforePrint.includes(d); });
  });

  /* ---------- Places: list and map point at each other ---------- */

  const map = document.querySelector('.map');
  const pins = [...document.querySelectorAll('.pin')];
  const stops = [...document.querySelectorAll('.stop')];
  const city = n => stops.find(s => s.dataset.stop === n)?.querySelector('.s-city')?.textContent || '';
  let pinned = null;

  function show(n) {
    pins.forEach(p => p.classList.toggle('on', p.dataset.stop === n));
    stops.forEach(s => s.classList.toggle('on', s.dataset.stop === n));
  }

  function pin(n) {
    pinned = pinned === n ? null : n;
    stops.forEach(s => s.setAttribute('aria-pressed', String(s.dataset.stop === pinned)));
    pins.forEach(p => p.setAttribute('aria-pressed', String(p.dataset.stop === pinned)));
    show(pinned);
  }

  pins.forEach(p => {
    const n = p.dataset.stop;
    p.setAttribute('aria-label', `${n}. ${city(n)}`);
    p.setAttribute('aria-pressed', 'false');
  });

  [...pins, ...stops].forEach(el => {
    const n = el.dataset.stop;
    el.addEventListener('mouseenter', () => show(n));
    el.addEventListener('mouseleave', () => show(pinned));
    el.addEventListener('focus', () => show(n));
    el.addEventListener('blur', () => show(pinned));
    el.addEventListener('click', () => pin(n));
  });

  if (map) {
    if (reduce || !('IntersectionObserver' in window)) {
      map.classList.add('drawn');
    } else {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          map.classList.add('drawn');
          io.disconnect();
        }
      }, { threshold: 0.35 });
      io.observe(map);
    }
  }

  /* ---------- Header: hairline after scroll, current section in nav ---------- */

  const top = document.querySelector('.top');
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      top.classList.toggle('scrolled', scrollY > 8);
      ticking = false;
    });
  }, { passive: true });

  const links = [...document.querySelectorAll('.nav a')];
  if ('IntersectionObserver' in window && links.length) {
    const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const nio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.removeAttribute('aria-current'));
        byId.get(e.target.id)?.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) nio.observe(s); });
  }
})();
