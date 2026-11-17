/* AUTAPLATE — /api/admin/* (used by the /admin upload page).

   A visitor needs one of the passwords in the ADMIN_PASSWORDS secret ("Name:password,Name2:password2").
   Uploads are NOT written to the website directly: this Worker commits the photos and a small
   queue file to GitHub (secret GITHUB_TOKEN). A GitHub Action (.github/workflows/uploads.yml,
   tools/build.mjs) then makes the final images and pages, and Cloudflare publishes the result.

   POST /api/admin/login     { }                      -> { name }
   GET  /api/admin/list                               -> { items, pending }
   POST /api/admin/upload    multipart: meta + photo0..photoN
   POST /api/admin/delete    { id }
   All routes need the header  x-admin-key: <password>. */

const enc = new TextEncoder();
const reply = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ID_RE = /^[a-z0-9][a-z0-9-]{1,70}$/;
const NUM_RE = /^\d{1,3}([.,]\d{1,2})?$/;
const MAX_FILE = 6 * 1024 * 1024, MAX_TOTAL = 40 * 1024 * 1024, MAX_WORK_PHOTOS = 12;

export const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const rand = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (b % 36).toString(36)).join('');

async function digest(s) { return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
async function same(a, b) {
  const x = await digest(a), y = await digest(b); let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
async function whoIs(request, env) {
  const key = request.headers.get('x-admin-key') || '';
  let found = null;
  for (const part of String(env.ADMIN_PASSWORDS || '').split(',')) {
    const i = part.indexOf(':');
    if (i < 1) continue;
    const name = part.slice(0, i).trim(), pw = part.slice(i + 1).trim();
    if (pw && (await same(key, pw))) found = name;
  }
  return found;
}

/* ---- GitHub ---- */
const branch = (env) => env.GITHUB_BRANCH || 'main';
function gh(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json',
      'user-agent': 'autaplate-admin', 'x-github-api-version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}),
    },
  });
}
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const must = async (r, what) => { if (!r.ok) throw new Error(`${what}: GitHub ${r.status}`); return r.json(); };
const fileExists = async (env, path) => (await gh(env, `/contents/${path}?ref=${branch(env)}`)).status === 200;

/* One commit with every file: { path, content: string } or { path, bytes: Uint8Array }. */
export async function commitFiles(env, files, message, by) {
  const blobs = new Map();
  for (let attempt = 0; attempt < 3; attempt++) {
    const head = (await must(await gh(env, `/git/ref/heads/${branch(env)}`), 'ref')).object.sha;
    const baseTree = (await must(await gh(env, `/git/commits/${head}`), 'commit')).tree.sha;
    const tree = [];
    for (const f of files) {
      if (f.bytes) {
        if (!blobs.has(f.path)) blobs.set(f.path, (await must(await gh(env, '/git/blobs', { method: 'POST', body: JSON.stringify({ content: b64(f.bytes), encoding: 'base64' }) }), 'blob')).sha);
        tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blobs.get(f.path) });
      } else tree.push({ path: f.path, mode: '100644', type: 'blob', content: f.content });
    }
    const t = await must(await gh(env, '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree }) }), 'tree');
    const author = { name: clean(by, 40) || 'admin', email: 'uploads@autaplate.com', date: new Date().toISOString() };
    const c = await must(await gh(env, '/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: t.sha, parents: [head], author }) }), 'new commit');
    const r = await gh(env, `/git/refs/heads/${branch(env)}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) });
    if (r.ok) return c.sha;
    if (r.status !== 422) throw new Error(`update ref: GitHub ${r.status}`);   // 422 = someone pushed meanwhile: retry
  }
  throw new Error('busy');
}

async function readUploads(env) {
  const r = await gh(env, `/contents/data/uploads.json?ref=${branch(env)}`, { headers: { accept: 'application/vnd.github.raw+json' } });
  if (r.status === 404) return [];
  const j = JSON.parse(await r.text());
  return j.items || [];
}

/* ---- routes ---- */
async function upload(request, env, by, services) {
  let fd;
  try { fd = await request.formData(); } catch { return reply({ error: 'form' }, 400); }
  let m;
  try { m = JSON.parse(String(fd.get('meta'))); } catch { return reply({ error: 'meta' }, 400); }

  const photos = [...fd.entries()].filter(([k, v]) => /^photo\d+$/.test(k) && typeof v !== 'string')
    .sort((a, b) => parseInt(a[0].slice(5), 10) - parseInt(b[0].slice(5), 10)).map(([, v]) => v);
  const kind = m.kind === 'badge' ? 'badge' : m.kind === 'work' ? 'work' : null;
  if (!kind) return reply({ error: 'kind' }, 400);
  if (kind === 'badge' ? photos.length !== 1 : !(photos.length >= 1 && photos.length <= MAX_WORK_PHOTOS)) return reply({ error: 'photos' }, 400);

  let total = 0; const bytes = [];
  for (const p of photos) {
    if (p.size > MAX_FILE) return reply({ error: 'too_big' }, 413);
    total += p.size;
    const u8 = new Uint8Array(await p.arrayBuffer());
    if (!(u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff)) return reply({ error: 'not_jpeg' }, 400);
    bytes.push(u8);
  }
  if (total > MAX_TOTAL) return reply({ error: 'too_big' }, 413);

  const item = { op: 'add', kind, by, at: new Date().toISOString() };
  let title;
  if (kind === 'badge') {
    const lt = { name: clean(m.lt?.name, 80), short: clean(m.lt?.short, 120), desc: clean(m.lt?.desc, 400) };
    const en = { name: clean(m.en?.name, 80), short: clean(m.en?.short, 120), desc: clean(m.en?.desc, 400) };
    const size = m.size || {};
    if (!lt.name) return reply({ error: 'name' }, 400);
    for (const k of ['thickness_mm', 'height_cm', 'width_cm']) if (!NUM_RE.test(String(size[k] ?? '').trim())) return reply({ error: 'size', field: k }, 400);
    let id = slugify(en.name || lt.name);
    if (id.length < 2) id = 'emblema';
    for (let i = 0; i < 4 && (await fileExists(env, `lt/shop/${id}.html`) || await fileExists(env, `images/shop/${id}-600.webp`)); i++) id = `${slugify(en.name || lt.name)}-${rand(3)}`;
    Object.assign(item, { id, lt, en, fit: ['pad', 'crop'].includes(m.fit) ? m.fit : 'auto', size: { thickness_mm: String(size.thickness_mm).trim(), height_cm: String(size.height_cm).trim(), width_cm: String(size.width_cm).trim() } });
    title = lt.name;
  } else {
    if (!(services || []).some((s) => s.id === m.service)) return reply({ error: 'service' }, 400);
    const car = { lt: clean(m.car?.lt, 80), en: clean(m.car?.en, 80) };
    if (!car.lt) return reply({ error: 'car' }, 400);
    Object.assign(item, { id: `${slugify(car.lt) || 'darbas'}-${rand(5)}`, service: m.service, car, photos: photos.length });
    title = car.lt;
  }
  if (!ID_RE.test(item.id)) return reply({ error: 'id' }, 400);

  const files = bytes.map((u8, i) => ({ path: `data/queue/${item.id}/${i + 1}.jpg`, bytes: u8 }));
  files.push({ path: `data/queue/${stamp()}-${item.id}.json`, content: JSON.stringify(item, null, 2) + '\n' });
  try { await commitFiles(env, files, `Upload (${by}): ${title}`, by); }
  catch (e) { console.error('upload', e.message); return reply({ error: 'github' }, 502); }
  return reply({ ok: true, id: item.id, kind });
}

async function list(env) {
  const items = (await readUploads(env)).slice(-50).reverse();
  let pending = 0;
  const r = await gh(env, `/contents/data/queue?ref=${branch(env)}`);
  if (r.ok) pending = (await r.json()).filter((f) => f.name.endsWith('.json')).length;
  return reply({ items, pending });
}

async function remove(request, env, by) {
  let b; try { b = await request.json(); } catch { return reply({ error: 'json' }, 400); }
  const id = String(b.id || '');
  if (!ID_RE.test(id)) return reply({ error: 'id' }, 400);
  if (!(await readUploads(env)).some((x) => x.id === id)) return reply({ error: 'not_found' }, 404);
  const item = { op: 'delete', id, by, at: new Date().toISOString() };
  try { await commitFiles(env, [{ path: `data/queue/${stamp()}-del-${id}.json`, content: JSON.stringify(item, null, 2) + '\n' }], `Delete (${by}): ${id}`, by); }
  catch (e) { console.error('delete', e.message); return reply({ error: 'github' }, 502); }
  return reply({ ok: true });
}

export async function handleAdmin(request, env, url, { services }) {
  const route = url.pathname.replace('/api/admin/', '');
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO || !env.ADMIN_PASSWORDS) return reply({ error: 'not_configured' }, 503);
  const by = await whoIs(request, env);
  if (!by) { await sleep(600); return reply({ error: 'auth' }, 401); }
  if (route === 'login' && request.method === 'POST') return reply({ name: by });
  if (route === 'list' && request.method === 'GET') return list(env);
  if (route === 'upload' && request.method === 'POST') return upload(request, env, by, services);
  if (route === 'delete' && request.method === 'POST') return remove(request, env, by);
  return reply({ error: 'not found' }, 404);
}
