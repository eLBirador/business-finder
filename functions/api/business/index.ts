import { d1Repo, handleCreate } from "../../../src/store";
import { newBusinessId } from "../../../src/onboard";
import { makeGuard } from "../../../src/protect";
import { sendEditMail } from "../../../src/mail";
import type { Env } from "../../../src/tiles";
/** POST /api/business: create a business config (PRD 7, 8). Turnstile + honeypot + timing + rate limits, then magic-link mail. */
export const onRequestPost: PagesFunction<Env> = ({ request, env }) => {
  if (!env.DB) return Response.json({ error: "storage not configured" }, { status: 503 });
  return handleCreate(request, d1Repo(env.DB), env.EMBED_HOST, request.headers.get("cf-connecting-ip") ?? "local", newBusinessId,
    { guard: makeGuard(env), mail: (m) => sendEditMail(env, m) });
};
