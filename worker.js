/* AUTAPLATE — Cloudflare Worker. Static files are served by Workers static assets;
   this script only answers /api/* requests (anything that isn't a file in the repo).

   POST /api/checkout
     - Recalculates every price from data/products.json. Prices sent by the browser are ignored.
     - With the STRIPE_SECRET_KEY secret set: creates a Stripe Checkout session and returns its URL.
     - Without it: returns { test: true } and the site shows a "test order" confirmation. */
import catalog from './data/products.json';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const byId = Object.fromEntries(catalog.products.map((p) => [p.id, p]));
const shipById = Object.fromEntries(catalog.shipping.map((s) => [s.id, s]));
const label = (v, lang) => v.label || v[lang] || v.en;

// One cart line -> { name, unit } priced from the catalogue, or null when anything doesn't match.
function priceLine(line, lang) {
  const p = byId[line && line.id];
  if (!p) return null;
  const qty = Math.floor(Number(line.qty));
  if (!(qty >= 1 && qty <= 50)) return null;
  let unit = 0; const picked = [];
  for (const opt of p.options) {
    const v = opt.values.find((x) => x.id === (line.opts || {})[opt.key]);
    if (!v) return null;
    unit += v.price; picked.push(label(v, lang));
  }
  return { name: `${p[lang].name} — ${picked.join(', ')}`, unit, qty };
}

export function quote(body) {
  const lang = body.lang === 'en' ? 'en' : 'lt';
  const items = Array.isArray(body.items) ? body.items.slice(0, 30).map((l) => priceLine(l, lang)) : [];
  if (!items.length || items.includes(null)) return { error: 'cart' };
  const ship = shipById[body.shipping];
  if (!ship) return { error: 'shipping' };
  const c = body.customer || {};
  const need = ['name', 'email', 'phone'].concat(ship.needs === 'locker' ? ['locker'] : ship.needs === 'address' ? ['address', 'city', 'zip'] : []);
  for (const k of need) if (!String(c[k] || '').trim()) return { error: 'field', field: k };
  const subtotal = items.reduce((s, i) => s + i.unit * i.qty, 0);
  return { lang, items, ship, customer: c, subtotal, total: subtotal + ship.price };
}

async function stripeSession(q, env, origin) {
  const f = new URLSearchParams();
  const base = `${origin}/${q.lang}/cart.html`;
  f.set('mode', 'payment');
  f.set('locale', q.lang);
  f.set('success_url', `${base}?paid=1&session={CHECKOUT_SESSION_ID}`);
  f.set('cancel_url', `${base}?cancelled=1`);
  f.set('customer_email', String(q.customer.email).slice(0, 200));
  q.items.forEach((it, i) => {
    f.set(`line_items[${i}][quantity]`, String(it.qty));
    f.set(`line_items[${i}][price_data][currency]`, catalog.currency);
    f.set(`line_items[${i}][price_data][unit_amount]`, String(it.unit));
    f.set(`line_items[${i}][price_data][product_data][name]`, it.name);
  });
  f.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  f.set('shipping_options[0][shipping_rate_data][display_name]', q.ship[q.lang]);
  f.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(q.ship.price));
  f.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', catalog.currency);
  const meta = { name: q.customer.name, phone: q.customer.phone, shipping: q.ship.id, locker: q.customer.locker, address: [q.customer.address, q.customer.zip, q.customer.city].filter(Boolean).join(', '), note: q.customer.note };
  for (const [k, v] of Object.entries(meta)) if (v) f.set(`metadata[${k}]`, String(v).slice(0, 480));
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST', body: f,
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
  });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error((data.error && data.error.message) || `stripe ${res.status}`);
  return data.url;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/checkout') {
      if (request.method !== 'POST') return json({ error: 'method' }, 405);
      let body;
      try { body = await request.json(); } catch { return json({ error: 'json' }, 400); }
      if (body.website) return json({ test: true }); // honeypot
      const q = quote(body);
      if (q.error) return json(q, 400);
      if (!env.STRIPE_SECRET_KEY) return json({ test: true, total: q.total });
      try { return json({ url: await stripeSession(q, env, url.origin) }); }
      catch (err) { console.error('checkout', err.message); return json({ error: 'payment' }, 502); }
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
