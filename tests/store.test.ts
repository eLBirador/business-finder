import { beforeEach, describe, expect, it } from "vitest";
import { _resetRate, bearer, handleCreate, handleDisable, handleRead, handleUpdate, hashToken, newEditToken, rateLimited, safeEqual, validateBusiness, verifyToken, publicView, type BusinessInput, type BusinessRow, type Repo } from "../src/store";
import { isBusinessId, newBusinessId } from "../src/onboard";

const good = { name: "Example Café", address: "1 Florence St, Hornsby NSW 2077", lat: -33.7046, lng: 151.1046, email: "Owner@Example.com",
  street: "Florence St", lgu: "Hornsby Shire", osmRef: "W173107616", display: { phone: "02 9000 0000", website: "https://example.com" }, options: { landmarks: false, autoplay: true } };

function memRepo(): Repo & { rows: Map<string, BusinessRow> } {
  const rows = new Map<string, BusinessRow>();
  const toRow = (id: string, b: BusinessInput, h: string, prev?: BusinessRow): BusinessRow => ({
    id, business_name: b.name, address: b.address, osm_ref: b.osmRef ?? null, lat: b.lat, lng: b.lng, street_label: b.street ?? null,
    lgu_label: b.lgu ?? null, state_label: b.state ?? null, display_fields: JSON.stringify(b.display), options: JSON.stringify(b.options),
    owner_email: b.email, edit_token_hash: h, status: prev?.status ?? "active", created_at: prev?.created_at ?? "t0", updated_at: prev ? "t1" : "t0" });
  return { rows,
    get: async (id) => rows.get(id) ?? null,
    insert: async (id, b, h) => { if (rows.has(id)) return false; rows.set(id, toRow(id, b, h)); return true; },
    update: async (id, b) => { const p = rows.get(id)!; rows.set(id, toRow(id, b, p.edit_token_hash, p)); },
    setStatus: async (id, s) => { rows.get(id)!.status = s; } };
}
const req = (method: string, body?: unknown, token?: string) => new Request("http://x/api/business", { method,
  headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => _resetRate());

describe("validateBusiness", () => {
  it("accepts a good body and normalises", () => {
    const v = validateBusiness(good); expect(v.ok).toBe(true);
    if (v.ok) { expect(v.value.email).toBe("owner@example.com"); expect(v.value.options).toEqual({ landmarks: false, autoplay: true }); }
  });
  it.each([
    [{ ...good, name: "" }, /name/], [{ ...good, name: "x".repeat(81) }, /name/], [{ ...good, address: undefined }, /address/],
    [{ ...good, lat: 91 }, /lat/], [{ ...good, lng: "151" }, /lng/], [{ ...good, email: "nope" }, /email/],
    [{ ...good, street: "x".repeat(81) }, /street/], [{ ...good, osmRef: "abc" }, /osmRef/],
    [{ ...good, display: { website: "example.com" } }, /website/], [{ ...good, display: { tagline: "x".repeat(121) } }, /tagline/],
    [{ ...good, options: { autoplay: "yes" } }, /autoplay/], [null, /object/],
  ])("rejects %#", (b, re) => { const v = validateBusiness(b); expect(v.ok).toBe(false); if (!v.ok) expect(v.error).toMatch(re); });
  it("defaults options to on", () => { const v = validateBusiness({ ...good, options: undefined }); expect(v.ok && v.value.options).toEqual({ landmarks: true, autoplay: true }); });
});

describe("ids and tokens", () => {
  it("generates bf_ ids", () => { for (let i = 0; i < 50; i++) expect(isBusinessId(newBusinessId())).toBe(true); });
  it("hashes and verifies tokens in constant-time compare", async () => {
    const t = newEditToken(); expect(t).toMatch(/^bfe_[A-Za-z0-9_-]{43}$/);
    const h = await hashToken(t); expect(h).toMatch(/^[0-9a-f]{64}$/); expect(h).not.toContain(t);
    expect(await verifyToken(t, h)).toBe(true); expect(await verifyToken(t + "x", h)).toBe(false); expect(await verifyToken(null, h)).toBe(false);
    expect(safeEqual("ab", "ab")).toBe(true); expect(safeEqual("ab", "ac")).toBe(false); expect(safeEqual("ab", "abc")).toBe(false);
  });
  it("parses bearer", () => { expect(bearer(req("PUT", {}, "abc"))).toBe("abc"); expect(bearer(req("PUT", {}))).toBeNull(); });
  it("rate limits per ip", () => { for (let i = 0; i < 10; i++) expect(rateLimited("1.1.1.1", 0)).toBe(false); expect(rateLimited("1.1.1.1", 1)).toBe(true); expect(rateLimited("2.2.2.2", 1)).toBe(false); expect(rateLimited("1.1.1.1", 11 * 60_000)).toBe(false); });
});

describe("handlers", () => {
  it("create → read → update → disable", async () => {
    const repo = memRepo();
    const c = await handleCreate(req("POST", good), repo, "https://goto.yahaay.com", "ip");
    expect(c.status).toBe(201);
    const j = await c.json() as { id: string; editToken: string; embed: { iframe: string; script: string } };
    expect(isBusinessId(j.id)).toBe(true);
    expect(j.embed.iframe).toContain(`https://goto.yahaay.com/e/${j.id}`);
    expect(j.embed.script).toContain(`data-id="${j.id}"`);
    expect(repo.rows.get(j.id)!.edit_token_hash).toBe(await hashToken(j.editToken));

    const r = await handleRead(j.id, repo); expect(r.status).toBe(200);
    const pub = await r.text(); expect(pub).not.toMatch(/owner|email|token|hash/i); expect(JSON.parse(pub).name).toBe("Example Café");

    expect((await handleUpdate(req("PUT", { ...good, name: "New" }), j.id, repo)).status).toBe(401);
    expect((await handleUpdate(req("PUT", { ...good, name: "New" }, "bfe_wrong"), j.id, repo)).status).toBe(401);
    const u = await handleUpdate(req("PUT", { ...good, name: "New" }, j.editToken), j.id, repo);
    expect(u.status).toBe(200); expect(((await u.json()) as { name: string }).name).toBe("New"); expect(repo.rows.get(j.id)!.updated_at).toBe("t1");
    expect((await handleUpdate(req("PUT", { ...good, lat: 999 }, j.editToken), j.id, repo)).status).toBe(400);

    expect((await handleDisable(req("DELETE", undefined, j.editToken), j.id, repo)).status).toBe(200);
    expect((await handleRead(j.id, repo)).status).toBe(404);
  });
  it("retries on id collision", async () => {
    const repo = memRepo(); const ids = ["bf_AAAAAAAA", "bf_AAAAAAAA", "bf_BBBBBBBB"]; let i = 0;
    const gen = () => ids[i++];
    await handleCreate(req("POST", good), repo, undefined, "a", gen);
    const c = await handleCreate(req("POST", good), repo, undefined, "a", gen);
    expect(((await c.json()) as { id: string }).id).toBe("bf_BBBBBBBB");
  });
  it("400s bad input, 404s unknown ids, 429s floods", async () => {
    const repo = memRepo();
    expect((await handleCreate(new Request("http://x", { method: "POST", body: "{" }), repo, undefined, "b")).status).toBe(400);
    expect((await handleRead("bf_ZZZZZZZZ", repo)).status).toBe(404);
    expect((await handleRead("../etc", repo)).status).toBe(404);
    expect((await handleUpdate(req("PUT", good, "t"), "bf_ZZZZZZZZ", repo)).status).toBe(404);
    for (let k = 0; k < 10; k++) await handleCreate(req("POST", good), repo, undefined, "flood");
    expect((await handleCreate(req("POST", good), repo, undefined, "flood")).status).toBe(429);
  });
  it("publicView hides private fields", () => {
    const p = publicView({ id: "bf_AAAAAAAA", business_name: "n", address: "a", osm_ref: null, lat: 1, lng: 2, street_label: null, lgu_label: null, state_label: null, display_fields: "{}", options: "{\"autoplay\":false}", owner_email: "e@x.co", edit_token_hash: "h", status: "active", created_at: "", updated_at: "" });
    expect(JSON.stringify(p)).not.toMatch(/e@x|"h"/); expect(p.options).toEqual({ landmarks: true, autoplay: false });
  });
});
