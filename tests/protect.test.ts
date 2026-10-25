import { describe, it, expect, vi, beforeEach } from "vitest";
import { honeypotTripped, tooFast, verifyTurnstile, makeGuard, hostnames, SITEVERIFY } from "../src/protect";
import { sendEditMail, mailConfigured } from "../src/mail";
import { handleCreate, handleResend, handleUpdate, _resetRate, type Repo, type BusinessRow } from "../src/store";

const ok = (o: unknown) => Promise.resolve(new Response(JSON.stringify(o), { status: 200 }));
const env = { TURNSTILE_SECRET_KEY: "test-secret" };
const good = { company_site: "", elapsedMs: 5000, turnstileToken: "tok" };

describe("honeypot and timing", () => {
  it("honeypot", () => {
    expect(honeypotTripped({})).toBe(false); expect(honeypotTripped({ company_site: "" })).toBe(false);
    expect(honeypotTripped({ company_site: "http://spam" })).toBe(true); expect(honeypotTripped({ company_site: 1 })).toBe(true);
  });
  it("time-to-submit", () => {
    expect(tooFast({ elapsedMs: 3500 })).toBe(false); expect(tooFast({ elapsedMs: 900 })).toBe(true);
    expect(tooFast({})).toBe(true); expect(tooFast({ elapsedMs: "9000" })).toBe(true);
  });
});

describe("verifyTurnstile", () => {
  it("posts secret+token to siteverify and accepts an allowed hostname", async () => {
    const f = vi.fn(() => ok({ success: true, hostname: "www.yahaay.com" }));
    expect(await verifyTurnstile(env, "tok", "1.2.3.4", f as never)).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SITEVERIFY);
    const b = init.body as URLSearchParams; expect(b.get("secret")).toBe("test-secret"); expect(b.get("response")).toBe("tok"); expect(b.get("remoteip")).toBe("1.2.3.4");
  });
  it("rejects failure, wrong hostname, network error, missing token or secret", async () => {
    expect(await verifyTurnstile(env, "tok", undefined, (() => ok({ success: false })) as never)).toBe(false);
    expect(await verifyTurnstile(env, "tok", undefined, (() => ok({ success: true, hostname: "evil.com" })) as never)).toBe(false);
    expect(await verifyTurnstile(env, "tok", undefined, (() => Promise.reject(new Error("x"))) as never)).toBe(false);
    expect(await verifyTurnstile(env, "", undefined, (() => ok({ success: true, hostname: "yahaay.com" })) as never)).toBe(false);
    expect(await verifyTurnstile({}, "tok", undefined, (() => ok({ success: true, hostname: "yahaay.com" })) as never)).toBe(false);
  });
  it("default hostname allowlist", () => {
    expect([...hostnames({})]).toEqual(["yahaay.com", "www.yahaay.com", "goto.yahaay.com", "business-finder-26j.pages.dev"]);
  });
});

describe("guard", () => {
  const pass = (() => ok({ success: true, hostname: "goto.yahaay.com" })) as never;
  it("orders checks and maps errors", async () => {
    const g = makeGuard(env, pass);
    expect(await g(good, "ip", "create")).toBeNull();
    expect(await g({ ...good, company_site: "x" }, "ip", "create")).toBe("submission rejected");
    expect(await g({ ...good, elapsedMs: 100 }, "ip", "create")).toBe("submission rejected");
    expect(await makeGuard({}, pass)(good, "ip", "create")).toBe("spam check not configured");
    expect(await makeGuard(env, (() => ok({ success: false })) as never)(good, "ip", "create")).toBe("spam check failed, please retry");
  });
});

function repo(): Repo & { rows: Map<string, BusinessRow> } {
  const rows = new Map<string, BusinessRow>();
  return {
    rows,
    async get(id) { return rows.get(id) ?? null; },
    async insert(id, b, h) { rows.set(id, { id, business_name: b.name, address: b.address, osm_ref: null, lat: b.lat, lng: b.lng, street_label: null, lgu_label: null, state_label: null,
      display_fields: JSON.stringify(b.display), options: JSON.stringify(b.options), owner_email: b.email, edit_token_hash: h, status: "active", created_at: "", updated_at: "" }); return true; },
    async update(id, b) { const r = rows.get(id)!; rows.set(id, { ...r, business_name: b.name, owner_email: b.email }); },
    async setStatus(id, s) { rows.get(id)!.status = s; },
    async listByEmail(e) { return [...rows.values()].filter((r) => r.owner_email === e); },
    async setTokenHash(id, h) { rows.get(id)!.edit_token_hash = h; },
  };
}
const biz = { name: "Cafe", address: "1 St", lat: -27.47, lng: 153.02, email: "Owner@Example.com" };
const post = (b: unknown) => new Request("https://x/api/business", { method: "POST", body: JSON.stringify(b) });

describe("create, mail, resend", () => {
  beforeEach(() => _resetRate());
  it("rejects bots before inserting and mails on success", async () => {
    const r = repo(), mail = vi.fn(async () => true);
    const deps = { guard: makeGuard(env, (() => ok({ success: true, hostname: "yahaay.com" })) as never), mail };
    expect((await handleCreate(post({ ...biz, ...good, company_site: "x" }), r, undefined, "a", undefined, deps)).status).toBe(403);
    expect(r.rows.size).toBe(0); expect(mail).not.toHaveBeenCalled();
    const res = await handleCreate(post({ ...biz, ...good }), r, undefined, "a", undefined, deps);
    expect(res.status).toBe(201); const j = await res.json() as { id: string; editToken: string; emailSent: boolean };
    expect(j.emailSent).toBe(true);
    expect(mail).toHaveBeenCalledWith({ to: "owner@example.com", businessName: "Cafe", id: j.id, token: j.editToken });
  });
  it("503 when Turnstile secret is missing", async () => {
    expect((await handleCreate(post({ ...biz, ...good }), repo(), undefined, "b", undefined, { guard: makeGuard({}) })).status).toBe(503);
  });
  it("resend rotates the token, mails, and never reveals whether the email exists", async () => {
    const r = repo(), mail = vi.fn(async () => true);
    const c = await (await handleCreate(post(biz), r, undefined, "c")).json() as { id: string; editToken: string };
    const old = r.rows.get(c.id)!.edit_token_hash;
    const rs = (b: unknown) => handleResend(new Request("https://x", { method: "POST", body: JSON.stringify(b) }), r, "c", { mail });
    expect((await rs({ email: "nobody@example.com" })).status).toBe(202); expect(mail).not.toHaveBeenCalled();
    expect((await rs({ email: "owner@example.com" })).status).toBe(202);
    expect(mail).toHaveBeenCalledTimes(1); expect(r.rows.get(c.id)!.edit_token_hash).not.toBe(old);
    expect((await rs({ email: "bad" })).status).toBe(400);
  });
  it("PUT without email keeps the stored owner email", async () => {
    const r = repo();
    const c = await (await handleCreate(post(biz), r, undefined, "d")).json() as { id: string; editToken: string };
    const put = new Request("https://x", { method: "PUT", headers: { authorization: "Bearer " + c.editToken }, body: JSON.stringify({ name: "Cafe 2", address: "1 St", lat: -27.47, lng: 153.02 }) });
    expect((await handleUpdate(put, c.id, r)).status).toBe(200);
    expect(r.rows.get(c.id)!.owner_email).toBe("owner@example.com");
  });
});

describe("mail relay", () => {
  it("needs secret + endpoint and sends the secret header", async () => {
    expect(mailConfigured({})).toBe(false);
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    const m = { to: "a@b.co", businessName: "C", id: "bf_abcdefgh", token: "bfe_x" };
    expect(await sendEditMail({ MAIL_ENDPOINT: "https://w/internal/bf-mail", BF_MAIL_SECRET: "s" }, m, f as never)).toBe(true);
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["x-bf-mail-secret"]).toBe("s");
    expect(await sendEditMail({ MAIL_ENDPOINT: "https://w" }, m, f as never)).toBe(false);
  });
});
