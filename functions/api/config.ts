import { embedHost } from "../../src/onboard";
import type { Env } from "../../src/tiles";
/** Public, non-secret page config (embed host for generated tags). */
export const onRequestGet: PagesFunction<Env> = ({ env }) =>
  Response.json({ embedHost: embedHost(env.EMBED_HOST) }, { headers: { "cache-control": "public, max-age=300" } });
