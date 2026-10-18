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

Both forms send to [Web3Forms](https://web3forms.com): the 3-step quote form on the contact page, and the quick enquiry form at the bottom of every page. Each enquiry arrives as an email to the inbox the access key was created for.

- **The access key** is written into a hidden field in each form by the page generator (`W3F_KEY`). Web3Forms keys are public by design: a key can only send mail to its own inbox, so it is safe in the page source. To change the key, change it there and regenerate the pages.
- **The endpoint** is `FORM_ENDPOINT` at the top of `main.js`.
- **Email subjects**: "Užklausa kainai — autaplate.com" (quote form) and "Greita užklausa — autaplate.com" (quick form). The sender name is "AUTAPLATE svetainė".
- **Quote form fields**: `vehicle`, `service` (sent as the service name), `message`, `name`, `email` and `phone`. Replying to the email goes to the customer's address.
- **Quick form fields**: `name`, `phone`, `message` and, on a service page, `service`.
- **Added to every enquiry**: `kalba` (LT or EN, so you know which language to reply in) and `puslapis` (the page it was sent from).
- **Spam**: `botcheck` is the Web3Forms honeypot (a hidden checkbox, which browser autofill never ticks).
- **When a send fails**, the message on the page shows the reason in brackets, e.g. `(Invalid access key)`.
- **Not arriving in Gmail?** Look in Promotions, Updates and Spam. Mark one as "Not spam" and add a filter ("Never send to Spam") for mail from Web3Forms.
- **Photos**: file attachments need the Web3Forms Pro plan, so the photo field is off. The form tells customers to send photos by replying to your email. After upgrading to Pro, set `PHOTO_UPLOAD = True` in the generator and regenerate: the upload field comes back, and files are sent as attachments.
- **Without JavaScript** the forms still post straight to Web3Forms.

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
- [x] Real domain: `https://autaplate.com`. Canonical, hreflang, OG and JSON-LD URLs use it; `sitemap.xml` and `robots.txt` point at it. These URLs drop `.html` (`/lt/shop`, not `/lt/shop.html`) because Cloudflare serves pages that way and redirects the `.html` address.
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

`<section class="dv" data-dv>` on the home page. Scrolling scrubs through a frame sequence cut from the studio clip: the red Demon 170 drives in from the right and stops. `main.js` sets `--p` (0 → 1) on the section; it picks the frame and fades in the title, info box, specs and buttons.

- **Frames**: `images/drive-dark/l/` (1280×720, desktop) and `images/drive-dark/s/` (768×432, phones), 102 transparent WebP files each. They cover the drive (clip frames 18–106) plus the start of the camera push-in. Each frame is the car cut out of the studio clip, with a faint mirrored reflection under the tyres.
- **Page colour**: black (`#050505`) with a soft red glow. The frames are transparent, so the car sits directly on the page.
- **Replacing the clip**: extract new frames into a new folder, e.g. `images/drive2/`. Images are cached as immutable, so never overwrite a folder. Then update `data-src` and `data-frames` in the generator.

## Stripes section (home page)

`<section class="st" data-st>` comes after the Materials section. Scrolling scrubs the clip of blue racing stripes being laid onto a white Challenger. It uses the same scroll-scrub code as the drive-in section (`scrub()` in `main.js`).

- **Frames**: `images/stripes-studio/l/` (1280×720) and `images/stripes-studio/s/` (768×432), 90 transparent WebP files each, cut from the dark-studio clip: 80 cover the application (clip frames 10–100) and 10 the camera drift at the end.
- **Steps**: the three steps on the left (`data-st-step`) light up at 0%, 36% and 70% of the scroll (the `at` array in `main.js`). On phones only the current step shows, under the clip.
- **Page colour**: black with a soft red glow, like the other two scroll sections. The top edge of the clip fades out so the stripes come in from the dark.

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

## Scroll-video sections on black

**360° Mustang**: `images/spin-orbit/l/` and `s/` hold 120 frames, every second frame of the dark-studio orbit clip. That clip orbits about 315°, from the front-left corner round to the left side, so the section has `data-span="315"` and the degree counter stops at 315 rather than claiming a full 360.

The 360° Mustang, the Demon drive-in and the stripes section all sit on black. Their source clips were shot in a white studio, so every frame is cut out (rembg, `isnet-general-use`). The cut-outs then go through three steps:

1. **Edge clean-up**: the soft edge is hardened, shrunk by 1–2 px and feathered.
2. **Colour clean-up**: white studio light is removed from the edge pixels.
3. **Reflection**: a faint mirrored reflection is added under the tyres.

Frames are saved as transparent WebP in `images/spin-orbit/`, `images/drive-dark/` and `images/stripes-studio/`. A new clip needs the same treatment. Always use a new folder name, because images are cached as immutable.

## Motion on the content pages

- **Recent work (home)**: on screens 900 px and wider the section pins, and scrolling down slides the cards sideways (`data-wk` in `main.js`). The section's height is set to the track's overflow, so one pixel of scroll moves the cards one pixel. On phones it is a swipeable row. It shows the first eight jobs from the gallery, then an "All work" card.
- **Work page**: the stat tiles count up. The filter panel is sticky. Once it sticks, its top part (heading, index numbers and counts) slides up under the header and only the row of service names stays in view. A red marker slides under the active filter, and "Showing N of 23" follows the filter.
- **About page**: the statement lights up word by word as it scrolls through, the photo strip loops sideways and pauses on hover, and the three principle cards tilt toward the mouse pointer.
- **Contact page**: the three form steps have numbered dots and a progress bar, and each step slides in from the side it comes from.

With "reduce motion" switched on in the operating system, nothing pins or loops, and all text shows at once.

## Social profiles and search

- Instagram and Facebook links are in the footer of every page and on the contact page. They are also in the business data on the home page (`sameAs`), so Google can connect the profiles to the site. The URLs are `INSTAGRAM` and `FACEBOOK` in the generator.
- The cart pages carry `noindex` and are left out of `sitemap.xml`, so they don't show up in Google results.
