import { d1Repo, handleCreate } from "../../../src/store";
import type { Env } from "../../../src/tiles";
/** POST /api/business: create a business config (PRD 7, 8). */
export const onRequestPost: PagesFunction<Env> = ({ request, env }) => {
  if (!env.DB) return Response.json({ error: "storage not configured" }, { status: 503 });
  return handleCreate(request, d1Repo(env.DB), env.EMBED_HOST, request.headers.get("cf-connecting-ip") ?? "local");
};
