import { proxy, upstreamOrigin, type Env } from "../../src/tiles";
// Tile/sprite/glyph/TileJSON proxy to the active upstream, edge-cached.
export const onRequestGet: PagesFunction<Env> = ({ request, env, waitUntil }) => {
  const u = new URL(request.url);
  const path = u.pathname.replace(/^\/tiles/, "");
  return proxy(request, env, upstreamOrigin(env) + path + u.search, { waitUntil });
};
