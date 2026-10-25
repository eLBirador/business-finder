// Iframe page (PRD 5.1). Thin player: fetches /api/plan and plays it. All logic lives in /api/plan.
export const EMBED_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Business location map</title>
<link rel="stylesheet" href="/vendor/maplibre-gl.css"><link rel="stylesheet" href="/player.css">
</head><body><div id="map"></div><div id="labels" aria-live="polite"><div class="card" hidden><div class="crumbs"></div><div class="hd"><div class="nm"></div><button class="ib" type="button" aria-expanded="false" aria-controls="bf-info" aria-label="Business info" hidden>i</button></div><div class="st"></div><div class="info" id="bf-info" hidden><div class="tg"></div><div class="hr"></div><div class="lk"><a class="ph" hidden></a><a class="web" target="_blank" rel="noopener nofollow ugc" hidden></a></div></div></div></div>
<div id="status" class="loading">Loading map…</div>
<div id="controls" class="bf-ctl" role="toolbar" aria-label="Map controls" hidden>
  <button id="replay" class="bf-btn" type="button" aria-label="Replay tour" data-tip="Replay"><svg class="bf-ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
  <button id="nearby" class="bf-btn" type="button" aria-pressed="false" aria-label="Show nearby landmarks" data-tip="Nearby" hidden><svg class="bf-ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M15 22a1 1 0 0 1-1-1v-4a1 1 0 0 1 .445-.832l3-2a1 1 0 0 1 1.11 0l3 2A1 1 0 0 1 22 17v4a1 1 0 0 1-1 1z"/><path d="M18 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 .601.2"/><path d="M18 22v-3"/><circle cx="10" cy="10" r="3"/></svg></button>
  <a id="dir" class="bf-btn bf-primary" target="_blank" rel="noopener" aria-label="Get directions (opens in new tab)" data-tip="Directions"><svg class="bf-ic" aria-hidden="true" viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg><span class="bf-txt">Directions</span></a>
</div>
<button id="skip" class="bf-skip" type="button" aria-label="Skip intro animation" hidden>Skip <svg class="bf-ic" aria-hidden="true" viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg></button>
<script src="/vendor/maplibre-gl.js"></script><script src="/player.js"></script></body></html>`;
export const onRequestGet: PagesFunction = () =>
  new Response(EMBED_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
