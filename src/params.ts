export interface EmbedParams { lat: number; lng: number; name?: string; street?: string; lgu?: string; autoplay: boolean; landmarks: boolean }
export type ParseResult = { ok: true; params: EmbedParams } | { ok: false; error: string };

const clean = (v: string | null, max = 120) => {
  const s = (v ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
  return s || undefined;
};
const num = (v: string | null) => (v === null || v.trim() === "" ? NaN : Number(v));

/** Parse PRD 5.2 params. Unknown params are ignored. */
export function parseParams(q: URLSearchParams): ParseResult {
  const lat = num(q.get("lat"));
  const lng = num(q.get("lng"));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { ok: false, error: "invalid lat" };
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { ok: false, error: "invalid lng" };
  const ap = q.get("autoplay");
  const lm = q.get("landmarks");
  const off = (v: string | null) => v !== null && ["false", "0", "no"].includes(v.toLowerCase());
  return {
    ok: true,
    params: { lat, lng, name: clean(q.get("name")), street: clean(q.get("street")), lgu: clean(q.get("lgu")),
      autoplay: !off(ap), landmarks: !off(lm) },
  };
}
