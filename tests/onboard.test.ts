import { describe, it, expect, beforeEach } from "vitest";
import { newBusinessId, isBusinessId, normaliseAddress, normaliseResults, geocode, _reset } from "../src/onboard";

describe("onboarding helpers", () => {
  beforeEach(() => _reset());
  it("generates bf_ + 8 base62", () => { for (let i = 0; i < 50; i++) expect(isBusinessId(newBusinessId())).toBe(true); });
  it("validates addresses", () => {
    expect(normaliseAddress("").ok).toBe(false);
    expect(normaliseAddress(5).ok).toBe(false);
    expect(normaliseAddress("x".repeat(201)).ok).toBe(false);
    expect(normaliseAddress("  1  Hornsby St ")).toEqual({ ok: true, q: "1 Hornsby St", key: "1 hornsby st" });
  });
  it("normalises Nominatim results", () => {
    expect(normaliseResults([{ display_name: "A", lat: "-33.7", lon: "151.1", osm_type: "way", osm_id: 12 }, { lat: "x" }]))
      .toEqual([{ display_name: "A", lat: -33.7, lng: 151.1, osm_ref: "W12" }]);
    expect(normaliseResults({})).toEqual([]);
  });
  it("calls Nominatim with UA, caches and throttles", async () => {
    const calls: any[] = []; const slept: number[] = []; let t = 1000;
    const f: any = async (u: string, init: any) => { calls.push([u, init]); return new Response(JSON.stringify([{ display_name: "A", lat: "1", lon: "2", osm_type: "node", osm_id: 3 }])); };
    const a = await geocode("a", "a", f, () => t, async (ms) => { slept.push(ms); });
    expect(a.matches[0].osm_ref).toBe("N3");
    expect(calls[0][0]).toContain("countrycodes=au");
    expect(calls[0][1].headers["User-Agent"]).toMatch(/BusinessFinder-dev/);
    expect((await geocode("a", "a", f, () => t)).cached).toBe(true);
    t = 1200; await geocode("b", "b", f, () => t, async (ms) => { slept.push(ms); });
    expect(slept).toEqual([800]);
    expect(calls.length).toBe(2);
  });
});

import { embedHost, embedTags, corsHeaders } from "../src/onboard";
describe("embed host, tags and CORS", () => {
  it("defaults to goto.yahaay.com and normalises", () => {
    expect(embedHost()).toBe("https://goto.yahaay.com");
    expect(embedHost("https://goto.yahaay.com/")).toBe("https://goto.yahaay.com");
    expect(embedHost("http://evil.example")).toBe("https://goto.yahaay.com");
    expect(embedHost("nonsense")).toBe("https://goto.yahaay.com");
  });
  it("builds ID-only tags", () => {
    const t = embedTags("https://goto.yahaay.com", "bf_7Kq2xR9a");
    expect(t.iframe).toContain("https://goto.yahaay.com/e/bf_7Kq2xR9a");
    expect(t.script).toBe(`<script src="https://goto.yahaay.com/embed.js" async></script>\n<div class="business-finder" data-id="bf_7Kq2xR9a"></div>`);
    expect(t.iframe).not.toMatch(/lat=|lng=|name=/);
  });
  it("allows only listed origins", () => {
    expect(corsHeaders("https://www.yahaay.com")?.["access-control-allow-origin"]).toBe("https://www.yahaay.com");
    expect(corsHeaders("http://100.70.42.126:8789")).not.toBeNull();
    expect(corsHeaders("https://evil.example")).toBeNull();
    expect(corsHeaders(null)).toBeNull();
  });
});
