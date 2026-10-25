/** Temporary onboarding preview helpers (PRD section 7). Nothing here persists. */
export const NOMINATIM_UA = "BusinessFinder-dev/0.1 (preview; contact via github.com/eLBirador/business-finder)";
export const MAX_ADDRESS_LEN = 200;
const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function newBusinessId(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = "";
  while (out.length < 8) for (const b of rand(16)) if (b < 248 && out.length < 8) out += B62[b % 62];
  return "bf_" + out;
}
export const isBusinessId = (s: string) => /^bf_[0-9A-Za-z]{8}$/.test(s);

export function normaliseAddress(q: unknown): { ok: true; q: string; key: string } | { ok: false; error: string } {
  if (typeof q !== "string") return { ok: false, error: "address is required" };
  const t = q.trim().replace(/\s+/g, " ");
  if (!t) return { ok: false, error: "address is required" };
  if (t.length > MAX_ADDRESS_LEN) return { ok: false, error: `address must be at most ${MAX_ADDRESS_LEN} characters` };
  return { ok: true, q: t, key: t.toLowerCase() };
}

export interface Match { display_name: string; lat: number; lng: number; osm_ref: string }
export function normaliseResults(raw: unknown): Match[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r: any) => {
    const lat = Number(r?.lat), lng = Number(r?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || typeof r?.display_name !== "string") return [];
    const t = typeof r.osm_type === "string" ? r.osm_type[0].toUpperCase() : "";
    return [{ display_name: r.display_name, lat, lng, osm_ref: t && r.osm_id != null ? `${t}${r.osm_id}` : "" }];
  });
}

const cache = new Map<string, Match[]>();
let last = 0;
export function _reset() { cache.clear(); last = 0; }

export async function geocode(q: string, key: string, f: typeof fetch = fetch, now = () => Date.now(), sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<{ matches: Match[]; cached: boolean }> {
  const hit = cache.get(key);
  if (hit) return { matches: hit, cached: true };
  const wait = last + 1000 - now();          // per-isolate throttle: max 1 req/s
  if (wait > 0) await sleep(wait);
  last = now();
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=au&limit=5&addressdetails=1&q=" + encodeURIComponent(q);
  const res = await f(url, { headers: { "User-Agent": NOMINATIM_UA, "Accept-Language": "en" } });
  if (!res.ok) throw new Error("upstream " + res.status);
  const matches = normaliseResults(await res.json());
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  cache.set(key, matches);
  return { matches, cached: false };
}

export const DEFAULT_EMBED_HOST = "https://goto.yahaay.com";
/** Public embed host from env (EMBED_HOST), normalised to an https origin with no trailing slash. */
export function embedHost(v?: string): string {
  try { const u = new URL(v || DEFAULT_EMBED_HOST); return u.protocol === "https:" ? u.origin : DEFAULT_EMBED_HOST; } catch { return DEFAULT_EMBED_HOST; }
}
/** The two ID-only tag forms from PRD 5.1. */
export function embedTags(host: string, id: string): { iframe: string; script: string } {
  return {
    iframe: `<iframe src="${host}/e/${id}"\n        width="100%" height="400" style="border:0" loading="lazy"\n        title="Business location map" allowfullscreen></iframe>`,
    script: `<script src="${host}/embed.js" async></script>\n<div class="business-finder" data-id="${id}"></div>`,
  };
}
export const DEFAULT_CORS_ORIGINS = ["https://yahaay.com", "https://www.yahaay.com", "http://100.70.42.126:8789", "http://192.168.8.26:8789", "http://localhost:8789", "http://127.0.0.1:8789"];
/** CORS headers for an allowed Origin, or null. */
export function corsHeaders(origin: string | null, list?: string): Record<string, string> | null {
  const allowed = list ? list.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_CORS_ORIGINS;
  if (!origin || !allowed.includes(origin)) return null;
  return { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400", vary: "Origin" };
}
/** frame-ancestors for /embed: any site may embed (that is the product), yahaay.com explicitly included. */
export const EMBED_CSP = "frame-ancestors *";
