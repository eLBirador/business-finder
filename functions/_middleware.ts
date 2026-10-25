import { corsHeaders, EMBED_CSP } from "../src/onboard";
import type { Env } from "../src/tiles";
/** CORS for /api/* (yahaay.com page + local dev origins), preflight, and framing policy for /embed. */
export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  const path = new URL(request.url).pathname;
  const api = path.startsWith("/api/");
  const cors = api ? corsHeaders(request.headers.get("origin"), env.CORS_ORIGINS) : null;
  if (api && request.method === "OPTIONS") return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
  const res = await next();
  if (!cors && !(path === "/embed" || path.startsWith("/e/"))) return res;
  const out = new Response(res.body, res);
  if (cors) for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  if (path === "/embed" || path.startsWith("/e/")) { out.headers.delete("x-frame-options"); out.headers.set("content-security-policy", EMBED_CSP); }
  return out;
};
