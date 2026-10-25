import { proxy, styleUrl, type Env } from "../src/tiles";
// Style JSON for the active TILE_SOURCE, with all tile/sprite/glyph URLs rewritten to /tiles/*.
export const onRequestGet: PagesFunction<Env> = ({ request, env, waitUntil }) =>
  proxy(request, env, styleUrl(env), { waitUntil });
