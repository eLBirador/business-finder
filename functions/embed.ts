// Iframe page (PRD 5.1). Thin player: fetches /api/plan and plays it. All logic lives in /api/plan.
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Business location map</title>
<link rel="stylesheet" href="/vendor/maplibre-gl.css"><link rel="stylesheet" href="/player.css">
</head><body><div id="map"></div><div id="labels" aria-live="polite"></div>
<div id="status" class="loading">Loading map…</div>
<div id="controls" hidden><button id="play" type="button">▶ Play</button><button id="replay" type="button">↻ Replay</button><button id="nearby" type="button" aria-pressed="false" hidden>Nearby</button><a id="dir" target="_blank" rel="noopener">Get directions</a></div>
<script src="/vendor/maplibre-gl.js"></script><script src="/player.js"></script></body></html>`;
export const onRequestGet: PagesFunction = () =>
  new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
