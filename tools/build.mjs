#!/usr/bin/env node
/* AUTAPLATE — upload build step (runs in GitHub Actions, or locally: `node tools/build.mjs`).

   1. Reads queued uploads from data/queue/*.json (written by the /admin page via the Worker).
   2. Makes the final images with sharp, updates data/products.json and data/uploads.json.
   3. Rebuilds the generated pages: every emblem page (LT + EN), the shop grids, the work
      gallery (between the "uploads:start/end" markers), all counters and sitemap.xml.

   It is idempotent: with an empty queue it only re-derives what is already on disk.
   Everything typed by a person is HTML-escaped before it goes into a page. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SITE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const read = (f) => fs.readFileSync(P(f), 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(P(f)), { recursive: true }); fs.writeFileSync(P(f), s); };
const exists = (f) => fs.existsSync(P(f));
const readJson = (f, d) => (exists(f) ? JSON.parse(read(f)) : d);
const writeJson = (f, o) => write(f, JSON.stringify(o, null, 2) + '\n');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LANGS = ['lt', 'en'];
const warn = (m) => console.log(`::warning::${m}`);

const ID_RE = /^[a-z0-9][a-z0-9-]{1,70}$/;
const NUM_RE = /^\d{1,3}([.,]\d{1,2})?$/;
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

const services = readJson('data/services.json', { services: [] }).services;
const svcById = Object.fromEntries(services.map((s) => [s.id, s]));

/* ------------------------------------------------------------------ images (sharp) */
let sharp = null;
async function getSharp() {
  if (!sharp) sharp = (await import('sharp')).default;
  return sharp;
}

async function badgeImages(srcFile, id, fit) {
  const sh = await getSharp();
  const meta = await sh(srcFile).rotate().metadata();
  const base = sh(srcFile).rotate();
  const w = meta.width, h = meta.height;
  const squarish = Math.abs(w / h - 1) < 0.12;
  const mode = fit === 'crop' || (fit !== 'pad' && squarish) ? 'crop' : 'pad';
  const S = 1000;
  let out;
  if (mode === 'crop') {
    out = await base.clone().resize(S, S, { fit: 'cover' }).toBuffer();
  } else {
    // whole photo kept; the empty space is filled with a blurred, darkened copy of itself
    const bg = await base.clone().resize(S, S, { fit: 'cover' }).blur(40).modulate({ brightness: 0.8 }).toBuffer();
    let fg = await base.clone().resize(S, S, { fit: 'inside' }).ensureAlpha().toBuffer();
    // feather the photo's edges into the backdrop so no seam shows
    const fm = await sh(fg).metadata();
    const f = Math.round(Math.min(fm.width, fm.height) * 0.12);
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${fm.width}" height="${fm.height}"><defs><linearGradient id="g" x1="0" y1="0" x2="${fm.width < fm.height ? 1 : 0}" y2="${fm.width < fm.height ? 0 : 1}"><stop offset="0" stop-color="#000"/><stop offset="${(f / (fm.width < fm.height ? fm.width : fm.height)).toFixed(3)}" stop-color="#fff"/><stop offset="${(1 - f / (fm.width < fm.height ? fm.width : fm.height)).toFixed(3)}" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
    fg = await sh(fg).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    out = await sh(bg).composite([{ input: fg, gravity: 'centre' }]).toBuffer();
  }
  await sh(out).jpeg({ quality: 90 }).toFile(P(`images/originals/shop-${id}.jpg`));
  for (const z of [600, 1000]) {
    await sh(out).resize(z, z).webp({ quality: 82 }).toFile(P(`images/shop/${id}-${z}.webp`));
  }
}

async function workImages(srcFile, id, n) {
  const sh = await getSharp();
  for (const w of [600, 1200, 2000]) {
    const out = P(`images/uploads/${id}-${n}-${w}.jpg`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await sh(srcFile).rotate().resize(w, Math.round((w * 3) / 4), { fit: 'cover' }).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(out);
  }
}

/* ------------------------------------------------------------------ queue */
function sideOption() {
  const prods = readJson('data/products.json').products;
  const t = prods.find((p) => p.options.length && p.options[0].key === 'side');
  return JSON.parse(JSON.stringify(t.options.filter((o) => o.key === 'side')));
}

function validateItem(it) {
  if (!it || typeof it !== 'object') return 'not an object';
  if (it.op === 'delete') return ID_RE.test(it.id || '') ? null : 'bad id';
  if (it.op !== 'add') return 'bad op';
  if (!ID_RE.test(it.id || '')) return 'bad id';
  if (it.kind === 'badge') {
    if (!clean(it.lt?.name, 80)) return 'missing name';
    const s = it.size || {};
    for (const k of ['thickness_mm', 'height_cm', 'width_cm']) if (!NUM_RE.test(String(s[k] ?? ''))) return `bad size ${k}`;
    return null;
  }
  if (it.kind === 'work') {
    if (!svcById[it.service]) return 'unknown service';
    if (!clean(it.car?.lt, 80)) return 'missing car';
    if (!(it.photos >= 1 && it.photos <= 12)) return 'bad photo count';
    return null;
  }
  return 'bad kind';
}

async function processQueue() {
  const dir = P('data/queue');
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const products = readJson('data/products.json');
  const log = readJson('data/uploads.json', { items: [] });
  let done = 0;

  for (const f of files) {
    const full = path.join(dir, f);
    let it;
    try { it = JSON.parse(fs.readFileSync(full, 'utf8')); } catch { warn(`${f}: invalid JSON, dropped`); fs.unlinkSync(full); continue; }
    const problem = validateItem(it);
    if (problem) { warn(`${f}: ${problem}, dropped`); fs.unlinkSync(full); continue; }
    const by = clean(it.by, 40) || 'admin';
    const at = clean(it.at, 40) || new Date().toISOString();

    if (it.op === 'delete') {
      const entry = log.items.find((x) => x.id === it.id);
      if (!entry) { warn(`${f}: ${it.id} was not added through /admin, nothing deleted`); fs.unlinkSync(full); continue; }
      if (entry.kind === 'badge') {
        products.products = products.products.filter((p) => p.id !== it.id);
        for (const l of LANGS) fs.rmSync(P(`${l}/shop/${it.id}.html`), { force: true });
        for (const z of [600, 1000]) fs.rmSync(P(`images/shop/${it.id}-${z}.webp`), { force: true });
        fs.rmSync(P(`images/originals/shop-${it.id}.jpg`), { force: true });
      } else {
        for (const x of fs.readdirSync(P('images/uploads')).filter((n) => n.startsWith(`${it.id}-`))) fs.rmSync(P('images/uploads', x), { force: true });
      }
      log.items = log.items.filter((x) => x.id !== it.id);
      fs.unlinkSync(full); done++;
      console.log(`deleted ${it.kind || entry.kind} ${it.id}`);
      continue;
    }

    if (log.items.some((x) => x.id === it.id)) { warn(`${f}: id ${it.id} already exists, dropped`); fs.unlinkSync(full); continue; }
    const photoDir = path.join(dir, it.id);
    const src = (n) => path.join(photoDir, `${n}.jpg`);
    const count = it.kind === 'badge' ? 1 : it.photos;
    if (![...Array(count)].every((_, i) => fs.existsSync(src(i + 1)))) { warn(`${f}: photo files missing, dropped`); fs.unlinkSync(full); continue; }

    if (it.kind === 'badge') {
      if (products.products.some((p) => p.id === it.id)) { warn(`${f}: product ${it.id} exists, dropped`); fs.unlinkSync(full); continue; }
      await badgeImages(src(1), it.id, it.fit);
      const lt = { name: clean(it.lt.name, 80), short: clean(it.lt.short, 120) || 'Organinio stiklo emblema.', desc: clean(it.lt.desc, 400) };
      lt.desc = lt.desc || lt.short;
      const en = { name: clean(it.en?.name, 80) || lt.name, short: clean(it.en?.short, 120), desc: clean(it.en?.desc, 400) };
      en.short = en.short || (clean(it.en?.name, 80) ? 'Acrylic glass emblem.' : lt.short);
      en.desc = en.desc || en.short;
      const s = it.size;
      products.products.push({
        id: it.id, image: it.id, lt, en, options: sideOption(),
        size: { thickness_mm: String(s.thickness_mm).replace('.', ','), height_cm: String(s.height_cm).replace('.', ','), width_cm: String(s.width_cm).replace('.', ',') },
        uploaded: true,
      });
      log.items.push({ id: it.id, kind: 'badge', title: lt.name, at, by });
    } else {
      for (let n = 1; n <= count; n++) await workImages(src(n), it.id, n);
      const lt = clean(it.car.lt, 80);
      log.items.push({ id: it.id, kind: 'work', service: it.service, title: lt, car: { lt, en: clean(it.car.en, 80) || lt }, photos: count, at, by });
    }
    fs.rmSync(photoDir, { recursive: true, force: true });
    fs.unlinkSync(full); done++;
    console.log(`added ${it.kind} ${it.id}`);
  }
  if (done) { writeJson('data/products.json', products); writeJson('data/uploads.json', log); }
  return done;
}

/* ------------------------------------------------------------------ emblem pages */
const ALT = { lt: '– emblema ant juodo paviršiaus', en: '— emblem on a black surface' };

function specs(lang, p) {
  const s = p.size; const n = lang === 'lt' ? (v) => v : (v) => v.replace(',', '.');
  const rows = lang === 'lt'
    ? [['Storis', `${s.thickness_mm} mm`], ['Ilgis', `${s.height_cm} cm`], ['Plotis', `${s.width_cm} cm`], ['Medžiaga', 'Organinis stiklas'], ['Pristatymas', 'Omniva, DPD arba atsiėmimas'], ['Pagaminta', 'Klaipėdoje']]
    : [['Thickness', `${n(s.thickness_mm)} mm`], ['Height', `${n(s.height_cm)} cm`], ['Width', `${n(s.width_cm)} cm`], ['Material', 'Acrylic glass'], ['Delivery', 'Omniva, DPD or collection'], ['Made', 'In Klaipėda']];
  const fit = lang === 'lt' ? ['Montažas', 'Pateikiamas su dvipuse lipnumo juosta'] : ['Fitting', 'Supplied with double-sided adhesive tape'];
  return '<dl class="pd-specs" data-reveal>' + rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('') + `<div class="wide"><dt>${fit[0]}</dt><dd>${fit[1]}</dd></div></dl>`;
}

function card(lang, p, i, top) {
  const href = (top ? 'shop/' : '../shop/') + p.id + '.html';
  const im = (top ? '../images/shop/' : '../../images/shop/') + p.image;
  const t = p[lang];
  return `<li class="shop-card" data-reveal style="--d:${i * 70}ms">\n      <a href="${href}">\n`
    + `        <span class="shop-card-media"><img class="" src="${im}-600.webp" srcset="${im}-600.webp 600w, ${im}-1000.webp 1000w" sizes="(min-width: 1100px) 25vw, (min-width: 700px) 45vw, 92vw" width="1000" height="1000" alt="${esc(t.name)} ${ALT[lang]}" loading="lazy" decoding="async"><span class="shop-card-no">${String(i + 1).padStart(2, '0')}</span></span>\n`
    + `        <span class="shop-card-body">\n          <span class="shop-card-name">${esc(t.name)}</span>\n          <span class="shop-card-short">${esc(t.short)}</span>\n        </span>\n`
    + `        <span class="shop-card-cta" aria-hidden="true">→</span>\n      </a>\n    </li>`;
}

const GRID = /(<ul class="shop-grid[^"]*" role="list">)([\s\S]*?)(<\/ul>)/;
const regrid = (html, lang, prods, top) => html.replace(GRID, (_, a, __, c) => a + prods.map((p, i) => card(lang, p, i, top)).join('') + c);

function makeProductPage(lang, tpl, tplHtml, p) {
  const cut = tplHtml.indexOf('shop-more');
  let head = tplHtml.slice(0, cut), tail = tplHtml.slice(cut);
  head = head.replaceAll(`Emblemos užsakymas — ${esc(tpl.lt.name)}`, `Emblemos užsakymas — ${esc(p.lt.name)}`);
  for (const k of ['desc', 'short', 'name']) head = head.replaceAll(esc(tpl[lang][k]), esc(p[lang][k]));
  head = head.replaceAll(tpl.id, p.id);
  head = head.replace(/<dl class="pd-specs"[\s\S]*?<\/dl>/, () => specs(lang, p));
  head = head.replace(/(<figure class="pd-media"[^>]*><img [^>]*?alt=")[^"]*"/, (_, a) => `${a}${esc(p[lang].name)} ${ALT[lang]}"`);
  return head + tail;
}

function buildShop() {
  const products = readJson('data/products.json').products;
  const tpl = products.find((p) => !p.uploaded && p.options.length === 1 && p.options[0].key === 'side' && LANGS.every((l) => exists(`${l}/shop/${p.id}.html`)));
  if (!tpl) throw new Error('no template emblem page found');
  // new pages inherit the current cache-busting versions of the shop page
  const shopHtml = read('lt/shop.html');
  const css = shopHtml.match(/styles\.css\?v=[a-z0-9]+/)?.[0], js = shopHtml.match(/main\.js\?v=[a-z0-9]+/)?.[0];
  for (const l of LANGS) {
    const tplHtml = read(`${l}/shop/${tpl.id}.html`);
    for (const p of products) {
      const f = `${l}/shop/${p.id}.html`;
      let h = exists(f) ? read(f) : makeProductPage(l, tpl, tplHtml, p);
      if (!exists(f)) { if (css) h = h.replace(/styles\.css\?v=[a-z0-9]+/, css); if (js) h = h.replace(/main\.js\?v=[a-z0-9]+/, js); }
      h = h.replace(/(<figure class="pd-media"[^>]*><img [^>]*?alt=")[^"]*"/, (_, a) => `${a}${esc(p[l].name)} ${ALT[l]}"`);
      write(f, regrid(h, l, products.filter((q) => q !== p), false));
    }
    let h = read(`${l}/shop.html`);
    h = h.replace(/<p class="eyebrow">\d+ (DIZAINAI|DESIGNS)<\/p>/, (_, w) => `<p class="eyebrow">${products.length} ${w}</p>`);
    write(`${l}/shop.html`, regrid(h, l, products, true));
  }
  // sitemap: one line per emblem page
  let sm = read('sitemap.xml');
  const lineFor = (l, id) => `  <url><loc>https://autaplate.com/${l}/shop/${id}</loc></url>\n`;
  const ids = new Set(products.map((p) => p.id));
  sm = sm.replace(/  <url><loc>https:\/\/autaplate\.com\/(lt|en)\/shop\/([a-z0-9-]+)<\/loc><\/url>\n/g, (m, l, id) => (ids.has(id) ? m : ''));
  for (const l of LANGS) for (const p of products) if (!sm.includes(lineFor(l, p.id))) { const a = lineFor(l, tpl.id); sm = sm.replace(a, a + lineFor(l, p.id)); }
  write('sitemap.xml', sm);
}

/* ------------------------------------------------------------------ work gallery */
const T = {
  lt: { view: 'Žiūrėti', photos: 'nuotr.', car: 'AUTOMOBILIS', svc: 'PASLAUGA', ph: 'NUOTRAUKOS', gallery: (c, i) => `${c} – nuotrauka ${i}` },
  en: { view: 'View', photos: 'photos', car: 'CAR', svc: 'SERVICE', ph: 'PHOTOS', gallery: (c, i) => `${c} – photo ${i}` },
};

function jobCard(lang, e, index, number) {
  const t = T[lang], car = esc(e.car[lang]), svc = esc(svcById[e.service][lang]);
  const img = (n, sizes, alt) => {
    const b = `../images/uploads/${e.id}-${n}`;
    return `<img class="pic" style="--ar:4/3" src="${b}-1200.jpg" srcset="${b}-600.jpg 600w, ${b}-1200.jpg 1200w, ${b}-2000.jpg 2000w" sizes="${sizes}" width="1200" height="900" alt="${alt}" loading="lazy" decoding="async">`;
  };
  const tag = String(number).padStart(2, '0') + (e.photos > 1 ? ` · ${e.photos} ${t.photos}` : '');
  const gallery = [...Array(e.photos)].map((_, i) => img(i + 1, '(min-width: 700px) 45vw, 100vw', esc(t.gallery(e.car[lang], i + 1)))).join('');
  return `      <li class="job card" data-service="${e.service}" data-reveal style="--d:${(index % 3) * 80}ms">
        <button type="button" class="job-open" data-job-open aria-haspopup="dialog" data-cursor="${t.view}">
          <span class="card-media">${img(1, '(min-width: 1000px) 50vw, 100vw', car)}</span>
          <span class="job-tag">${tag}</span>
          <span class="job-meta"><span class="mono-index">${svc}</span><span class="h3">${car}</span><span class="rail-go" aria-hidden="true">+</span></span>
        </button>
        <dl class="record"><div><dt>${t.car}</dt><dd>${car}</dd></div><div><dt>${t.svc}</dt><dd>${svc}</dd></div><div><dt>${t.ph}</dt><dd>${e.photos}</dd></div></dl>
        <template data-job-gallery>${gallery}</template>
      </li>\n`;
}

function buildWork() {
  const works = readJson('data/uploads.json', { items: [] }).items.filter((x) => x.kind === 'work' && svcById[x.service]);
  for (const l of LANGS) {
    let h = read(`${l}/work.html`);
    const a = '<!-- uploads:start -->', b = '<!-- uploads:end -->';
    const i = h.indexOf(a), j = h.indexOf(b);
    if (i < 0 || j < i) throw new Error(`${l}/work.html: uploads markers missing`);
    const before = h.slice(0, i), staticJobs = (before.match(/<li class="job card"/g) || []).length;
    const region = works.map((e, k) => jobCard(l, e, staticJobs + k, staticJobs + k + 1)).join('');
    h = before + a + '\n' + region + '      ' + h.slice(j);
    // counters
    const count = {}; let total = 0, photos = 0;
    for (const m of h.matchAll(/<li class="job card" data-service="([a-z-]+)"/g)) { count[m[1]] = (count[m[1]] || 0) + 1; total++; }
    for (const m of h.matchAll(/<dt>(?:NUOTRAUKOS|PHOTOS)<\/dt><dd>(\d+)<\/dd>/g)) photos += +m[1];
    h = h.replace(/(data-filter="all"[^>]*>[\s\S]*?<span class="chip-n">)\d+(<\/span>)/, `$1${total}$2`);
    for (const s of services) h = h.replace(new RegExp(`(data-filter="${s.id}"[^>]*>[\\s\\S]*?<span class="chip-n">)\\d+(</span>)`), `$1${count[s.id] || 0}$2`);
    h = h.replace(/(<b data-fl-count>)\d+(<\/b>\D*?)\d+/, `$1${total}$2${total}`);
    let n = 0;
    h = h.replace(/(<span class="wh-l">[^<]*<\/span><span class="stat-n" data-count=")\d+(">)\d+(<\/span>)/g, (m, x, y, z) => { n++; return n === 1 ? `${x}${total}${y}${total}${z}` : n === 3 ? `${x}${photos}${y}${photos}${z}` : m; });
    write(`${l}/work.html`, h);
  }
}

/* ------------------------------------------------------------------ run */
const done = await processQueue();
buildShop();
buildWork();
console.log(done ? `Processed ${done} upload(s).` : 'No queued uploads; pages re-derived.');
