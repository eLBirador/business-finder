/** Owner info card (step 3 fields). Every value is plain text; the player renders with textContent only. */
export interface InfoCard { tagline?: string; hours?: string; phone?: string; tel?: string; website?: string; websiteLabel?: string }
export interface EmbedParams { lat: number; lng: number; name?: string; street?: string; lgu?: string; autoplay: boolean; landmarks: boolean; info?: InfoCard }
export type ParseResult = { ok: true; params: EmbedParams } | { ok: false; error: string };

const clean = (v: string | null, max = 120) => {
  const s = (v ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
  return s || undefined;
};
const num = (v: string | null) => (v === null || v.trim() === "" ? NaN : Number(v));

/** Sanitise owner info fields. Website: only http/https URLs survive. Phone: digits and + ( ) - . space; tel is digits with optional leading +. */
export function sanitizeInfo(d: { tagline?: unknown; hours?: unknown; phone?: unknown; website?: unknown } | undefined): InfoCard | undefined {
  if (!d) return undefined;
  const t = (v: unknown, max: number) => (typeof v === "string" ? clean(v, max) : undefined);
  const out: InfoCard = {};
  const tagline = t(d.tagline, 120), hours = t(d.hours, 120);
  if (tagline) out.tagline = tagline;
  if (hours) out.hours = hours;
  const phone = t(d.phone, 30);
  if (phone && /^[0-9+().\- ]{3,30}$/.test(phone)) {
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length >= 3) { out.phone = phone; out.tel = (phone.trim().startsWith("+") ? "+" : "") + digits; }
  }
  const w = t(d.website, 200);
  if (w) {
    try {
      const u = new URL(w);
      if ((u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".") && !u.username && !u.password) {
        out.website = u.href; out.websiteLabel = (u.hostname.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname)).slice(0, 40);
      }
    } catch { /* dropped */ }
  }
  return Object.keys(out).length ? out : undefined;
}

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
      autoplay: !off(ap), landmarks: !off(lm),
      info: sanitizeInfo({ tagline: q.get("tagline") ?? undefined, hours: q.get("hours") ?? undefined, phone: q.get("phone") ?? undefined, website: q.get("website") ?? undefined }) },
  };
}
