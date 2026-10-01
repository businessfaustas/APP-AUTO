/* AUTAPLATE — shared script. Vanilla, no dependencies. */

/* ------------------------------------------------------------------
   FORM_ENDPOINT — paste your form backend URL between the quotes.
   Any service that accepts a multipart POST works (Formspree, Basin,
   Getform, or your own endpoint). It must accept file uploads for the
   photo field. While this is empty the form will not send and shows
   the "please call" message instead.
   ------------------------------------------------------------------ */
const FORM_ENDPOINT = '';

(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------------------------------------------------------------- headline line split + image wipes
     Runs before the reveal observer so both are picked up by it. */
  $$('.h1[data-reveal], .h2[data-reveal]').forEach((h) => {
    const parts = h.innerHTML.split(/<br\s*\/?>/i).map((p) => p.trim()).filter(Boolean);
    h.innerHTML = parts.map((p, i) => `<span class="line" style="--i:${i}"><span>${p}</span></span>`).join('');
    h.classList.add('split');
  });
  $$('.card-media, .svc-hero-media, .mat-media, .svc-row-media, .gallery figure, .stack-24').forEach((m) => m.classList.add('wipe'));

  /* ---------------------------------------------------------------- header condense (40px) */
  const header = $('[data-header]');
  if (header) {
    let ticking = false;
    const heroMedia = $('.hero-media');
    let lastY = window.scrollY;
    const update = () => {
      const y = window.scrollY;
      header.classList.toggle('is-condensed', y > 40);
      // hide on scroll down, return on scroll up; never while the menu is open or focus is inside
      const hide = y > lastY && y > 480 && !root.classList.contains('nav-open') && !header.contains(document.activeElement);
      if (Math.abs(y - lastY) > 4) header.classList.toggle('is-hidden', hide);
      lastY = y;
      if (heroMedia && !reduced && y < window.innerHeight * 1.2) heroMedia.style.setProperty('--py', `${(y * 0.28).toFixed(1)}px`);
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------- mobile menu */
  const toggle = $('[data-menu-toggle]');
  if (toggle) {
    const set = (open) => { root.classList.toggle('nav-open', open); toggle.setAttribute('aria-expanded', String(open)); };
    toggle.addEventListener('click', () => set(!root.classList.contains('nav-open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('nav-open')) { set(false); toggle.focus(); } });
    $$('#site-nav a').forEach((a) => a.addEventListener('click', () => set(false)));
  }

  /* ---------------------------------------------------------------- logo transition target
     The page transition itself is pure CSS (@view-transition). This only tells the
     CSS where the centre of the screen is relative to the wordmark. */
  const brand = $('.brand');
  const setVT = () => {
    if (!brand) return;
    const r = brand.getBoundingClientRect();
    const scale = Math.min(3, (window.innerWidth * 0.7) / Math.max(r.width, 1));
    root.style.setProperty('--vt-dx', `${window.innerWidth / 2 - (r.left + r.width / 2)}px`);
    root.style.setProperty('--vt-dy', `${window.innerHeight / 2 - (r.top + r.height / 2)}px`);
    root.style.setProperty('--vt-s', scale.toFixed(2));
  };
  setVT();
  window.addEventListener('resize', setVT);
  window.addEventListener('pageswap', setVT);

  /* ---------------------------------------------------------------- scroll reveal + H2 hairline */
  const revealEls = $$('[data-reveal], .wipe');
  if (reduced || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    // Anything already in view on load appears immediately — never waits for a scroll.
    const vh = window.innerHeight;
    const pending = [], inView = [];
    revealEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) inView.push(el);
      else pending.push(el);
    });
    // While the loader panel covers the page, hold the first-screen reveals so they play as it lifts.
    const introMs = { full: 1250, short: 520 }[root.getAttribute('data-loader')] || 0;
    if (introMs) setTimeout(() => inView.forEach((el) => el.classList.add('is-in')), introMs);
    else inView.forEach((el) => el.classList.add('is-now', 'is-in'));
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.is-now').forEach((el) => el.classList.remove('is-now'))));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -8% 0px' });
    pending.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------------- case study pin (home only) */
  const track = $('[data-case]');
  if (track) {
    const states = $$('[data-cs-state]', track);
    const frames = $$('[data-cs-frame]', track);
    let current = -1;
    const show = (i) => {
      if (i === current) return;
      current = i;
      states.forEach((s, n) => s.classList.toggle('is-active', n === i));
      frames.forEach((f, n) => f.classList.toggle('is-active', n === i));
    };
    if (reduced) { show(0); states.forEach((s) => s.classList.add('is-active')); }
    else {
      let ticking = false;
      const update = () => {
        const r = track.getBoundingClientRect();
        const travel = r.height - window.innerHeight;
        const p = Math.min(1, Math.max(0, -r.top / Math.max(travel, 1)));
        show(Math.min(states.length - 1, Math.floor(p * states.length)));
        ticking = false;
      };
      window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      window.addEventListener('resize', update);
      update();
    }
  }

  /* ---------------------------------------------------------------- before / after */
  $$('[data-ba]').forEach((ba) => {
    const range = $('[data-ba-range]', ba);
    if (!range) return;
    const set = () => ba.style.setProperty('--pos', `${range.value}%`);
    range.addEventListener('input', set);
    set();
  });

  /* ---------------------------------------------------------------- reviews from /data/reviews.json */
  const reviews = $('[data-reviews]');
  if (reviews) {
    fetch(reviews.dataset.src, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = data && Array.isArray(data.reviews) ? data.reviews.filter((r) => r && r.text) : [];
        if (!list.length) return; // stays hidden — nothing is invented
        const ul = $('[data-review-list]', reviews);
        list.forEach((r, i) => {
          const li = document.createElement('li');
          li.className = 'review';
          li.setAttribute('data-reveal', '');
          li.style.setProperty('--d', `${(i % 3) * 80}ms`);
          const meta = document.createElement('p');
          meta.className = 'eyebrow';
          meta.textContent = [r.rating ? `${r.rating} / 5` : '', r.date || ''].filter(Boolean).join(' — ');
          const q = document.createElement('blockquote');
          const p = document.createElement('p');
          p.textContent = r.text;
          q.lang = r.lang || '';
          q.append(p);
          const who = document.createElement('p');
          who.className = 'small muted';
          who.textContent = r.author || '';
          li.append(meta, q, who);
          ul.append(li);
          requestAnimationFrame(() => li.classList.add('is-in'));
        });
        if (data.place_url) {
          const src = $('[data-review-source]', reviews);
          const a = document.createElement('a');
          a.href = data.place_url; a.className = 'link-arrow'; a.rel = 'noopener';
          a.textContent = root.lang === 'lt' ? 'Visi atsiliepimai Google →' : 'All reviews on Google →';
          src.append(a);
        }
        reviews.hidden = false;
      })
      .catch(() => {});
  }

  /* ---------------------------------------------------------------- work: filter + record dialog */
  const grid = $('[data-job-grid]');
  if (grid) {
    const chips = $$('[data-filter]');
    const status = $('[data-filter-status]');
    chips.forEach((chip) => chip.addEventListener('click', () => {
      const f = chip.dataset.filter;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      chip.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
      const jobs = $$('.job', grid);
      let n = 0;
      const show = [], hide = [];
      jobs.forEach((job) => { const on = f === 'all' || job.dataset.service === f; if (on) { n++; show.push(job); } else hide.push(job); });
      const swap = () => {
        hide.forEach((j) => { j.hidden = true; j.classList.remove('is-out'); });
        show.forEach((j) => { const was = j.hidden; j.hidden = false; j.classList.add('is-in'); if (was && !reduced) { j.classList.add('is-pre'); } });
        requestAnimationFrame(() => requestAnimationFrame(() => show.forEach((j, i) => { j.style.transitionDelay = `${Math.min(i, 8) * 40}ms`; j.classList.remove('is-pre'); })));
        setTimeout(() => show.forEach((j) => { j.style.transitionDelay = ''; }), 800);
      };
      if (reduced) swap();
      else { hide.forEach((j) => { if (!j.hidden) j.classList.add('is-out'); }); setTimeout(swap, 240); }
      if (status) status.textContent = `${n}`;
    }));

    const dialog = $('[data-job-dialog]');
    if (dialog && typeof dialog.showModal === 'function') {
      let opener = null;
      $$('[data-job-open]', grid).forEach((btn) => btn.addEventListener('click', () => {
        const job = btn.closest('.job');
        opener = btn;
        $('[data-job-title]', dialog).textContent = $('.h3', job).textContent;
        const media = $('[data-job-media]', dialog);
        media.replaceChildren(...$('[data-job-gallery]', job).content.cloneNode(true).childNodes);
        $('[data-job-record]', dialog).innerHTML = $('.record', job).innerHTML;
        dialog.showModal();
      }));
      $('[data-job-close]', dialog).addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
      dialog.addEventListener('close', () => opener && opener.focus());
    }
  }

  /* ---------------------------------------------------------------- quote form (multi-step) */
  const form = $('[data-quote]');
  if (form) {
    const steps = $$('.q-step', form);
    const progress = $('[data-quote-progress]', form);
    const statusEl = $('[data-quote-status]', form);
    let at = 0;
    const pad = (n) => String(n).padStart(2, '0');
    const go = (i, focus = true) => {
      at = i;
      steps.forEach((s, n) => s.classList.toggle('is-active', n === i));
      if (progress) progress.textContent = `${pad(i + 1)} / ${pad(steps.length)}`;
      if (focus) { const first = $('input, select, textarea', steps[i]); if (first) first.focus(); }
    };
    const valid = (step) => {
      const fields = $$('input, select, textarea', step);
      for (const f of fields) {
        const ok = f.checkValidity();
        f.setAttribute('aria-invalid', String(!ok));
        if (!ok) { f.reportValidity(); f.focus(); return false; }
      }
      return true;
    };
    $$('[data-next]', form).forEach((b) => b.addEventListener('click', () => { if (valid(steps[at])) go(at + 1); }));
    $$('[data-back]', form).forEach((b) => b.addEventListener('click', () => go(at - 1)));
    go(0, false);

    // ?service=slug preselects the service (links from each service page)
    const pre = new URLSearchParams(location.search).get('service');
    const select = $('select[name="service"]', form);
    if (pre && select && [...select.options].some((o) => o.value === pre)) select.value = pre;

    const files = $('[data-files]', form);
    const filesList = $('[data-files-list]', form);
    if (files && filesList) files.addEventListener('change', () => { filesList.textContent = [...files.files].map((f) => f.name).join(', '); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!valid(steps[at])) return;
      const say = (key) => { statusEl.textContent = statusEl.dataset[key]; };
      if (form.website && form.website.value) { say('ok'); form.reset(); return; } // honeypot
      if (!FORM_ENDPOINT) { console.warn('AUTAPLATE: FORM_ENDPOINT is empty in main.js — the form has nowhere to send.'); say('err'); return; }
      say('sending');
      try {
        const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(res.status);
        say('ok'); form.reset(); if (filesList) filesList.textContent = ''; go(0, false);
      } catch (err) { say('err'); }
    });
  }

  /* ---------------------------------------------------------------- map: load on click only */
  $$('[data-map]').forEach((map) => {
    const btn = $('[data-map-load]', map);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = map.dataset.mapSrc; f.title = btn.textContent; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
      map.replaceChildren(f);
    });
  });
  /* ---------------------------------------------------------------- recent work rail */
  const rail = $('[data-rail]');
  if (rail) {
    const step = (dir) => rail.scrollBy({ left: dir * rail.clientWidth * 0.8, behavior: reduced ? 'auto' : 'smooth' });
    const prev = $('[data-rail-prev]'), next = $('[data-rail-next]');
    if (prev) prev.addEventListener('click', () => step(-1));
    if (next) next.addEventListener('click', () => step(1));
  }

  /* ---------------------------------------------------------------- cursor label (fine pointers only) */
  if (!reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches && $('[data-cursor]')) {
    const cur = document.createElement('div');
    cur.className = 'cursor'; cur.setAttribute('aria-hidden', 'true');
    document.body.append(cur);
    let x = -200, y = -200, raf = 0;
    const paint = () => { cur.style.setProperty('--cx', `${x}px`); cur.style.setProperty('--cy', `${y}px`); raf = 0; };
    document.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-cursor]');
      if (t) { cur.textContent = t.dataset.cursor; cur.classList.add('is-on'); }
    });
    document.addEventListener('mouseout', (e) => {
      const t = e.target.closest('[data-cursor]');
      if (t && !t.contains(e.relatedTarget)) cur.classList.remove('is-on');
    });
  }
  /* ---------------------------------------------------------------- stacking proof cards (mobile) */
  const proof = $('[data-proof]');
  if (proof && !reduced) {
    const cards = $$('.proof-card', proof);
    const mq = window.matchMedia('(max-width: 899px)');
    let tick = false;
    const cover = () => {
      tick = false;
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        let v = 0;
        if (mq.matches && next) {
          const a = card.getBoundingClientRect(), b = next.getBoundingClientRect();
          v = Math.min(1, Math.max(0, (a.bottom - b.top) / a.height));
        }
        card.style.setProperty('--cover', v.toFixed(3));
      });
    };
    window.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(cover); } }, { passive: true });
    window.addEventListener('resize', cover);
    cover();
  }

  /* ---------------------------------------------------------------- rail focus + progress */
  if (rail) {
    const items = $$('.rail-item', rail);
    const bar = $('[data-rail-bar]');
    let tick = false;
    const focus = () => {
      tick = false;
      const max = rail.scrollWidth - rail.clientWidth;
      if (bar) bar.style.setProperty('--p', (0.12 + 0.88 * (max > 0 ? rail.scrollLeft / max : 1)).toFixed(3));
      if (reduced) return;
      const anchor = rail.getBoundingClientRect().left + parseFloat(getComputedStyle(rail).paddingLeft);
      items.forEach((it) => {
        const d = Math.min(1, Math.abs(it.getBoundingClientRect().left - anchor) / it.offsetWidth);
        it.style.setProperty('--rs', (1 - d * 0.07).toFixed(3));
        it.style.setProperty('--ro', (1 - d * 0.45).toFixed(3));
      });
    };
    rail.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(focus); } }, { passive: true });
    window.addEventListener('resize', focus);
    focus();
  }

  /* ---------------------------------------------------------------- stat counters */
  const stats = $$('[data-count]');
  if (stats.length && !reduced && 'IntersectionObserver' in window) {
    const run = (el) => {
      const end = +el.dataset.count, t0 = performance.now(), dur = 800;
      const step = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(end * (1 - Math.pow(2, -10 * k))); if (k < 1) requestAnimationFrame(step); else el.textContent = end; };
      el.textContent = '0'; requestAnimationFrame(step);
    };
    const delay = { full: 1250, short: 520 }[root.getAttribute('data-loader')] || 0;
    const io2 = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { io2.unobserve(en.target); setTimeout(() => run(en.target), en.time < 2000 ? delay : 0); } }), { threshold: 0.4 });
    stats.forEach((el) => io2.observe(el));
  }
})();
