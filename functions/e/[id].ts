import { EMBED_HTML } from "../embed";
import { d1Repo, getPublic, ID_RE } from "../../src/store";
import type { Env } from "../../src/tiles";
const notFound = () => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Map not found</title>
<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;font:500 14px/1.5 Inter,system-ui,sans-serif;color:#475569;background:#f8fafc;text-align:center;padding:16px;box-sizing:border-box}</style></head>
<body><p>This map isn't available.<br><a href="https://www.yahaay.com/business-finder/" target="_blank" rel="noopener" style="color:#4f46e5">Business Finder by Yahaay</a></p></body></html>`,
  { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
/** /e/<id>: the ID-only embed. Looks up the config (edge-cached ~60 s) and serves the player, which reads the plan by id. */
export const onRequestGet: PagesFunction<Env, "id"> = async ({ env, params }) => {
  const id = String(params.id);
  if (!ID_RE.test(id) || !env.DB) return notFound();
  const p = await getPublic(d1Repo(env.DB), id);
  if (!p || p.status === "disabled") return notFound();
  return new Response(EMBED_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
};
