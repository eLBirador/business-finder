import type { Env } from "./tiles";
import { ua } from "./tiles";
/** Optional street lookup via Nominatim (REVERSE_GEOCODE=nominatim). Cached 30 days, coords rounded; off by default. */
export async function reverseStreet(env: Env, lat: number, lng: number): Promise<string | undefined> {
  if (env.REVERSE_GEOCODE !== "nominatim") return undefined;
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}`;
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const key = new Request(url);
  let res = cache && (await cache.match(key));
  if (!res) {
    res = await fetch(url, { headers: { "User-Agent": ua(env) } });
    if (!res.ok) return undefined;
    res = new Response(res.body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=2592000" } });
    if (cache) await cache.put(key, res.clone());
  }
  const j = (await res.json()) as { address?: { road?: string } };
  return j.address?.road;
}
