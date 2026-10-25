import { parseParams } from "../../src/params";
import { buildPlan } from "../../src/plan";
import { reverseStreet } from "../../src/geocode";
import { overpassLandmarks } from "../../src/landmarks";
import { d1Repo, getPublic, ID_RE, toEmbedParams } from "../../src/store";
import type { Env } from "../../src/tiles";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const q = new URL(request.url).searchParams;
  const id = q.get("id");
  let r: ReturnType<typeof parseParams>;
  if (id) {
    // ID-only embed (/e/<id>): config from D1 via the ~60 s edge cache.
    if (!ID_RE.test(id) || !env.DB) return Response.json({ error: "not found" }, { status: 404 });
    const p = await getPublic(d1Repo(env.DB), id);
    if (!p || p.status === "disabled") return Response.json({ error: "not found" }, { status: 404 });
    r = { ok: true, params: toEmbedParams(p) };
  } else r = parseParams(q);
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  const street = r.params.street ? undefined : await reverseStreet(env, r.params.lat, r.params.lng).catch(() => undefined);
  const landmarks = r.params.landmarks ? await overpassLandmarks(env, r.params.lat, r.params.lng).catch(() => undefined) : undefined;
  return Response.json(buildPlan(r.params, { street, landmarks }), { headers: { "cache-control": `public, max-age=${id ? 60 : 300}` } });
};
