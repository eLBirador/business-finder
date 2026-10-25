import { d1Repo, handleResend } from "../../../src/store";
import { makeGuard } from "../../../src/protect";
import { sendEditMail } from "../../../src/mail";
import type { Env } from "../../../src/tiles";
/** POST /api/business/resend: email a fresh edit link (rotates the edit token). */
export const onRequestPost: PagesFunction<Env> = ({ request, env }) => {
  if (!env.DB) return Response.json({ error: "storage not configured" }, { status: 503 });
  return handleResend(request, d1Repo(env.DB), request.headers.get("cf-connecting-ip") ?? "local", { guard: makeGuard(env), mail: (m) => sendEditMail(env, m) });
};
