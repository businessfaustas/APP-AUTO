/* AUTAPLATE /admin — upload page. Talks to /api/admin/* (admin-api.js).
   Photos are shrunk in the browser (max 2400 px, JPEG) so phone uploads stay small;
   the final crops/sizes are made later by tools/build.mjs. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  const TXT = {
    lt: {
      loginTitle: 'Nuotraukų įkėlimas', loginLead: 'Įveskite slaptažodį, kad galėtumėte įkelti nuotraukas į svetainę.', password: 'Slaptažodis', login: 'Prisijungti', logout: 'Atsijungti',
      title: 'Įkelti į svetainę', lead: 'Pasirinkite, ką įkeliate, įmeskite nuotraukas ir paspauskite „Įkelti“. Likusį darbą atlieka svetainė – naujas įrašas atsiras maždaug po 2–3 minučių.',
      step1: 'Ką įkeliate?', step2: 'Nuotraukos ir informacija', drop: 'Įmeskite nuotraukas čia', dropOr: 'arba paspauskite ir pasirinkite iš telefono / kompiuterio',
      optional: 'nebūtina', nameLt: 'Pavadinimas (lietuviškai)', nameEn: 'Pavadinimas (angliškai)', descLt: 'Trumpas aprašymas (lietuviškai)', descEn: 'Trumpas aprašymas (angliškai)',
      thickness: 'Storis, mm', height: 'Ilgis, cm', width: 'Plotis, cm', fit: 'Kaip tilpinti nuotrauką į kvadratą', fitAuto: 'Automatiškai', fitPad: 'Visa nuotrauka (su fonu)', fitCrop: 'Apkirpti',
      car: 'Automobilis', carEn: 'Automobilis (angliškai)', cropNote: 'Nuotraukos automatiškai apkarpomos iki 4:3, kaip kituose darbuose. Pirma nuotrauka rodoma kortelėje.',
      send: 'Įkelti į svetainę', doneTitle: 'Gauta!', doneText: 'Nuotraukos išsiųstos. Svetainė atsinaujins per maždaug 2–3 minutes.', again: 'Įkelti dar vieną',
      recent: 'Paskutiniai įkėlimai', none: 'Kol kas nieko nėra.', del: 'Ištrinti', delAsk: (t) => `Ištrinti „${t}“ iš svetainės?`,
      grpShop: 'Parduotuvė', grpWork: 'Darbų galerija', badge: 'Emblemos (parduotuvė)', badgeSub: 'Nauja emblema su matmenimis',
      hintBadge: 'Viena nuotrauka', hintWork: (n) => `Iki ${n} nuotraukų`, kindBadge: 'Emblema', pending: (n) => `Laukia publikavimo: ${n}`,
      wrongPw: 'Neteisingas slaptažodis.', notConfigured: 'Įkėlimas dar nesukonfigūruotas (trūksta slaptų raktų Cloudflare).',
      needType: 'Pirmiausia pasirinkite, ką įkeliate.', needPhoto: 'Pridėkite bent vieną nuotrauką.', needName: 'Įrašykite pavadinimą.', needCar: 'Įrašykite automobilio pavadinimą.', needSize: 'Įrašykite storį, ilgį ir plotį skaičiais (pvz. 0,2).',
      readFail: 'Nepavyko perskaityti nuotraukos. Bandykite JPG arba PNG.', tooMany: (n) => `Daugiausia ${n} nuotraukų.`,
      sending: 'Siunčiama…', e_github: 'Nepavyko išsaugoti. Bandykite dar kartą po minutės.', e_too_big: 'Nuotraukos per didelės.', e_generic: 'Nepavyko įkelti. Bandykite dar kartą.', e_net: 'Nėra ryšio. Patikrinkite internetą.', remove: 'Pašalinti nuotrauką', first: 'PIRMA',
    },
    en: {
      loginTitle: 'Photo upload', loginLead: 'Enter the password to upload photos to the website.', password: 'Password', login: 'Log in', logout: 'Log out',
      title: 'Upload to the website', lead: 'Choose what you are uploading, drop in the photos and press “Upload”. The site does the rest – the new entry appears in about 2–3 minutes.',
      step1: 'What are you uploading?', step2: 'Photos and details', drop: 'Drop photos here', dropOr: 'or tap to choose from your phone / computer',
      optional: 'optional', nameLt: 'Name (Lithuanian)', nameEn: 'Name (English)', descLt: 'Short description (Lithuanian)', descEn: 'Short description (English)',
      thickness: 'Thickness, mm', height: 'Height, cm', width: 'Width, cm', fit: 'How to fit the photo into a square', fitAuto: 'Automatic', fitPad: 'Whole photo (with backdrop)', fitCrop: 'Crop',
      car: 'Car', carEn: 'Car (English)', cropNote: 'Photos are cropped to 4:3 automatically, like the other jobs. The first photo is the card image.',
      send: 'Upload to the website', doneTitle: 'Received!', doneText: 'Photos sent. The website updates in about 2–3 minutes.', again: 'Upload another',
      recent: 'Recent uploads', none: 'Nothing yet.', del: 'Delete', delAsk: (t) => `Delete “${t}” from the website?`,
      grpShop: 'Shop', grpWork: 'Work gallery', badge: 'Emblems (shop)', badgeSub: 'New emblem with dimensions',
      hintBadge: 'One photo', hintWork: (n) => `Up to ${n} photos`, kindBadge: 'Emblem', pending: (n) => `Waiting to be published: ${n}`,
      wrongPw: 'Wrong password.', notConfigured: 'Uploads are not set up yet (secret keys missing in Cloudflare).',
      needType: 'Choose what you are uploading first.', needPhoto: 'Add at least one photo.', needName: 'Enter a name.', needCar: 'Enter the car name.', needSize: 'Enter thickness, height and width as numbers (e.g. 0.2).',
      readFail: 'Could not read the photo. Try JPG or PNG.', tooMany: (n) => `At most ${n} photos.`,
      sending: 'Sending…', e_github: 'Could not save. Try again in a minute.', e_too_big: 'Photos are too large.', e_generic: 'Upload failed. Try again.', e_net: 'No connection. Check your internet.', remove: 'Remove photo', first: 'FIRST',
    },
  };
  const MAX_WORK = 12, LONG_EDGE = 2400;
  let lang = 'lt'; try { lang = localStorage.getItem('ap-admin-lang') || ((navigator.language || '').startsWith('lt') ? 'lt' : 'en'); } catch { /* ignore */ }
  const t = (k, ...a) => { const v = TXT[lang][k]; return typeof v === 'function' ? v(...a) : v; };
  const S = { key: '', name: '', type: '', services: [], photos: [], busy: false };

  /* ---------- text ---------- */
  function applyText() {
    document.documentElement.lang = lang;
    $$('[data-t]').forEach((el) => { const v = TXT[lang][el.dataset.t]; if (typeof v === 'string') el.textContent = v; });
    $('#lang').textContent = lang === 'lt' ? 'EN' : 'LT';
    renderTypes(); renderThumbs(); hint(); if (S.key) loadRecent();
  }

  /* ---------- API ---------- */
  async function api(path, opt = {}) {
    let r;
    try { r = await fetch(`/api/admin/${path}`, { ...opt, headers: { ...(opt.headers || {}), 'x-admin-key': S.key } }); }
    catch { return { ok: false, error: 'net' }; }
    let b = {}; try { b = await r.json(); } catch { /* ignore */ }
    return { ok: r.ok, status: r.status, ...b };
  }

  /* ---------- login ---------- */
  function showApp(on) {
    $('#login').hidden = on; $('#app').hidden = !on; $('#logout').hidden = !on; $('#who').hidden = !on;
    if (on) $('#who').textContent = S.name;
  }
  async function tryLogin(pw, silent) {
    S.key = pw;
    const r = await api('login', { method: 'POST' });
    if (r.ok) {
      S.name = r.name; try { sessionStorage.setItem('ap-admin-key', pw); } catch { /* ignore */ }
      showApp(true); await loadServices(); loadRecent(); return;
    }
    S.key = ''; try { sessionStorage.removeItem('ap-admin-key'); } catch { /* ignore */ }
    if (!silent) $('#loginErr').textContent = r.error === 'not_configured' ? t('notConfigured') : r.error === 'net' ? t('e_net') : t('wrongPw');
  }
  $('#loginForm').addEventListener('submit', (e) => { e.preventDefault(); $('#loginErr').textContent = ''; const v = $('#pw').value; if (v) tryLogin(v, false); });
  $('#logout').addEventListener('click', () => { try { sessionStorage.removeItem('ap-admin-key'); } catch { /* ignore */ } location.reload(); });
  $('#lang').addEventListener('click', () => { lang = lang === 'lt' ? 'en' : 'lt'; try { localStorage.setItem('ap-admin-lang', lang); } catch { /* ignore */ } applyText(); });

  /* ---------- service types ---------- */
  async function loadServices() {
    try { S.services = (await (await fetch('../data/services.json', { cache: 'no-cache' })).json()).services; } catch { S.services = []; }
    renderTypes();
  }
  function renderTypes() {
    const box = $('#types'); if (!box) return;
    const keep = S.type;
    const opt = (v, label, extra = '') => `<label class="type ${extra}"><input type="radio" name="type" value="${v}"${v === keep ? ' checked' : ''}><span>${label}</span></label>`;
    box.innerHTML = `<legend class="sr">${t('step1')}</legend><p class="grp">${t('grpShop')}</p>`
      + opt('badge', `<b>${t('badge')}</b><small>${t('badgeSub')}</small>`, 'shop')
      + `<p class="grp">${t('grpWork')}</p>` + S.services.map((s) => opt(s.id, esc(s[lang]))).join('');
    $$('input[name=type]', box).forEach((i) => i.addEventListener('change', () => chooseType(i.value)));
  }
  function chooseType(v) {
    S.type = v; $('#form').hidden = false; $('#done').hidden = true;
    const badge = v === 'badge';
    $$('[data-for]').forEach((el) => { el.hidden = el.dataset.for !== (badge ? 'badge' : 'work'); });
    if (badge && S.photos.length > 1) S.photos.length = 1;
    renderThumbs(); hint(); $('#formErr').textContent = '';
    $('#form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function hint() { $('#dropHint').textContent = S.type === 'badge' ? t('hintBadge') : S.type ? t('hintWork', MAX_WORK) : ''; }

  /* ---------- photos ---------- */
  async function shrink(file) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    }
    const w = bmp.width, h = bmp.height, k = Math.min(1, LONG_EDGE / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.88));
    if (!blob) throw new Error('encode');
    return { blob, url: URL.createObjectURL(blob), ratio: w / h };
  }
  async function addFiles(list) {
    $('#photoErr').textContent = '';
    if (!S.type) { $('#photoErr').textContent = t('needType'); return; }
    const max = S.type === 'badge' ? 1 : MAX_WORK;
    let files = [...list].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (S.type === 'badge') { S.photos = []; files = files.slice(0, 1); }
    for (const f of files) {
      if (S.photos.length >= max) { $('#photoErr').textContent = t('tooMany', max); break; }
      try { S.photos.push(await shrink(f)); } catch { $('#photoErr').textContent = t('readFail'); }
      renderThumbs();
    }
  }
  function renderThumbs() {
    const ul = $('#thumbs'); const badge = S.type === 'badge';
    const fit = ($('input[name=fit]:checked') || {}).value || 'auto';
    ul.className = 'thumbs' + (badge ? ' sq' : '');
    ul.innerHTML = '';
    S.photos.forEach((p, i) => {
      const li = document.createElement('li');
      const pad = badge && (fit === 'pad' || (fit === 'auto' && Math.abs(p.ratio - 1) >= 0.12));
      li.className = pad ? 'pad' : '';
      li.innerHTML = `<img alt="" src="${p.url}"${pad ? ' style="object-fit:contain"' : ''}>`
        + (i === 0 && !badge && S.photos.length > 1 ? `<span class="first">${t('first')}</span>` : '')
        + `<button type="button" aria-label="${t('remove')}">×</button>`;
      $('button', li).addEventListener('click', () => { URL.revokeObjectURL(p.url); S.photos.splice(i, 1); renderThumbs(); });
      ul.appendChild(li);
    });
  }
  $('#file').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  $$('input[name=fit]').forEach((r) => r.addEventListener('change', renderThumbs));
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  /* ---------- send ---------- */
  const num = (s) => /^\d{1,3}([.,]\d{1,2})?$/.test(String(s).trim());
  function validate() {
    $$('.invalid').forEach((e) => e.classList.remove('invalid'));
    const bad = (sel, msg) => { $(sel).classList.add('invalid'); $(sel).focus(); return msg; };
    if (!S.type) return t('needType');
    if (!S.photos.length) return t('needPhoto');
    if (S.type === 'badge') {
      if (!$('#nameLt').value.trim()) return bad('#nameLt', t('needName'));
      for (const id of ['#sT', '#sH', '#sW']) if (!num($(id).value)) return bad(id, t('needSize'));
    } else if (!$('#carLt').value.trim()) return bad('#carLt', t('needCar'));
    return '';
  }
  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault(); if (S.busy) return;
    const msg = validate(); $('#formErr').textContent = msg; if (msg) return;
    const badge = S.type === 'badge';
    const meta = badge
      ? { kind: 'badge', fit: ($('input[name=fit]:checked') || {}).value, lt: { name: $('#nameLt').value, desc: $('#descLt').value, short: '' }, en: { name: $('#nameEn').value, desc: $('#descEn').value, short: '' }, size: { thickness_mm: $('#sT').value, height_cm: $('#sH').value, width_cm: $('#sW').value } }
      : { kind: 'work', service: S.type, car: { lt: $('#carLt').value, en: $('#carEn').value } };
    const fd = new FormData(); fd.set('meta', JSON.stringify(meta));
    S.photos.forEach((p, i) => fd.set(`photo${i}`, p.blob, `${i + 1}.jpg`));
    S.busy = true; $('#send').disabled = true; $('#progress').textContent = t('sending');
    const r = await api('upload', { method: 'POST', body: fd });
    S.busy = false; $('#send').disabled = false; $('#progress').textContent = '';
    if (r.ok) { $('#form').hidden = true; $('#done').hidden = false; $('#done').scrollIntoView({ behavior: 'smooth', block: 'center' }); loadRecent(); return; }
    if (r.status === 401) { location.reload(); return; }
    $('#formErr').textContent = r.error === 'too_big' ? t('e_too_big') : r.error === 'github' ? t('e_github') : r.error === 'net' ? t('e_net') : t('e_generic');
  });
  $('#again').addEventListener('click', () => {
    S.photos.forEach((p) => URL.revokeObjectURL(p.url)); S.photos = [];
    $$('#form input[type=text], #form input:not([type]), #form textarea').forEach((i) => { i.value = ''; });
    renderThumbs(); $('#done').hidden = true; $('#form').hidden = false; $('#form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- recent + delete ---------- */
  async function loadRecent() {
    const r = await api('list');
    if (!r.ok) return;
    const ul = $('#recent'); ul.innerHTML = '';
    $('#recentEmpty').hidden = r.items.length > 0;
    $('#pending').hidden = !r.pending; if (r.pending) $('#pending').textContent = t('pending', r.pending);
    const svc = Object.fromEntries(S.services.map((s) => [s.id, s[lang]]));
    for (const it of r.items) {
      const li = document.createElement('li');
      const d = it.at ? new Date(it.at).toLocaleDateString(lang === 'lt' ? 'lt-LT' : 'en-GB') : '';
      const info = document.createElement('div');
      const b = document.createElement('b'); b.textContent = it.title || it.id;
      const sm = document.createElement('small'); sm.textContent = `${it.kind === 'badge' ? t('kindBadge') : svc[it.service] || it.service} · ${d} · ${it.by || ''}`;
      info.append(b, sm);
      const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = t('del');
      btn.addEventListener('click', async () => {
        if (!confirm(t('delAsk', it.title || it.id))) return;
        btn.disabled = true; const x = await api('delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: it.id }) });
        if (x.ok) li.remove(); else { btn.disabled = false; alert(t('e_generic')); }
      });
      li.append(info, btn); ul.appendChild(li);
    }
  }

  /* ---------- start ---------- */
  applyText();
  let saved = ''; try { saved = sessionStorage.getItem('ap-admin-key') || ''; } catch { /* ignore */ }
  if (saved) tryLogin(saved, true);
})();
