import { describe, it, expect } from "vitest";
import { buildPlan } from "../src/plan";
import { rewrite } from "../src/tiles";
const base = { lat: -33.729, lng: 151.079, autoplay: true, landmarks: true };
describe("buildPlan", () => {
  it("builds the phase 1 Thornleigh sequence with labels in order", () => {
    const plan = buildPlan({ ...base, name: "Your Business", street: "Pennant Hills Road" });
    expect(plan.keyframes.map((k) => k.step)).toEqual(["state", "lgu", "location", "street"]);
    expect(plan.keyframes.map((k) => k.label)).toEqual(["New South Wales (NSW)", "Hornsby Shire", "Your Business", "Pennant Hills Road"]);
    const total = plan.keyframes.reduce((s, k) => s + k.flyMs + k.holdMs, 0);
    expect(total).toBeGreaterThanOrEqual(7000); expect(total).toBeLessThanOrEqual(9000);
    expect(plan.keyframes[2].center).toEqual([151.079, -33.729]);
  });
  it("lgu param overrides lookup; derived street used when no override", () => {
    const plan = buildPlan({ ...base, lgu: "Custom Council" }, { street: "Derived St" });
    expect(plan.keyframes[1].label).toBe("Custom Council");
    expect(plan.keyframes[3].label).toBe("Derived St");
  });
  it("skips unknown labels but still plays (Melbourne: VIC, no LGU)", () => {
    const plan = buildPlan({ lat: -37.81, lng: 144.96, autoplay: true, landmarks: true });
    expect(plan.keyframes[0].label).toBe("Victoria (VIC)");
    expect(plan.keyframes[1].label).toBeUndefined();
    expect(plan.keyframes).toHaveLength(4);
  });
  it("ACT wins over NSW", () => {
    expect(buildPlan({ lat: -35.28, lng: 149.13, autoplay: true, landmarks: true }).keyframes[0].label).toBe("Australian Capital Territory (ACT)");
  });
  it("outside Australia: no state label", () => {
    expect(buildPlan({ lat: 14.6, lng: 121.0, autoplay: true, landmarks: true }).keyframes[0].label).toBeUndefined();
  });
});
describe("rewrite", () => {
  it("points upstream URLs at the worker", () => {
    expect(rewrite('{"url":"https://tiles.openfreemap.org/planet"}', "https://tiles.openfreemap.org", "http://x"))
      .toBe('{"url":"http://x/tiles/planet"}');
  });
});
import { rankLandmarks, SAMPLE, direction } from "../src/landmarks";
import { parseParams } from "../src/params";
describe("landmarks", () => {
  it("serves ranked Thornleigh sample within 1 km with plan, station first", () => {
    const plan = buildPlan({ ...base, landmarks: true });
    expect(plan.landmarks.length).toBe(4);
    expect(plan.landmarks[0].name).toBe("Thornleigh Station");
    expect(plan.landmarks.every((l) => l.distanceM <= 1000)).toBe(true);
    expect(plan.landmarks.find((l) => l.type === "hospital")).toBeUndefined();
  });
  it("landmarks=false gives none", () => {
    const r = parseParams(new URLSearchParams("lat=-33.729&lng=151.079&landmarks=false"));
    expect(r.ok && r.params.landmarks).toBe(false);
    expect(r.ok && buildPlan(r.params).landmarks).toEqual([]);
  });
  it("direction is compass words", () => {
    expect(direction(0, 0, 1, 0)).toBe("north");
    expect(rankLandmarks(-33.729, 151.079, SAMPLE)[0].direction).toBe("south");
  });
});
