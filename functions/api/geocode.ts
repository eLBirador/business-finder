import { geocode, normaliseAddress } from "../../src/onboard";

/** TEMPORARY onboarding preview: POST {"address": "..."} -> {matches:[{display_name,lat,lng,osm_ref}]}. Browser never calls Nominatim. */
export const onRequestPost: PagesFunction = async ({ request }) => {
  let body: any = {};
  const ct = request.headers.get("content-type") || "";
  try { body = ct.includes("json") ? await request.json() : Object.fromEntries(await request.formData()); } catch { /* fallthrough */ }
  const n = normaliseAddress(body?.address);
  if (!n.ok) return Response.json({ error: n.error }, { status: 400 });
  try {
    const r = await geocode(n.q, n.key);
    return Response.json({ query: n.q, matches: r.matches, cached: r.cached, attribution: "Data © OpenStreetMap contributors, ODbL. Geocoding by Nominatim." });
  } catch {
    return Response.json({ error: "Address lookup unavailable, try again shortly" }, { status: 502 });
  }
};
