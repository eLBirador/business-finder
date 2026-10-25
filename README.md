# Business Finder

**An animated map for your business website that shows visitors exactly where you are.**

> Working title. This is an early concept by Yahaay IT Consultancy: nothing is built yet.

## The idea

When someone opens your page, the map plays a short, smooth animation:

1. It starts with a wide view of the city (e.g. Sydney).
2. It zooms in to your suburb (e.g. Thornleigh).
3. It lands on your exact location, with a marker.

It's a friendly, memorable way to say "here's where to find us".

## How it works

- You paste a short piece of embed code into your website.
- The code includes your latitude and longitude.
- When the page loads, the map works out the city and suburb views from those coordinates and plays the animation automatically.
- Afterwards the map stays on your location, so visitors can look around or get directions.

No map skills needed: just your coordinates.

## Example embed code

The URL and coordinates below are placeholders (roughly Thornleigh) and the final format is still to be decided.

Script tag:

```html
<script src="https://embed.example.com/business-finder.js"></script>
<div class="business-finder"
     data-lat="-33.7290"
     data-lng="151.0790"
     data-name="Your Business Name">
</div>
```

Iframe:

```html
<iframe src="https://embed.example.com/finder?lat=-33.7290&lng=151.0790&name=Your%20Business"
        width="100%" height="400" style="border:0"></iframe>
```

| Parameter | Required | What it does |
|---|---|---|
| `lat` / `lng` | Yes | Your business's exact location |
| `name` | No | Label shown on the marker |

Possible extras later: starting city view, marker colour, animation speed and a "Get directions" button.

## Who it's for

Local businesses and organisations in Thornleigh, Hornsby Shire and nearby northern Sydney, such as:

- Shops, cafes, trades and other small local businesses
- Clubs, community groups and venues
- Events and markets
- Real estate agents
- Tourism and visitor spots

## Still to decide

- [ ] Pricing (one-off setup, monthly, or both)
- [ ] Tech stack (map library and tile provider)
- [ ] Hosting for the embed script
- [ ] Branding and final product name
- [ ] Final embed code format (script tag, iframe, or both)
- [ ] A demo page to show local businesses

## First draft (code)

The spec is the PRD: [docs/business-finder-prd.md](docs/business-finder-prd.md). This draft is a Cloudflare Pages project with Pages Functions (the Worker). The browser only talks to the Worker and never sees upstream tile URLs.

| Route | What it does |
|---|---|
| `/` | Demo page: both embed forms (Thornleigh example) |
| `/embed?lat&lng&name&street&lgu&autoplay&landmarks` | Iframe page: a thin MapLibre player |
| `/embed.js` | Script-tag loader: turns `.business-finder` divs (data-* attributes) into the iframe |
| `/api/plan?lat&lng&...` | Server-side phase 1 animation plan (camera keyframes, timings, labels) plus ranked nearby landmarks |
| `/style.json`, `/tiles/*` | Style and tile proxy for the active tile source, edge-cached |

### Run locally

```sh
npm install
npm run dev        # vendors MapLibre into public/vendor, then wrangler pages dev on :8788
npm test           # vitest
npm run typecheck
```

### Settings (`wrangler.toml` [vars])

- `TILE_SOURCE`: `osm` (default, interim OpenFreeMap vector style via `OSM_STYLE_URL`, no key) or `webmaps` (target, `WEBMAPS_STYLE_URL`, placeholder until api.webmaps.app tiles are fixed). Only the style and proxy target change.
- `LANDMARKS_SOURCE`: `sample` (default, bundled Thornleigh sample) or `overpass` (cached OSM Overpass lookup).
- `REVERSE_GEOCODE`: `off` (default) or `nominatim` (cached street-name lookup).

### Known gaps in the draft

- State labels use coarse bounding boxes; the LGU lookup is a stub (Hornsby Shire only). Use `lgu`/`street` params to override.
- Street name comes from the `street` param unless Nominatim is switched on.
- Landmark sample coordinates are approximate.
- Not deployed. No pricing, billing or customer keys (deferred per the PRD).

## Info card, edit-link email and spam protection

- **Info card:** `/e/<id>` and `/embed?tagline=&hours=&phone=&website=` show a tagline, hours, a `tel:` link and a website link (http/https only). Everything is cleaned and escaped. Embeds smaller than 360x300 collapse to name and street with an "i" button. `owner_email` is never sent to the embed.
- **Edit-link email:** after `POST /api/business` and `POST /api/business/resend`, the Function sends `{to, businessName, id, token}` to the yahaay.com Worker (`/internal/bf-mail`). It uses the `MAILER` service binding, or `MAIL_ENDPOINT` if that is set. The `x-bf-mail-secret` header must match `BF_MAIL_SECRET`. The Worker sends the email from info@yahaay.com. Resend issues a new edit key and always replies 202.
- **Spam protection:** Turnstile siteverify (hostname allowlist `TURNSTILE_HOSTNAMES`), a `company_site` honeypot, `elapsedMs` >= 3000, a per-IP limit in memory, and a durable D1 limit (`rate_limit` table, migration 0002: 20 creates and 5 resends per IP per hour). `GET /api/business/config` returns the public site key.
- **Local dev:** `.dev.vars` (gitignored) holds the Turnstile *test* keys, `TURNSTILE_HOSTNAMES=example.com,localhost,...`, `MAIL_ENDPOINT=http://localhost:8789/internal/bf-mail` and `BF_MAIL_SECRET`. Run `npx wrangler d1 migrations apply business-finder --local`.
