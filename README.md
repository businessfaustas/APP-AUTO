# AUTAPLATE — website

Static site. Plain HTML, CSS and JS: no framework, no build step, no npm.
Google Fonts is the only external request on page load.

**Status: copy and photo pass done.** All body copy is written in Lithuanian and English, FAQ answers are in, and each service page has FAQPage JSON-LD.
Real photos are in place. The before/after slider is hidden until a genuine same-position pair exists.
Facts not yet supplied (owner, address, email, hours, durations, prices) are left out of the visible page and marked with `<!-- TODO -->` comments.
The home page case study shows the generic arrival-to-handover path until a real job is chosen.

## Layout

```
index.html              → redirects to /lt/ (Lithuanian is the default)
lt/ and en/             → mirrored pages, same filenames in both
  index.html  services.html  work.html  about.html  contact.html
  services/custom-orders.html
  services/full-vehicle-projects.html
  services/oem-emission-labels.html
  services/wrapping-livery-design.html
  services/custom-decals.html
  services/engraved-badges.html
styles.css  main.js     → shared by every page
data/reviews.json       → Google reviews (you fill this in)
images/                 → photographs + logo.svg
```

Every page has `hreflang` pairs for lt/en.
The LT/EN switch in the header links to the same page in the other language.

## Viewing locally

Serve the folder over http. The reviews section uses `fetch()`, which doesn't work from `file://`.

```
python3 -m http.server 8000   # then open http://localhost:8000/
```

## Form endpoint

Open `main.js`. At the top, paste your form backend URL into the quotes:

```js
const FORM_ENDPOINT = '';
```

The backend must accept a multipart POST with file uploads (Formspree, Basin, Getform and similar all do).
The fields are `vehicle`, `service`, `photos` (multiple), `message`, `name`, `email` and `phone`.
`website` is a honeypot for spam bots.

## Reviews

Fill `data/reviews.json` with real Google reviews only.
While `reviews` is empty, the home page review section stays hidden.

```json
{
  "source": "Google",
  "place_url": "https://maps.google.com/?cid=…",
  "reviews": [
    { "author": "As shown on Google", "rating": 5, "date": "2026-05", "lang": "lt", "text": "Review text, copied exactly." }
  ]
}
```

## Images

- `images/originals/` holds the photos as uploaded. They are never linked from the pages.
- `images/web/` holds the web versions: each photo at up to three widths (600 / 1200 / 2000 px), rotated upright, with metadata removed.
- The AP mark is inline SVG in every page (header, footer, loader), traced from the supplied logo. `images/mark.svg` is the browser-tab icon; `favicon.png` and `apple-touch-icon.png` are rendered from it. `images/logo.png` (old wordmark) is no longer used. `og.jpg` is the social share image.
- Every image uses the same `.pic` style: same fit, same light `saturate(.95) contrast(1.05)` filter, with the ratio set per slot.

AI-generated or AI-rendered images (studio shots on white, the top view, "ChatGPT Image…", "Gemini…") are kept in `originals/` but deliberately not used. The site shows evidence of real work only.

To add photos, upload them to `images/originals/`. The web versions are made from those files: name the source file and the slot, and they get resized into `images/web/<name>-<width>.jpg`.

## Adding a seventh service page

1. Copy `lt/services/custom-orders.html` to `lt/services/<new-slug>.html`, and do the same under `en/`.
2. In both copies, update the `<title>`, description, canonical URL, `hreflang` URLs, H1, eyebrow number (`07 / 07`), lists, gallery and FAQs.
3. Add the service in these places, in both languages:
   - the footer "Services" list on every page
   - the services grid on `index.html`
   - `services.html`
   - the filter chips on `work.html`
   - the `<select name="service">` on `contact.html`
   - the "Other services" list on each service page
4. Change `06` to `07` wherever the service count appears.

## Still needed from the business

- [ ] Email address
- [ ] Street address (also used for the map `q=` parameter and LocalBusiness JSON-LD)
- [ ] Opening hours
- [ ] Confirm the reply-time promise: "within one working day, Monday to Friday"
- [ ] Real domain. Canonical and OG URLs currently assume `https://autaplate.lt`
- [ ] Home case study: it uses the grey hex-graphic Mustang photos. Confirm the facts (film, parts removed, days) to replace the generic captions
- [ ] A real before/after pair shot from the same position (the slider is hidden until then)
- [ ] Materials and duration for the Work page records
- [ ] A photo of the people who run the workshop (About page)
- [ ] Real duration for each of the five process steps (slot marked in the process section)
- [ ] Real job records for the Work page (car, materials, duration)
- [ ] Honest "from" price for OEM labels and custom decals (the blocks are switched off until then)
- [ ] Who runs the workshop (for the About page)
- [ ] Optional: one messaging link (WhatsApp **or** Messenger), footer only
- [ ] Google reviews for `data/reviews.json`

## Page loader and transitions

Every page has a `.loader` panel. A small script in `<head>` chooses the mode before the first paint:

- `full`: first page of a visit. The A draws, the P slides in, AUTAPLATE rises, then the panel lifts (about 1.7 s).
- `short`: every page after that. The A and P snap together, then the panel lifts (under 1 s). Between pages, the old page sinks and dims while the new one sweeps up (native View Transitions, so links aren't delayed).
- `none`: reduced-motion users, or JavaScript disabled. The loader never shows.

Timings live in `styles.css` (`--out`) and in `main.js` (`introMs`). Keep the two in step.

## Caching

Pages link `styles.css?v=<hash>` and `main.js?v=<hash>`. The hash comes from the file contents, so after any CSS or JS change the pages must be regenerated (or the `?v=` value bumped by hand). That forces browsers to fetch the new file; `_headers` lets them cache each version forever.

## Drive-in section (home page)

`<section class="drive" data-drive>` on the home page. As the visitor scrolls, `main.js` sets `--e` (0 → 1, eased) on the section. CSS uses it to drive the car in from the right, slide the FORD / MUSTANG title in, and fade in the info box and specs. Right now the car is a still cutout: `images/web/cut-mustang-blue-*.webp`.

To swap in a car video, send the clip (side view, car driving into frame, plain or dark background). It gets converted to a frame sequence the same way as the 360° section (`images/spin/`). The frames go into `images/drive/` at two sizes, and the section scrubs through them on a canvas with scroll instead of moving the cutout. Do not use a `<video>` tag for this: scroll-scrubbing a video is not smooth on phones.

## Shop (test mode)

Pages: `lt/shop.html`, `lt/shop/<product>.html` and `lt/cart.html`, plus the same in `en/`. The cart is kept in the visitor's browser (localStorage).

- **Products and prices** all come from `data/products.json`, in euro cents. The current entries are test placeholders, and `"test": true` shows the "TEST SHOP" notice. Product photos are in `images/shop/<image>-600.webp` and `-1000.webp`.
- **Checkout**: `worker.js` handles `POST /api/checkout`. It recalculates every price from `data/products.json`, so a visitor can't change a price in their browser.
  - With no Stripe key set, it answers "test mode": the customer sees "Test order received" and no payment is taken.
  - With the key set, it sends the customer to Stripe's payment page (card, Apple Pay, Google Pay). After paying, Stripe returns them to `cart.html?paid=1`.
- **Going live**:
  1. Create a Stripe account.
  2. In Stripe → Developers → API keys, copy the **secret key**.
  3. In Cloudflare → Workers & Pages → app-auto → Settings → Variables and secrets, add a **Secret** named `STRIPE_SECRET_KEY`.
  4. Replace the test products in `data/products.json`, set `"test": false`, then regenerate the pages and push.
  5. Paid orders, including the customer's phone and parcel locker or address, appear in the Stripe dashboard → Payments.
- **Trademarks**: Demon, SHELBY and HELLCAT are trademarks of their owners. Check you have the right to sell those designs before going live.
