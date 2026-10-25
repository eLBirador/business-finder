import { parseParams } from "../../src/params";
import { buildPlan } from "../../src/plan";
import { reverseStreet } from "../../src/geocode";
import { overpassLandmarks } from "../../src/landmarks";
import type { Env } from "../../src/tiles";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const r = parseParams(new URL(request.url).searchParams);
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  const street = r.params.street ? undefined : await reverseStreet(env, r.params.lat, r.params.lng).catch(() => undefined);
  const landmarks = r.params.landmarks ? await overpassLandmarks(env, r.params.lat, r.params.lng).catch(() => undefined) : undefined;
  return Response.json(buildPlan(r.params, { street, landmarks }), { headers: { "cache-control": "public, max-age=300" } });
};
