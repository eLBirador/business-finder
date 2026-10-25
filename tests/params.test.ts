import { describe, it, expect } from "vitest";
import { parseParams } from "../src/params";
const p = (s: string) => parseParams(new URLSearchParams(s));
describe("parseParams", () => {
  it("parses valid params and defaults autoplay to true", () => {
    const r = p("lat=-33.7290&lng=151.0790&name=Your%20Business&foo=bar");
    expect(r).toEqual({ ok: true, params: { lat: -33.729, lng: 151.079, name: "Your Business", street: undefined, lgu: undefined, autoplay: true, landmarks: true } });
  });
  it("rejects missing or out-of-range coords", () => {
    expect(p("lng=151").ok).toBe(false);
    expect(p("lat=abc&lng=151").ok).toBe(false);
    expect(p("lat=-91&lng=151").ok).toBe(false);
    expect(p("lat=10&lng=181").ok).toBe(false);
  });
  it("handles autoplay=false and trims text", () => {
    const r = p("lat=1&lng=2&autoplay=false&street=%20Main%20St%20");
    expect(r.ok && r.params.autoplay).toBe(false);
    expect(r.ok && r.params.street).toBe("Main St");
  });
});
