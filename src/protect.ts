// Spam protection for public submissions (create, resend): honeypot, time-to-submit, Turnstile siteverify, durable per-IP limit.
export interface ProtectEnv { TURNSTILE_SECRET_KEY?: string; TURNSTILE_SITE_KEY?: string; TURNSTILE_HOSTNAMES?: string; DB?: D1Database }
export const DEFAULT_HOSTNAMES = "yahaay.com,www.yahaay.com,goto.yahaay.com,business-finder-26j.pages.dev";
export const MIN_SUBMIT_MS = 3000;
export const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function hostnames(env: ProtectEnv): Set<string> {
  return new Set((env.TURNSTILE_HOSTNAMES || DEFAULT_HOSTNAMES).split(",").map((h) => h.trim().toLowerCase()).filter(Boolean));
}
/** Honeypot: the hidden "company_site" field must be empty. */
export function honeypotTripped(b: Record<string, unknown>): boolean {
  const v = b.company_site; return typeof v === "string" ? v.trim() !== "" : v != null;
}
/** Client reports ms since the form was shown; anything under MIN_SUBMIT_MS (or missing) is treated as a bot. */
export function tooFast(b: Record<string, unknown>, min = MIN_SUBMIT_MS): boolean {
  const t = b.elapsedMs; return typeof t !== "number" || !Number.isFinite(t) || t < min;
}
export async function verifyTurnstile(env: ProtectEnv, token: unknown, ip: string | undefined, f: typeof fetch = fetch): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY || typeof token !== "string" || !token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (ip && ip !== "local") body.set("remoteip", ip);
  let r: { success?: boolean; hostname?: string };
  try {
    const res = await f(SITEVERIFY, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    if (!res.ok) return false;
    r = await res.json();
  } catch { return false; }
  return r.success === true && hostnames(env).has(String(r.hostname || "").toLowerCase());
}
/** Durable per-IP-hash hourly counter in D1 (table rate_limit). Returns true when over the limit. Fails open if D1 errors. */
export async function durableLimited(db: D1Database | undefined, ip: string, bucket: string, limit: number, now = Date.now()): Promise<boolean> {
  if (!db) return false;
  const hour = Math.floor(now / 3_600_000);
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`bf:${ip}`));
  const ipHash = [...new Uint8Array(d)].slice(0, 16).map((x) => x.toString(16).padStart(2, "0")).join("");
  try {
    const row = await db.prepare(`INSERT INTO rate_limit (ip_hash, bucket, hour, n) VALUES (?, ?, ?, 1)
      ON CONFLICT(ip_hash, bucket, hour) DO UPDATE SET n = n + 1 RETURNING n`).bind(ipHash, bucket, hour).first<{ n: number }>();
    if (Math.random() < 0.02) await db.prepare("DELETE FROM rate_limit WHERE hour < ?").bind(hour - 24).run();
    return (row?.n ?? 0) > limit;
  } catch { return false; }
}
export type Guard = (b: Record<string, unknown>, ip: string, action: "create" | "resend") => Promise<string | null>;
/** Returns an error message, or null when the submission may proceed. */
export function makeGuard(env: ProtectEnv, f: typeof fetch = fetch): Guard {
  return async (b, ip, action) => {
    if (honeypotTripped(b) || tooFast(b)) return "submission rejected";
    if (!env.TURNSTILE_SECRET_KEY) return "spam check not configured";
    if (!(await verifyTurnstile(env, b.turnstileToken, ip, f))) return "spam check failed, please retry";
    if (await durableLimited(env.DB, ip, action, action === "create" ? 20 : 5)) return "rate";
    return null;
  };
}
