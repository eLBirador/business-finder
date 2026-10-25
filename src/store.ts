// D1 storage for business configs (PRD 8). Pure helpers + a small repo interface so handlers are testable.
import { sanitizeInfo } from "./params";
import type { Guard } from "./protect";
import type { EditMail } from "./mail";
export interface Deps { guard?: Guard; mail?: (m: EditMail) => Promise<boolean> }
import { embedHost, embedTags, newBusinessId } from "./onboard";
import type { EmbedParams } from "./params";

export interface BusinessInput {
  name: string; address: string; osmRef?: string; lat: number; lng: number;
  street?: string; lgu?: string; state?: string; email: string;
  display: { phone?: string; website?: string; hours?: string; tagline?: string };
  options: { landmarks: boolean; autoplay: boolean };
}
export interface BusinessRow {
  id: string; business_name: string; address: string; osm_ref: string | null; lat: number; lng: number;
  street_label: string | null; lgu_label: string | null; state_label: string | null;
  display_fields: string; options: string; owner_email: string; edit_token_hash: string;
  status: string; created_at: string; updated_at: string;
}
export interface PublicBusiness {
  id: string; name: string; address: string; lat: number; lng: number;
  street?: string; lgu?: string; state?: string; display: BusinessInput["display"]; options: BusinessInput["options"]; status: string; updatedAt: string;
}
export interface Repo {
  get(id: string): Promise<BusinessRow | null>;
  insert(id: string, b: BusinessInput, tokenHash: string): Promise<boolean>; // false on id collision
  update(id: string, b: BusinessInput): Promise<void>;
  setStatus(id: string, status: string): Promise<void>;
  listByEmail?(email: string): Promise<BusinessRow[]>;
  setTokenHash?(id: string, hash: string): Promise<void>;
}

type V<T> = { ok: true; value: T } | { ok: false; error: string };
const str = (v: unknown, max: number): string | undefined | null => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!s) return undefined;
  return s.length > max ? null : s;
};
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/** Validate a create/update body. All limits are characters. */
export function validateBusiness(body: unknown): V<BusinessInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "body must be a JSON object" };
  const b = body as Record<string, unknown>;
  const name = str(b.name, 80);
  if (!name) return { ok: false, error: "name is required (max 80 characters)" };
  const address = str(b.address, 200);
  if (!address) return { ok: false, error: "address is required (max 200 characters)" };
  const lat = typeof b.lat === "number" ? b.lat : NaN, lng = typeof b.lng === "number" ? b.lng : NaN;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { ok: false, error: "lat must be a number between -90 and 90" };
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { ok: false, error: "lng must be a number between -180 and 180" };
  const email = str(b.email, 254);
  if (!email || !EMAIL.test(email)) return { ok: false, error: "a valid email is required" };
  const out: BusinessInput = { name, address, lat, lng, email: email.toLowerCase(), display: {}, options: { landmarks: true, autoplay: true } };
  for (const [k, key, max] of [["osmRef", "osmRef", 40], ["street", "street", 80], ["lgu", "lgu", 80], ["state", "state", 60]] as const) {
    const v = str(b[key], max); if (v === null) return { ok: false, error: `${key} is too long or not text (max ${max})` };
    if (v) (out as unknown as Record<string, string>)[k] = v;
  }
  if (out.osmRef && !/^[NWR]\d{1,15}$/.test(out.osmRef)) return { ok: false, error: "osmRef must look like W123456" };
  const d = (b.display ?? {}) as Record<string, unknown>;
  if (typeof d !== "object") return { ok: false, error: "display must be an object" };
  for (const [key, max] of [["phone", 30], ["website", 200], ["hours", 120], ["tagline", 120]] as const) {
    const v = str(d[key], max); if (v === null) return { ok: false, error: `display.${key} is too long or not text (max ${max})` };
    if (v) out.display[key] = v;
  }
  if (out.display.website && !/^https?:\/\/[^\s]+\.[^\s]+$/.test(out.display.website)) return { ok: false, error: "display.website must start with http(s)://" };
  const o = (b.options ?? {}) as Record<string, unknown>;
  for (const key of ["landmarks", "autoplay"] as const) {
    if (o[key] === undefined) continue;
    if (typeof o[key] !== "boolean") return { ok: false, error: `options.${key} must be true or false` };
    out.options[key] = o[key] as boolean;
  }
  return { ok: true, value: out };
}

export function publicView(r: BusinessRow): PublicBusiness {
  const j = (s: string) => { try { return JSON.parse(s); } catch { return {}; } };
  const o = j(r.options);
  return { id: r.id, name: r.business_name, address: r.address, lat: r.lat, lng: r.lng,
    street: r.street_label ?? undefined, lgu: r.lgu_label ?? undefined, state: r.state_label ?? undefined,
    display: j(r.display_fields), options: { landmarks: o.landmarks !== false, autoplay: o.autoplay !== false },
    status: r.status, updatedAt: r.updated_at };
}
export function toEmbedParams(p: PublicBusiness): EmbedParams {
  return { lat: p.lat, lng: p.lng, name: p.name, street: p.street, lgu: p.lgu, autoplay: p.options.autoplay, landmarks: p.options.landmarks, info: sanitizeInfo(p.display) };
}

// ---- tokens ----
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
export function newEditToken(): string {
  const b = new Uint8Array(32); crypto.getRandomValues(b);
  return "bfe_" + btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function hashToken(t: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)));
}
/** Constant-time compare of two equal-length hex strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function verifyToken(token: string | null | undefined, hash: string): Promise<boolean> {
  if (!token || token.length > 200) return false;
  return safeEqual(await hashToken(token), hash);
}
export function bearer(req: Request): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? ""); return m ? m[1] : null;
}

// ---- rate limit (in-memory, per isolate; best effort only) ----
const hits = new Map<string, number[]>();
export function rateLimited(ip: string, now = Date.now(), limit = 10, windowMs = 10 * 60_000): boolean {
  const a = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (a.length >= limit) { hits.set(ip, a); return true; }
  a.push(now); hits.set(ip, a);
  if (hits.size > 5000) hits.clear();
  return false;
}
export function _resetRate() { hits.clear(); }

// ---- edge cache for public reads (~60 s) ----
export const CACHE_TTL = 60;
const cacheKey = (id: string) => new Request(`https://bf-cache.internal/business/${id}`);
const edge = (): Cache | undefined => (typeof caches !== "undefined" ? (caches as unknown as { default?: Cache }).default : undefined);
export async function getPublic(repo: Repo, id: string): Promise<PublicBusiness | null> {
  const c = edge();
  if (c) { try { const hit = await c.match(cacheKey(id)); if (hit) return (await hit.json()) as PublicBusiness; } catch { /* cache optional */ } }
  const row = await repo.get(id);
  if (!row) return null;
  const p = publicView(row);
  if (c) { try { await c.put(cacheKey(id), Response.json(p, { headers: { "cache-control": `public, max-age=${CACHE_TTL}` } })); } catch { /* ignore */ } }
  return p;
}
export async function purge(id: string) { const c = edge(); if (c) { try { await c.delete(cacheKey(id)); } catch { /* ignore */ } } }

// ---- handlers ----
const json = (b: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(b, { status, headers: { "cache-control": "no-store", ...extra } });
async function readJson(req: Request): Promise<unknown> {
  const t = await req.text(); if (t.length > 8192) throw new Error("too large");
  return JSON.parse(t);
}
export const ID_RE = /^bf_[A-Za-z0-9]{8,10}$/;

const RATE = () => json({ error: "too many requests, try again later" }, 429, { "retry-after": "600" });
async function guarded(deps: Deps, body: unknown, ip: string, action: "create" | "resend"): Promise<Response | null> {
  if (!deps.guard) return null;
  const e = await deps.guard((body && typeof body === "object" ? body : {}) as Record<string, unknown>, ip, action);
  if (!e) return null;
  if (e === "rate") return RATE();
  return json({ error: e }, e === "spam check not configured" ? 503 : 403);
}
export async function handleCreate(req: Request, repo: Repo, host: string | undefined, ip: string, gen = newBusinessId, deps: Deps = {}): Promise<Response> {
  if (rateLimited(ip)) return RATE();
  let body: unknown; try { body = await readJson(req); } catch { return json({ error: "invalid JSON" }, 400); }
  const v = validateBusiness(body); if (!v.ok) return json({ error: v.error }, 400);
  const g = await guarded(deps, body, ip, "create"); if (g) return g;
  const token = newEditToken(), h = await hashToken(token);
  for (let i = 0; i < 5; i++) {
    const id = gen();
    if (await repo.insert(id, v.value, h)) {
      const emailSent = deps.mail ? await deps.mail({ to: v.value.email, businessName: v.value.name, id, token }).catch(() => false) : false;
      return json({ id, editToken: token, embed: embedTags(embedHost(host), id), emailSent }, 201);
    }
  }
  return json({ error: "could not allocate an ID, try again" }, 503);
}
export async function handleRead(id: string, repo: Repo): Promise<Response> {
  if (!ID_RE.test(id)) return json({ error: "not found" }, 404);
  const p = await getPublic(repo, id);
  if (!p || p.status === "disabled") return json({ error: "not found" }, 404);
  return json(p, 200, { "cache-control": `public, max-age=${CACHE_TTL}` });
}
async function authed(req: Request, id: string, repo: Repo): Promise<BusinessRow | Response> {
  if (!ID_RE.test(id)) return json({ error: "not found" }, 404);
  const row = await repo.get(id);
  const ok = row ? await verifyToken(bearer(req), row.edit_token_hash) : (await hashToken("x"), false);
  if (!row) return json({ error: "not found" }, 404);
  if (!ok) return json({ error: "invalid or missing edit token" }, 401, { "www-authenticate": "Bearer" });
  return row;
}
export async function handleUpdate(req: Request, id: string, repo: Repo): Promise<Response> {
  const row = await authed(req, id, repo); if (row instanceof Response) return row;
  let body: unknown; try { body = await readJson(req); } catch { return json({ error: "invalid JSON" }, 400); }
  // Email is optional on update: the edit view does not know it, so keep the stored one.
  if (body && typeof body === "object" && !(body as Record<string, unknown>).email) (body as Record<string, unknown>).email = row.owner_email;
  const v = validateBusiness(body); if (!v.ok) return json({ error: v.error }, 400);
  await repo.update(id, v.value); await purge(id);
  const fresh = await repo.get(id);
  return json(fresh ? publicView(fresh) : { id });
}
export async function handleDisable(req: Request, id: string, repo: Repo): Promise<Response> {
  const row = await authed(req, id, repo); if (row instanceof Response) return row;
  await repo.setStatus(id, "disabled"); await purge(id);
  return json({ id, status: "disabled" });
}

/** POST /api/business/resend {email}: email a fresh edit link for each active business on that address.
 *  The token is only stored hashed, so this rotates it (old links and keys stop working). Always 202, so it cannot probe emails. */
export async function handleResend(req: Request, repo: Repo, ip: string, deps: Deps = {}): Promise<Response> {
  if (rateLimited("resend:" + ip, Date.now(), 5)) return RATE();
  let body: unknown; try { body = await readJson(req); } catch { return json({ error: "invalid JSON" }, 400); }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/.test(email) || email.length > 254) return json({ error: "enter a valid email" }, 400);
  const g = await guarded(deps, body, ip, "resend"); if (g) return g;
  if (deps.mail && repo.listByEmail && repo.setTokenHash) {
    for (const row of (await repo.listByEmail(email)).filter((r) => r.status !== "disabled").slice(0, 5)) {
      const token = newEditToken();
      await repo.setTokenHash(row.id, await hashToken(token));
      await deps.mail({ to: email, businessName: row.business_name, id: row.id, token }).catch(() => false);
    }
  }
  return json({ ok: true, message: "If that email has a Business Finder map, we have sent its edit link." }, 202);
}

/** D1-backed repo. */
export function d1Repo(db: D1Database): Repo {
  const now = () => new Date().toISOString();
  return {
    get: (id) => db.prepare("SELECT * FROM business_config WHERE id = ?").bind(id).first<BusinessRow>(),
    async insert(id, b, h) {
      const r = await db.prepare(`INSERT OR IGNORE INTO business_config
        (id,business_name,address,osm_ref,lat,lng,street_label,lgu_label,state_label,display_fields,options,owner_email,edit_token_hash,status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'active')`)
        .bind(id, b.name, b.address, b.osmRef ?? null, b.lat, b.lng, b.street ?? null, b.lgu ?? null, b.state ?? null,
          JSON.stringify(b.display), JSON.stringify(b.options), b.email, h).run();
      return (r.meta?.changes ?? 0) > 0;
    },
    async update(id, b) {
      await db.prepare(`UPDATE business_config SET business_name=?,address=?,osm_ref=?,lat=?,lng=?,street_label=?,lgu_label=?,state_label=?,
        display_fields=?,options=?,owner_email=?,updated_at=? WHERE id=?`)
        .bind(b.name, b.address, b.osmRef ?? null, b.lat, b.lng, b.street ?? null, b.lgu ?? null, b.state ?? null,
          JSON.stringify(b.display), JSON.stringify(b.options), b.email, now(), id).run();
    },
    async listByEmail(email) { return (await db.prepare("SELECT * FROM business_config WHERE owner_email = ? ORDER BY created_at DESC LIMIT 5").bind(email).all<BusinessRow>()).results ?? []; },
    async setTokenHash(id, h) { await db.prepare("UPDATE business_config SET edit_token_hash=?, updated_at=? WHERE id=?").bind(h, now(), id).run(); },
    async setStatus(id, s) { await db.prepare("UPDATE business_config SET status=?, updated_at=? WHERE id=?").bind(s, now(), id).run(); },
  };
}
