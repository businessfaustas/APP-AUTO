/* AUTAPLATE — shared script. Vanilla, no dependencies. */

/* ------------------------------------------------------------------
   FORM_ENDPOINT — where the quote form and the quick enquiry forms send.
   Web3Forms (https://web3forms.com): the access key is a hidden field in
   each form, written by the page generator. While this is empty the forms
   do not send and show the "please call" message instead.
   ------------------------------------------------------------------ */
const FORM_ENDPOINT = 'https://api.web3forms.com/submit';

(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------------------------------------------------------------- send a form to FORM_ENDPOINT (Web3Forms)
     Resolves on success, throws on any failure. Without files it posts JSON, as the Web3Forms
     docs do; with files (Pro plan only) it posts the form as multipart. */
  const sendForm = async (f) => {
    const fd = new FormData(f);
    const sel = $('select[name="service"]', f);              // the email gets the service name, not its URL slug
    if (sel && sel.selectedIndex > 0) fd.set('service', sel.options[sel.selectedIndex].text);
    const radio = $('input[name="service"]:checked', f);    // contact page: service picture tiles
    if (radio && radio.dataset.label) fd.set('service', radio.dataset.label);
    fd.set('puslapis', location.href.split('#')[0]);        // which page the enquiry came from
    const files = [...fd.entries()].filter(([, v]) => v instanceof File);
    const hasFiles = files.some(([, v]) => v.size);
    if (!hasFiles) files.forEach(([k]) => fd.delete(k));
    const res = await fetch(FORM_ENDPOINT, hasFiles
      ? { method: 'POST', body: fd, headers: { Accept: 'application/json' } }
      : { method: 'POST', body: JSON.stringify(Object.fromEntries(fd)), headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.message || `HTTP ${res.status}`);
  };

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
      // keep the chip in view sideways only: scrollIntoView would also scroll the page to the folded panel's top
      const row = chip.closest('ul'), li = chip.parentElement;
      if (row && row.scrollWidth > row.clientWidth) row.scrollTo({ left: li.offsetLeft - (row.clientWidth - li.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
      const jobs = $$('.job', grid);
      let n = 0;
      const show = [], hide = [];
      jobs.forEach((job) => { const on = f === 'all' || job.dataset.service === f; if (on) { n++; show.push(job); } else hide.push(job); });
      const swap = () => {
        hide.forEach((j) => { j.hidden = true; j.classList.remove('is-out'); });
        show.forEach((j) => { const was = j.hidden; j.hidden = false; j.classList.add('is-in'); if (was && !reduced) { j.classList.add('is-pre'); } });
        // reading inside the list: bring the first result up under the sticky panel
        const gTop = grid.getBoundingClientRect().top, fb = fl ? fl.getBoundingClientRect().bottom : 0;
        if (fl && gTop < fb) window.scrollTo({ top: window.scrollY + gTop - fb - 80, behavior: reduced ? 'auto' : 'smooth' });
        requestAnimationFrame(() => requestAnimationFrame(() => show.forEach((j, i) => { j.style.transitionDelay = `${Math.min(i, 8) * 40}ms`; j.classList.remove('is-pre'); })));
        setTimeout(() => show.forEach((j) => { j.style.transitionDelay = ''; }), 800);
      };
      if (reduced) swap();
      else { hide.forEach((j) => { if (!j.hidden) j.classList.add('is-out'); }); setTimeout(swap, 240); }
      if (status) status.textContent = `${n}`;
      ind(); countTo(n);
    }));

    // filter panel: a marker slides under the active chip and the count follows
    const flList = $('[data-fl-list]'), flCount = $('[data-fl-count]'), fl = $('[data-fl]');
    function ind() {
      const on = chips.find((c) => c.getAttribute('aria-pressed') === 'true');
      if (!on || !flList) return;
      const li = on.parentElement;
      flList.style.setProperty('--ix', `${li.offsetLeft}px`);
      flList.style.setProperty('--iw', `${li.offsetWidth}px`);
    }
    let shownN = flCount ? +flCount.textContent : 0;
    function countTo(n) {
      if (!flCount) return;
      const from = shownN, t0 = performance.now();
      shownN = n;
      if (reduced) { flCount.textContent = n; return; }
      const tickN = (t) => { const k = Math.min(1, (t - t0) / 420); flCount.textContent = Math.round(from + (n - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tickN); };
      requestAnimationFrame(tickN);
    }
    if (flList) {
      ind();
      if ('ResizeObserver' in window) new ResizeObserver(ind).observe(flList);
      window.addEventListener('resize', ind);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(ind);
    }
    if (fl) {
      // how much of the panel slides up under the header once it sticks: everything above the service names
      const fold = () => {
        const t = Math.max(...$$('.chip-n', fl).map((x) => x.getBoundingClientRect().bottom));
        fl.style.setProperty('--fold', `${Math.max(0, Math.round(t - fl.getBoundingClientRect().top + 6))}px`);
      };
      fold();
      window.addEventListener('resize', fold);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fold);
    }

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
    const dots = $$('[data-q-dot]', form);
    const go = (i, focus = true) => {
      form.dataset.dir = i < at ? 'b' : 'f';
      at = i;
      steps.forEach((s, n) => s.classList.toggle('is-active', n === i));
      if (progress) progress.textContent = `${pad(i + 1)} / ${pad(steps.length)}`;
      form.style.setProperty('--qp', ((i + 1) / steps.length).toFixed(3));
      dots.forEach((d, n) => { d.classList.toggle('is-on', n === i); d.classList.toggle('is-done', n < i); });
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
    const preRadio = pre && $$('input[name="service"]', form).find((r) => r.value === pre);
    if (preRadio) preRadio.checked = true;
    // a service tile clears its error mark as soon as one is picked
    $$('input[name="service"]', form).forEach((r) => r.addEventListener('change', () => $$('input[name="service"]', form).forEach((x) => x.removeAttribute('aria-invalid'))));

    // interest chips: toggle, and keep the list in a hidden field that goes out with the form
    const chipsOut = $('[data-chips-out]', form);
    const chipList = $$('[data-chip]', form);
    const syncChips = () => { if (chipsOut) chipsOut.value = chipList.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent).join(', '); };
    chipList.forEach((b) => b.addEventListener('click', () => { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); syncChips(); }));

    // after sending, the steps give way to a confirmation; "send another" brings them back
    const again = $('[data-q-again]', form);
    if (again) again.addEventListener('click', () => { form.classList.remove('is-sent'); go(0); });

    const files = $('[data-files]', form);
    const filesList = $('[data-files-list]', form);
    if (files && filesList) files.addEventListener('change', () => { filesList.textContent = [...files.files].map((f) => f.name).join(', '); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!valid(steps[at])) return;
      const say = (key) => { statusEl.textContent = statusEl.dataset[key]; };
      if (!FORM_ENDPOINT) { console.warn('AUTAPLATE: FORM_ENDPOINT is empty in main.js — the form has nowhere to send.'); say('err'); return; }
      const btn = $('button[type="submit"]', form); if (btn) btn.disabled = true;
      say('sending');
      try {
        await sendForm(form);
        say('ok'); form.reset(); if (filesList) filesList.textContent = '';
        chipList.forEach((b) => b.setAttribute('aria-pressed', 'false')); syncChips();
        go(0, false); form.classList.add('is-sent');
        const done = $('.q-done', form); if (done) { done.removeAttribute('aria-hidden'); form.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' }); }
      } catch (err) { console.warn('AUTAPLATE: form not sent —', err.message); say('err'); statusEl.textContent += ` (${err.message})`; }
      if (btn) btn.disabled = false;
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
  /* ---------------------------------------------------------------- AUTAPLATE showcase: fit word, letters rise, car glides in */
  const show = $('[data-showcase]');
  if (show) {
    const word = $('.showcase-word', show), stage = $('.showcase-stage', show);
    const fit = () => {
      word.style.fontSize = '100px';
      const w = word.scrollWidth || 1;
      word.style.fontSize = `${(100 * stage.clientWidth * 0.96) / w}px`;
      // stage = word (stretched by --sy) with the car's roof sitting halfway down it
      const sy = parseFloat(getComputedStyle(show).getPropertyValue('--sy')) || 1;
      const img = $('.showcase-car img', show);
      const carH = img && img.offsetWidth ? img.offsetWidth * (551 / 1248) : 0;
      stage.style.setProperty('--sh', `${Math.round(word.offsetHeight * sy * 0.5 + carH)}px`);
    };
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    window.addEventListener('resize', fit);
    if (reduced || !('IntersectionObserver' in window)) show.classList.add('is-in');
    else {
      const io3 = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { show.classList.add('is-in'); io3.disconnect(); } }), { threshold: 0.2 });
      io3.observe(show);
      let tick = false;
      const drive = () => {
        tick = false;
        const r = show.getBoundingClientRect(), vh = window.innerHeight;
        if (r.bottom < 0 || r.top > vh) return;
        const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
        const k = Math.min(1, p * 1.8);
        const ease = 1 - Math.pow(1 - k, 3);
        show.style.setProperty('--cx', `${((1 - ease) * 42).toFixed(2)}%`);
        word.style.setProperty('--wx', `${((0.5 - p) * 7).toFixed(2)}%`);
      };
      window.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(drive); } }, { passive: true });
      drive();
    }
  }
  /* ---------------------------------------------------------------- quick enquiry forms (every page) */
  $$('[data-quick]').forEach((qf) => {
    const st = $('[data-quick-status]', qf);
    const say = (k) => { if (st) st.textContent = qf.dataset[k]; };
    qf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bad = $$('input[required]', qf).find((f) => !f.checkValidity());
      $$('input[required]', qf).forEach((f) => f.setAttribute('aria-invalid', String(!f.checkValidity())));
      if (bad) { bad.reportValidity(); bad.focus(); return; }
      if (!FORM_ENDPOINT) { console.warn('AUTAPLATE: FORM_ENDPOINT is empty in main.js.'); say('err'); return; }
      const btn = $('button[type="submit"]', qf); if (btn) btn.disabled = true;
      say('sending');
      try {
        await sendForm(qf);
        say('ok'); qf.reset();
      } catch (err) { console.warn('AUTAPLATE: form not sent —', err.message); say('err'); if (st) st.textContent += ` (${err.message})`; }
      if (btn) btn.disabled = false;
    });
  });
  /* ---------------------------------------------------------------- 360° turntable: scroll scrubs a frame sequence */
  const spinEl = $('[data-spin]');
  if (spinEl) {
    const canvas = $('.spin-canvas', spinEl), ctx = canvas.getContext('2d');
    const n = +spinEl.dataset.frames || 120;
    const set = window.innerWidth < 800 ? 's' : 'l';
    if (set === 's') { canvas.width = 720; canvas.height = 405; }
    const src = (i) => `${spinEl.dataset.src}${set}/f${String(i + 1).padStart(3, '0')}.webp`;
    const frames = new Array(n);
    const notes = $$('[data-spin-note]', spinEl);
    const degEl = $('[data-spin-deg]', spinEl);
    let want = 0, drawn = -1, started = false;
    const draw = (i) => {
      // nearest frame that has finished loading
      for (let d = 0; d < n; d++) {
        for (const k of [i - d, i + d]) {
          const img = frames[k];
          if (img && img.complete && img.naturalWidth) { if (k !== drawn) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); drawn = k; } return; }
        }
      }
    };
    const load = () => {
      if (started) return; started = true;
      // coarse pass first (every 8th frame), then fill in, so scrubbing works early
      const order = [];
      for (let step of [8, 4, 2, 1]) for (let i = 0; i < n; i += step) if (!order.includes(i)) order.push(i);
      order.forEach((i, k) => { const img = new Image(); img.decoding = 'async'; img.onload = () => { if (Math.abs(i - want) <= 8) draw(want); }; setTimeout(() => { img.src = src(i); }, k < 16 ? 0 : 20 * k / 4); frames[i] = img; });
    };
    if ('IntersectionObserver' in window) {
      const io4 = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { load(); io4.disconnect(); } }, { rootMargin: '1200px 0px' });
      io4.observe(spinEl);
    } else load();
    let tick = false;
    const update = () => {
      tick = false;
      const r = spinEl.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const p = reduced ? 0 : Math.min(1, Math.max(0, -r.top / Math.max(travel, 1)));
      spinEl.style.setProperty('--p', p.toFixed(4));
      want = Math.min(n - 1, Math.round(p * (n - 1)));
      draw(want);
      if (degEl) degEl.textContent = Math.round(p * (+spinEl.dataset.span || 360));  // span = how far the clip actually orbits
      const a = Math.min(notes.length - 1, Math.floor(p * notes.length));
      notes.forEach((li, k) => li.classList.toggle('is-active', reduced || k === a));
    };
    window.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
  /* ---------------------------------------------------------------- scroll-scrubbed clips (drive-in, stripes)
     The section is tall and its inner box is sticky; scrolling through it sets --p (0→1) and picks
     the frame. Frames are WebP stills cut from the clip: <src>l/ for desktop, <src>s/ for phones. */
  const scrub = (sec, { canvasSel, endAt = 0.85, startAt = 0.5, onP }) => {
    const canvas = $(canvasSel, sec), ctx = canvas.getContext('2d');
    const n = +sec.dataset.frames;
    const set = window.innerWidth < 800 ? 's' : 'l';
    if (set === 's') { canvas.width = 768; canvas.height = 432; }
    const src = (i) => `${sec.dataset.src}${set}/f${String(i + 1).padStart(3, '0')}.webp`;
    const frames = new Array(n);
    let want = reduced ? n - 1 : 0, shown = -1;
    const ok = (im) => im && im.complete && im.naturalWidth;
    const draw = () => {
      // nearest frame that has loaded, so fast scrolling never shows a blank canvas
      let i = -1;
      for (let d = 0; d < n && i < 0; d++) { if (ok(frames[want - d])) i = want - d; else if (ok(frames[want + d])) i = want + d; }
      if (i < 0 || i === shown) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(frames[i], 0, 0, canvas.width, canvas.height); shown = i;
    };
    const load = (i) => { if (frames[i]) return; const im = new Image(); im.decoding = 'async'; im.onload = draw; im.src = src(i); frames[i] = im; };
    // first + last, then every 6th, then every 2nd, then the rest: the scrub works early and sharpens as frames arrive
    const order = [0, n - 1];
    for (const step of [6, 2, 1]) for (let i = 0; i < n; i += step) order.push(i);
    let started = false;
    const start = () => { if (!started) { started = true; order.forEach(load); } };
    new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) start(); }, { rootMargin: '150% 0px' }).observe(sec);
    if (reduced) { start(); if (onP) onP(1); return; }
    let tick = false;
    const run = () => {
      tick = false;
      const r = sec.getBoundingClientRect(), vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * startAt - r.top) / (r.height - vh + vh * startAt)));
      sec.style.setProperty('--p', p.toFixed(4));
      want = Math.min(n - 1, Math.round(Math.min(1, p / endAt) * (n - 1)));
      draw(); if (onP) onP(p);
    };
    window.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(run); } }, { passive: true });
    window.addEventListener('resize', run);
    run();
  };
  const dv = $('[data-dv]');
  if (dv) scrub(dv, { canvasSel: '.dv-canvas' });
  const st = $('[data-st]');
  if (st) {
    const steps = $$('[data-st-step]', st);
    // steps follow the clip: stripes come down, are laid over the car, then settle
    const at = [0, 0.36, 0.7];
    scrub(st, { canvasSel: '.st-canvas', endAt: 0.9, startAt: 0.35, onP: (p) => {
      let k = 0; at.forEach((v, i) => { if (p >= v) k = i; });
      steps.forEach((li, i) => { li.classList.toggle('is-on', i === k); li.classList.toggle('is-done', i < k); });
    } });
  }
  /* ---------------------------------------------------------------- hero: car and stripes follow the pointer (mouse only) */
  const hx = $('[data-hx]');
  if (hx && !reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let raf = 0, mx = 0, my = 0;
    hx.addEventListener('pointermove', (ev) => {
      const r = hx.getBoundingClientRect();
      mx = ((ev.clientX - r.left) / r.width) * 2 - 1; my = ((ev.clientY - r.top) / r.height) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; hx.style.setProperty('--mx', mx.toFixed(3)); hx.style.setProperty('--my', my.toFixed(3)); });
    });
    hx.addEventListener('pointerleave', () => { hx.style.setProperty('--mx', 0); hx.style.setProperty('--my', 0); });
  }
  /* ---------------------------------------------------------------- photos that zoom out as they scroll through the screen */
  const zooms = $$('[data-zoom]');
  /* ---------------------------------------------------------------- process: steps light up, counter and car follow */
  const pt = $('[data-pt]');
  const ptSteps = pt ? $$('[data-pt-step]', pt) : [];
  const ptCur = pt ? $('[data-pt-cur]', pt) : null;
  let ptIdx = -1;
  const scrollFx = () => {
    const vh = window.innerHeight;
    zooms.forEach((z) => {
      const r = z.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      z.style.setProperty('--z', Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))).toFixed(3));
    });
    if (pt && ptSteps.length) {
      const list = $('.pt-steps', pt).getBoundingClientRect(), line = vh * 0.55;
      const pp = Math.min(1, Math.max(0, (line - list.top) / list.height));
      pt.style.setProperty('--pp', pp.toFixed(4));
      let k = 0;
      ptSteps.forEach((li, i) => { if (li.getBoundingClientRect().top < line) k = i; });
      if (k !== ptIdx) {
        ptIdx = k;
        ptSteps.forEach((li, i) => { li.classList.toggle('is-on', i === k); li.classList.toggle('is-done', i < k); });
        if (ptCur) { ptCur.textContent = String(k + 1).padStart(2, '0'); ptCur.classList.remove('flip'); void ptCur.offsetWidth; ptCur.classList.add('flip'); }
      }
    }
  };
  if (reduced) { ptSteps.forEach((li) => li.classList.add('is-on')); }
  else if (zooms.length || pt) {
    let tk = false;
    window.addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(() => { tk = false; scrollFx(); }); } }, { passive: true });
    window.addEventListener('resize', scrollFx);
    scrollFx();
  }
  /* ---------------------------------------------------------------- recent work (home): vertical scroll slides the cards sideways
     Desktop: the section is pinned and as tall as the track's overflow, so 1px of scroll moves the
     track 1px; the track follows with a little inertia and leans into the movement. Phones: a swipe row. */
  const wk = $('[data-wk]');
  if (wk) {
    const view = $('[data-wk-view]', wk), track = $('[data-wk-track]', wk), word = $('.wk-word', wk), cur = $('[data-wk-cur]', wk);
    const cards = $$('.wk-card', track);
    const jobs = cards.filter((c) => !c.classList.contains('wk-all')).length;
    const wide = window.matchMedia('(min-width: 900px)');
    let pin = false, max = 0, target = 0, x = 0, raf = 0, idx = 0, padL = 0, tick = false;
    const setIdx = (k) => {
      if (k === idx || !cur) return;
      idx = k; cur.textContent = String(k + 1).padStart(2, '0');
      cur.classList.remove('flip'); void cur.offsetWidth; cur.classList.add('flip');
    };
    // --d: how far a card's centre is from the focus point, in screen widths (drives the photo parallax and fade)
    const paint = () => {
      const vw = window.innerWidth;
      const focus = pin ? vw / 2 : view.getBoundingClientRect().left + padL + cards[0].offsetWidth / 2;
      cards.forEach((c) => {
        const r = c.getBoundingClientRect();
        const d = Math.max(-1.2, Math.min(1.2, (r.left + r.width / 2 - focus) / vw));
        c.style.setProperty('--d', d.toFixed(3));
        c.style.setProperty('--ad', Math.abs(d).toFixed(3));
      });
    };
    const progress = (p) => { wk.style.setProperty('--wp', (0.08 + 0.92 * p).toFixed(3)); setIdx(Math.round(p * (jobs - 1))); };
    const loop = () => {
      raf = 0;
      x += (target - x) * 0.12;
      if (Math.abs(target - x) < 0.4) x = target;
      track.style.setProperty('--tx', x.toFixed(1));
      track.style.setProperty('--sk', Math.max(-5, Math.min(5, (x - target) * 0.012)).toFixed(2));
      if (word) word.style.setProperty('--wx', (-x * 0.3).toFixed(1));
      paint();
      if (x !== target) raf = requestAnimationFrame(loop);
    };
    const update = () => {
      tick = false;
      if (pin) {
        const r = wk.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
        target = p * max; progress(p);
        if (!raf) raf = requestAnimationFrame(loop);
      } else {
        const m = view.scrollWidth - view.clientWidth;
        progress(m > 0 ? view.scrollLeft / m : 0);
        if (!reduced) paint();
        if (word && !reduced) word.style.setProperty('--wx', (wk.getBoundingClientRect().top * 0.25).toFixed(1));
      }
    };
    const measure = () => {
      pin = wide.matches && !reduced;
      wk.classList.toggle('is-pin', pin);
      padL = parseFloat(getComputedStyle(view).paddingLeft) || 0;
      if (pin) {
        max = Math.max(0, track.scrollWidth - (view.clientWidth - 2 * padL));
        wk.style.setProperty('--wk-h', `${Math.round(max + window.innerHeight)}px`);
      } else {
        wk.style.removeProperty('--wk-h'); x = target = 0;
        track.style.removeProperty('--tx'); track.style.removeProperty('--sk');
      }
      update();
    };
    const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    view.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    // keyboard: tabbing to a card that sits off to the side scrolls the page until it is in view
    track.addEventListener('focusin', (ev) => {
      const card = pin && ev.target.closest('.wk-card');
      if (!card) return;
      const p = Math.min(1, Math.max(0, (card.offsetLeft - padL) / Math.max(1, max)));
      window.scrollTo({ top: wk.getBoundingClientRect().top + window.scrollY + p * (wk.offsetHeight - window.innerHeight), behavior: 'auto' });
    });
    measure();
  }
  /* ---------------------------------------------------------------- page heroes: --py = px scrolled past the hero top (parallax) */
  const pars = reduced ? [] : $$('[data-par]');
  if (pars.length) {
    let tkP = false;
    const par = () => {
      tkP = false;
      pars.forEach((el) => { const r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < window.innerHeight) el.style.setProperty('--py', Math.max(0, -r.top).toFixed(1)); });
    };
    window.addEventListener('scroll', () => { if (!tkP) { tkP = true; requestAnimationFrame(par); } }, { passive: true });
    par();
  }
  /* ---------------------------------------------------------------- about: the statement lights up word by word as it scrolls through */
  const say = $('[data-say]');
  if (say) {
    const words = $$('.w', say);
    if (reduced) words.forEach((w) => w.classList.add('is-lit'));
    else {
      let tkS = false, lit = -1;
      const light = () => {
        tkS = false;
        const r = say.getBoundingClientRect(), vh = window.innerHeight;
        const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height * 0.9 + vh * 0.35)));
        const k = Math.round(p * words.length);
        if (k === lit) return;
        lit = k;
        words.forEach((w, i) => w.classList.toggle('is-lit', i < k));
      };
      window.addEventListener('scroll', () => { if (!tkS) { tkS = true; requestAnimationFrame(light); } }, { passive: true });
      light();
    }
  }
  /* ---------------------------------------------------------------- cards that tilt toward the pointer (mouse only) */
  if (!reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('[data-tilt]').forEach((el) => {
      let rafT = 0, tx = 0, ty = 0;
      el.addEventListener('pointermove', (ev) => {
        const r = el.getBoundingClientRect();
        tx = ((ev.clientX - r.left) / r.width) * 2 - 1; ty = ((ev.clientY - r.top) / r.height) * 2 - 1;
        if (!rafT) rafT = requestAnimationFrame(() => { rafT = 0; el.style.setProperty('--tx', tx.toFixed(3)); el.style.setProperty('--ty', ty.toFixed(3)); });
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--tx', 0); el.style.setProperty('--ty', 0); });
    });
  }
  /* ---------------------------------------------------------------- shop: cart in localStorage, checkout via /api/checkout */
  const CART_KEY = 'ap-cart';
  const readCart = () => { try { const c = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(c) ? c : []; } catch (e) { return []; } };
  const saveCart = (c) => { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) { /* private mode: cart lives for this page only */ } paintCount(c); };
  const paintCount = (c = readCart()) => {
    const n = c.reduce((s, l) => s + l.qty, 0);
    $$('[data-cart-count]').forEach((el) => { el.textContent = n; el.hidden = !n; });
  };
  paintCount();
  const catEl = $('#catalog');
  const CAT = catEl ? JSON.parse(catEl.textContent) : null;
  const lang = root.lang === 'en' ? 'en' : 'lt';
  const money = (c) => { const v = (c / 100).toFixed(2); return lang === 'lt' ? `${v.replace('.', ',')} €` : `€${v}`; };
  const prod = (id) => CAT && CAT.products.find((p) => p.id === id);
  const lineInfo = (l) => {
    const p = prod(l.id); if (!p) return null;
    let unit = 0; const picked = [];
    for (const o of p.options) {
      const v = o.values.find((x) => x.id === (l.opts || {})[o.key]); if (!v) return null;
      unit += v.price; picked.push(v.label || v[lang]);
    }
    return { p, unit, picked };
  };

  // product page
  const addForm = $('[data-add]');
  if (addForm && CAT) {
    const p = prod($('[data-product]').dataset.product);
    const priceEl = $('[data-pd-price]'), qtyIn = addForm.qty, st = $('[data-add-status]', addForm);
    const opts = () => Object.fromEntries(p.options.map((o) => [o.key, (addForm.querySelector(`input[name="${o.key}"]:checked`) || {}).value]));
    const clampQty = () => { qtyIn.value = Math.min(50, Math.max(1, Math.floor(+qtyIn.value) || 1)); };
    const paint = () => { const i = lineInfo({ id: p.id, opts: opts() }); if (i && priceEl) priceEl.textContent = money(i.unit * (+qtyIn.value || 1)); };
    addForm.addEventListener('change', () => { clampQty(); paint(); });
    $$('[data-qty]', addForm).forEach((b) => b.addEventListener('click', () => { qtyIn.value = (+qtyIn.value || 1) + +b.dataset.qty; clampQty(); paint(); }));
    addForm.addEventListener('submit', (e) => {
      e.preventDefault(); clampQty();
      const o = opts(), cart = readCart(), key = JSON.stringify(o);
      const hit = cart.find((l) => l.id === p.id && JSON.stringify(l.opts) === key);
      if (hit) hit.qty = Math.min(50, hit.qty + +qtyIn.value); else cart.push({ id: p.id, opts: o, qty: +qtyIn.value });
      saveCart(cart);
      st.innerHTML = `${addForm.dataset.ok} <a href="${addForm.dataset.cartUrl}">${addForm.dataset.view} →</a>`;
      $$('[data-cart-link]').forEach((a) => { a.classList.remove('bump'); void a.offsetWidth; a.classList.add('bump'); });
    });
    paint();
  }

  // cart + checkout page
  const cartEl = $('[data-cart]');
  if (cartEl && CAT) {
    const T = (k) => cartEl.dataset[k];
    const form = $('[data-checkout]', cartEl), list = $('[data-cart-list]', cartEl), st = $('[data-co-status]', cartEl);
    const params = new URLSearchParams(location.search);
    const done = (kind) => {
      saveCart([]); form.hidden = true; $('[data-cart-empty]', cartEl).hidden = true;
      $('[data-cart-done]', cartEl).hidden = false; $(`[data-done-${kind}]`, cartEl).hidden = false;
    };
    const shipSel = () => CAT.shipping.find((s) => s.id === (form.querySelector('input[name="shipping"]:checked') || {}).value) || CAT.shipping[0];
    const render = () => {
      // drop lines whose product or option no longer exists in the catalogue
      const cart = readCart().filter((l) => lineInfo(l));
      const empty = !cart.length;
      form.hidden = empty; $('[data-cart-empty]', cartEl).hidden = !empty;
      if (empty) return;
      list.innerHTML = cart.map((l, i) => {
        const { p, unit, picked } = lineInfo(l);
        return `<li class="cart-line">
          <img src="../images/shop/${p.image}-600.webp" width="96" height="96" alt="">
          <div class="cart-line-info"><a href="shop/${p.id}.html">${p[lang].name}</a><span class="small muted">${picked.join(' · ')} · ${money(unit)} ${T('tEach')}</span></div>
          <div class="qty qty-sm" role="group"><button type="button" data-line="${i}" data-d="-1" aria-label="−">−</button><output>${l.qty}</output><button type="button" data-line="${i}" data-d="1" aria-label="+">+</button></div>
          <span class="cart-line-total">${money(unit * l.qty)}</span>
          <button type="button" class="cart-x" data-rm="${i}" aria-label="${T('tRemove')}">×</button>
        </li>`;
      }).join('');
      const sub = cart.reduce((s, l) => s + lineInfo(l).unit * l.qty, 0), sh = shipSel();
      $('[data-sum-sub]', cartEl).textContent = money(sub);
      $('[data-sum-ship]', cartEl).textContent = sh.price ? money(sh.price) : T('tFree');
      $('[data-sum-total]', cartEl).textContent = money(sub + sh.price);
      $('[data-pay-total]', cartEl).textContent = `· ${money(sub + sh.price)}`;
      $$('[data-need]', form).forEach((el) => { el.hidden = el.dataset.need !== sh.needs; });
    };
    list.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const cart = readCart().filter((l) => lineInfo(l));
      if (b.dataset.rm) cart.splice(+b.dataset.rm, 1);
      else if (b.dataset.line) { const l = cart[+b.dataset.line]; l.qty = Math.min(50, l.qty + +b.dataset.d); if (l.qty < 1) cart.splice(+b.dataset.line, 1); }
      saveCart(cart); render();
    });
    form.addEventListener('change', (e) => { if (e.target.name === 'shipping') render(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sh = shipSel();
      const req = { name: 1, email: 1, phone: 1, consent: 1 };
      if (sh.needs === 'locker') req.locker = 1;
      if (sh.needs === 'address') Object.assign(req, { address: 1, city: 1, zip: 1 });
      let bad = null;
      $$('input', form).forEach((f) => {
        if (!f.name || !(f.name in req)) { f.removeAttribute('aria-invalid'); return; }
        const ok = f.type === 'checkbox' ? f.checked : f.value.trim() !== '' && f.checkValidity();
        f.setAttribute('aria-invalid', String(!ok)); if (!ok && !bad) bad = f;
      });
      if (bad) { bad.focus(); if (bad.type !== 'checkbox') bad.reportValidity(); return; }
      const fd = new FormData(form), customer = {};
      ['name', 'email', 'phone', 'locker', 'address', 'city', 'zip', 'note'].forEach((k) => { customer[k] = (fd.get(k) || '').toString().trim(); });
      const payBtn = $('.cart-pay', form); payBtn.disabled = true; st.textContent = T('tSending');
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lang, items: readCart(), shipping: sh.id, customer, website: fd.get('website') || '' }),
        });
        // a plain static server (local preview) has no /api: treat it like test mode
        if (res.status === 404 || res.status === 405 || res.status === 501) { done('test'); return; }
        const data = await res.json();
        if (data.url) { location.href = data.url; return; }
        if (data.test) { done('test'); return; }
        throw new Error(data.error || res.status);
      } catch (err) { st.textContent = T('tErr'); payBtn.disabled = false; }
    });
    if (params.get('paid')) done('paid');
    else { render(); if (params.get('cancelled')) st.textContent = T('tCancelled'); }
  }
})();
