import { describe, it, expect } from "vitest";
import { sanitizeInfo, parseParams } from "../src/params";
import { buildPlan } from "../src/plan";
import { toEmbedParams, publicView } from "../src/store";

describe("sanitizeInfo", () => {
  it("keeps http/https websites only", () => {
    expect(sanitizeInfo({ website: "https://www.example.com.au/menu" })).toMatchObject({ website: "https://www.example.com.au/menu", websiteLabel: "example.com.au/menu" });
    for (const w of ["javascript:alert(1)", "data:text/html,x", "ftp://a.com", "https://user:pw@a.com", "http://localhost"]) expect(sanitizeInfo({ website: w })).toBeUndefined();
  });
  it("builds tel from a phone and rejects junk", () => {
    expect(sanitizeInfo({ phone: "+61 7 3000 0000" })).toMatchObject({ tel: "+61730000000" });
    expect(sanitizeInfo({ phone: "(07) 3000-0000" })?.tel).toBe("0730000000");
    expect(sanitizeInfo({ phone: "<script>" })).toBeUndefined();
  });
  it("strips control chars and caps length, leaves text for textContent", () => {
    const r = sanitizeInfo({ tagline: "a\u0000<b>x</b>" + "y".repeat(300), hours: 5 as unknown as string })!;
    expect(r.tagline!.length).toBe(120); expect(r.tagline).not.toContain("\u0000"); expect(r.hours).toBeUndefined();
  });
});

describe("passthrough", () => {
  it("raw /embed params reach the plan", () => {
    const r = parseParams(new URLSearchParams("lat=-27.47&lng=153.02&name=Cafe&tagline=Best%20coffee&hours=7-3&phone=0730000000&website=https://a.com.au&autoplay=0&landmarks=0"));
    if (!r.ok) throw new Error();
    const p = buildPlan(r.params);
    expect(p.info).toMatchObject({ tagline: "Best coffee", hours: "7-3", tel: "0730000000", website: "https://a.com.au/" });
    expect(p.autoplay).toBe(false); expect(p.landmarks).toEqual([]);
  });
  it("D1 display fields reach the plan without the email", () => {
    const row = { id: "bf_abcdefgh", business_name: "Cafe", address: "1 St", osm_ref: null, lat: -27.47, lng: 153.02, street_label: null, lgu_label: null, state_label: null,
      display_fields: JSON.stringify({ phone: "0730000000", website: "https://a.com.au", tagline: "Hi" }), options: JSON.stringify({ landmarks: false, autoplay: false }),
      owner_email: "o@x.com", edit_token_hash: "h", status: "active", created_at: "", updated_at: "" } as never;
    const plan = buildPlan(toEmbedParams(publicView(row)));
    expect(plan.info?.tel).toBe("0730000000"); expect(plan.autoplay).toBe(false);
    expect(JSON.stringify(plan)).not.toContain("o@x.com");
  });
});
