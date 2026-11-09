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

  /* ---------- Showreel: muted preview in view, sound on request, chapters ---------- */

  const reel = document.querySelector('.reel');
  const video = reel?.querySelector('.reel-video');
  if (reel && video) {
    const soundBtn = reel.querySelector('[data-reel-sound]');
    const soundLabel = reel.querySelector('[data-reel-sound-label]');
    const toggleBtn = reel.querySelector('[data-reel-toggle]');
    const timeEl = reel.querySelector('[data-reel-time]');
    const chapters = [...reel.querySelectorAll('.chapters button')];
    const starts = chapters.map(b => Number(b.dataset.t));
    let userPaused = false;
    let raf = 0;

    video.removeAttribute('controls');

    const two = n => String(Math.floor(n)).padStart(2, '0');

    function render() {
      const t = video.currentTime || 0;
      const end = video.duration || 22.8;
      timeEl.textContent = `00:${two(t)}`;
      chapters.forEach((b, i) => {
        const s = starts[i];
        const e = starts[i + 1] ?? end;
        b.style.setProperty('--p', Math.min(1, Math.max(0, (t - s) / (e - s))).toFixed(4));
        if (t >= s && t < e) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
    }

    function sync() {
      const playing = !video.paused;
      reel.classList.toggle('playing', playing);
      reel.classList.toggle('sound', !video.muted);
      soundLabel.textContent = video.muted ? 'Play with sound' : 'Mute';
      soundBtn.setAttribute('aria-label', video.muted ? 'Play from the start with sound' : 'Mute');
      toggleBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      cancelAnimationFrame(raf);
      const loop = () => { render(); raf = requestAnimationFrame(loop); };
      if (playing) loop(); else render();
    }
    ['play', 'pause', 'volumechange', 'seeked', 'loadedmetadata'].forEach(ev => video.addEventListener(ev, sync));

    function start(withSound) {
      userPaused = false;
      if (withSound) { video.currentTime = 0; video.muted = false; }
      video.play().catch(() => {});
    }

    soundBtn.addEventListener('click', () => {
      if (video.muted) start(true);
      else video.muted = true;
    });

    toggleBtn.addEventListener('click', () => {
      if (video.paused) start(false);
      else { userPaused = true; video.pause(); }
    });

    video.addEventListener('click', () => {
      if (video.muted) start(true);
      else if (video.paused) start(false);
      else { userPaused = true; video.pause(); }
    });

    chapters.forEach((b, i) => b.addEventListener('click', () => {
      video.currentTime = starts[i];
      start(false);
    }));

    /* Muted preview while in view (never with reduced motion or data saver on); pause when it leaves. */
    const saveData = navigator.connection?.saveData === true;
    if ('IntersectionObserver' in window) {
      const rio = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) {
          if (!video.paused) { video.pause(); video.muted = true; }
        } else if (e.intersectionRatio >= 0.45 && !reduce && !saveData && !userPaused && video.paused) {
          video.play().catch(() => {});
        }
      }, { threshold: [0, 0.45] });
      rio.observe(video);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });

    /* Browsers without scroll-linked animation: the print straightens once, when it comes into view. */
    if (!reduce && !(window.CSS && CSS.supports('animation-timeline: view()')) && 'IntersectionObserver' in window) {
      reel.classList.add('tilt');
      const tio = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { reel.classList.remove('tilt'); tio.disconnect(); }
      }, { threshold: 0.3 });
      tio.observe(reel.querySelector('.reel-print'));
    }

    sync();
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
