import { findLgu, findState } from "./geo";
import type { EmbedParams, InfoCard } from "./params";
import { rankLandmarks, SAMPLE, type Landmark, type RankedLandmark } from "./landmarks";

export interface Keyframe {
  step: "state" | "lgu" | "location" | "street";
  center: [number, number]; zoom: number;
  flyMs: number; holdMs: number; label?: string;
}
/** Step 5 drone orbit (PRD 6): center stays locked on the pin; only pitch and bearing change. */
export interface Orbit {
  center: [number, number]; zoom: number;
  pitch: number; pitchInMs: number;
  bearingStart: number; bearingSweep: number; durationMs: number;
  easing: "linear" | "easeInOutSine";
  settlePitch: number; settleMs: number;
  /** Turn the Nearby landmarks layer on when the orbit starts (PRD 5.4/6). */
  landmarksOn: boolean;
}
export type Easing = "easeInOutSine";
/** Loop after the first pass (PRD 6.1): local suburb pull-back <-> location pulse; state and LGU views are never repeated. */
export interface LoopStep { step: "suburb" | "location"; center: [number, number]; zoom: number; pitch: number; bearing: number; flyMs: number; holdMs: number; orbit?: Orbit }
export interface Loop { enabled: boolean; repeat: "forever"; steps: LoopStep[] }
export interface Plan {
  /** Gentle easing for every flyTo step. */
  flyEasing: Easing; version: 1; target: [number, number]; name?: string; street?: string; info?: InfoCard; autoplay: boolean; keyframes: Keyframe[]; directionsUrl: string; orbit: Orbit; loop: Loop; landmarks: RankedLandmark[] }

// Phase 1 timings (PRD 6). Tune here: no frontend redeploy needed.
const T = { stateHold: 2500, lguFly: 4500, lguHold: 1500, locFly: 4500, streetDelay: 1000 };
const LOCATION_ZOOM = 16;
// Orbit starts one zoom level closer than the location step; zoom and pitch ease in together over pitchInMs.
// Loop pull-back stays within the suburb: centred on the business, suburbZoomOut levels out from the location step.
const LOOP = { suburbZoomOut: 2.5, suburbFly: 4500, suburbHold: 3500, locFly: 4500, locHold: 1500, orbitMs: 8000, orbitSweep: 90 };
const ORBIT = { zoom: LOCATION_ZOOM + 1, pitch: 58, pitchInMs: 3000, sweep: 180, durationMs: 17000, settlePitch: 45, settleMs: 2000 };

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

  return { version: 1, flyEasing: "easeInOutSine", target, name: p.name, street, info: p.info, autoplay: p.autoplay, keyframes: kf,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`,
    orbit: { center: target, zoom: ORBIT.zoom, pitch: ORBIT.pitch, pitchInMs: ORBIT.pitchInMs,
      bearingStart: 0, bearingSweep: ORBIT.sweep, durationMs: ORBIT.durationMs, easing: "easeInOutSine",
      settlePitch: ORBIT.settlePitch, settleMs: ORBIT.settleMs, landmarksOn: true },
    loop: buildLoop(target),
    // Nearby landmarks (PRD 5.4): selected and ranked here, shown by the player only after the animation or on toggle.
    landmarks: p.landmarks ? rankLandmarks(p.lat, p.lng, derived.landmarks ?? SAMPLE) : [] };
}

function buildLoop(target: [number, number]): Loop {
  // Shorter orbit each time the loop reaches the business; same locked-centre rules as step 5.
  const orbit: Orbit = { center: target, zoom: LOCATION_ZOOM + 1, pitch: ORBIT.pitch, pitchInMs: 2500,
    bearingStart: 0, bearingSweep: LOOP.orbitSweep, durationMs: LOOP.orbitMs, easing: "easeInOutSine",
    settlePitch: ORBIT.settlePitch, settleMs: 1500, landmarksOn: true };
  return { enabled: true, repeat: "forever", steps: [
    // Local pull-back around the business area (suburb scale), not the shire.
    { step: "suburb", center: target, zoom: LOCATION_ZOOM - LOOP.suburbZoomOut, pitch: 0, bearing: 0, flyMs: LOOP.suburbFly, holdMs: LOOP.suburbHold },
    { step: "location", center: target, zoom: LOCATION_ZOOM, pitch: 0, bearing: 0, flyMs: LOOP.locFly, holdMs: LOOP.locHold, orbit },
  ] };
}
