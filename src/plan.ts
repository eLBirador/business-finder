import { findLgu, findState } from "./geo";
import type { EmbedParams } from "./params";
import { rankLandmarks, SAMPLE, type Landmark, type RankedLandmark } from "./landmarks";

export interface Keyframe {
  step: "state" | "lgu" | "location" | "street";
  center: [number, number]; zoom: number;
  flyMs: number; holdMs: number; label?: string;
}
export interface Plan { version: 1; target: [number, number]; name?: string; street?: string; keyframes: Keyframe[]; directionsUrl: string; landmarks: RankedLandmark[] }

// Phase 1 timings (PRD 6). Tune here: no frontend redeploy needed.
const T = { stateHold: 1500, lguFly: 2500, lguHold: 1000, locFly: 2500, streetDelay: 500 };
const LOCATION_ZOOM = 16;

/** Build the phase 1 animation plan: state overview -> LGU -> location area -> street label. */
export function buildPlan(p: EmbedParams, derived: { street?: string; landmarks?: Landmark[] } = {}): Plan {
  const target: [number, number] = [p.lng, p.lat];
  const state = findState(p.lng, p.lat);
  const lgu = findLgu(p.lng, p.lat);
  const lguLabel = p.lgu ?? lgu?.name;
  const street = p.street ?? derived.street;
  const kf: Keyframe[] = [];

  // Step 1: state overview, centre nudged 30% toward the location.
  const sc = state?.center ?? target;
  kf.push({ step: "state", center: [sc[0] + (p.lng - sc[0]) * 0.3, sc[1] + (p.lat - sc[1]) * 0.3],
    zoom: state?.zoom ?? 5, flyMs: 0, holdMs: T.stateHold,
    label: state ? `${state.name} (${state.abbr})` : undefined });

  // Step 2: LGU. Framed to the LGU if known, else a council-scale zoom on the target. Label skipped if unknown.
  kf.push({ step: "lgu", center: lgu?.center ?? target, zoom: lgu?.zoom ?? 11,
    flyMs: T.lguFly, holdMs: T.lguHold, label: lguLabel });

  // Step 3: location area, pin drops, business name.
  kf.push({ step: "location", center: target, zoom: LOCATION_ZOOM, flyMs: T.locFly, holdMs: 0, label: p.name });

  // Step 4: same view, street label shortly after.
  kf.push({ step: "street", center: target, zoom: LOCATION_ZOOM, flyMs: 0, holdMs: T.streetDelay, label: street });

  return { version: 1, target, name: p.name, street, keyframes: kf,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`,
    // Nearby landmarks (PRD 5.4): selected and ranked here, shown by the player only after the animation or on toggle.
    landmarks: p.landmarks ? rankLandmarks(p.lat, p.lng, derived.landmarks ?? SAMPLE) : [] };
}
