export interface Env { TILE_SOURCE?: string; OSM_STYLE_URL?: string; WEBMAPS_STYLE_URL?: string; REVERSE_GEOCODE?: string; LANDMARKS_SOURCE?: string; USER_AGENT?: string; EMBED_HOST?: string; CORS_ORIGINS?: string }

/** The one switch: osm (default) or webmaps. */
export function styleUrl(env: Env): string {
  return env.TILE_SOURCE === "webmaps"
    ? env.WEBMAPS_STYLE_URL ?? "https://api.webmaps.app/styles/default/style.json"
    : env.OSM_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty";
}
export const upstreamOrigin = (env: Env) => new URL(styleUrl(env)).origin;
export const ua = (env: Env) => env.USER_AGENT ?? "BusinessFinder/0.1";

/** Rewrite every upstream URL so the browser only ever talks to our Worker (/tiles/*). */
export function rewrite(body: string, upstream: string, self: string): string {
  return body.split(upstream).join(`${self}/tiles`);
}

/** Fetch upstream with edge caching; JSON bodies (style, TileJSON) get URLs rewritten. */
export async function proxy(req: Request, env: Env, upstreamUrl: string, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
  const self = new URL(req.url).origin;
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const key = new Request(req.url, { method: "GET" });
  const hit = cache && (await cache.match(key));
  if (hit) return hit;
  const up = await fetch(upstreamUrl, { headers: { "User-Agent": ua(env) }, cf: { cacheTtl: 86400, cacheEverything: true } } as RequestInit);
  if (!up.ok) return new Response(`upstream ${up.status}`, { status: 502 });
  const ct = up.headers.get("content-type") ?? "";
  const headers = new Headers({ "content-type": ct, "cache-control": "public, max-age=86400", "access-control-allow-origin": "*" });
  const enc = up.headers.get("content-encoding"); if (enc && !ct.includes("json")) headers.set("content-encoding", enc);
  const res = ct.includes("json") || upstreamUrl.endsWith(".json")
    ? new Response(rewrite(await up.text(), upstreamOrigin(env), self), { headers })
    : new Response(up.body, { headers });
  if (cache) { const p = cache.put(key, res.clone()); ctx ? ctx.waitUntil(p) : await p; }
  return res;
}
