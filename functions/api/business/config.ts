import { mailConfigured } from "../../../src/mail";
import type { Env } from "../../../src/tiles";
/** GET /api/business/config: public Turnstile site key and whether edit-link email is set up. No secrets. */
export const onRequestGet: PagesFunction<Env> = ({ env }) =>
  Response.json({ siteKey: env.TURNSTILE_SITE_KEY ?? "", ready: !!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY), email: mailConfigured(env) },
    { headers: { "cache-control": "no-store" } });
