import type { Env } from "./tiles";
import { ua } from "./tiles";

export type LandmarkType = "station" | "shopping" | "park" | "school" | "hospital";
export interface Landmark { name: string; type: LandmarkType; lat: number; lng: number }
export interface RankedLandmark extends Landmark { distanceM: number; direction: string }

// Small bundled sample for the Thornleigh demo. Coordinates are approximate; replace with real data.
export const SAMPLE: Landmark[] = [
  { name: "Thornleigh Station", type: "station", lat: -33.7322, lng: 151.0785 },
  { name: "Thornleigh Marketplace", type: "shopping", lat: -33.7301, lng: 151.0806 },
  { name: "Thornleigh Oval", type: "park", lat: -33.7262, lng: 151.0770 },
  { name: "Thornleigh West Public School", type: "school", lat: -33.7250, lng: 151.0712 },
  { name: "Hornsby Ku-ring-gai Hospital", type: "hospital", lat: -33.7020, lng: 151.1060 }, // >1 km: filtered out by radius
];
export const RADIUS_M = 1000;
const MAX = 8;
const PRIORITY: Record<LandmarkType, number> = { station: 0, hospital: 1, shopping: 2, school: 3, park: 4 };

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function direction(aLat: number, aLng: number, bLat: number, bLng: number): string {
  const r = Math.PI / 180;
  const y = Math.sin((bLng - aLng) * r) * Math.cos(bLat * r);
  const x = Math.cos(aLat * r) * Math.sin(bLat * r) - Math.sin(aLat * r) * Math.cos(bLat * r) * Math.cos((bLng - aLng) * r);
  const deg = (Math.atan2(y, x) / r + 360) % 360;
  return ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(deg / 45) % 8];
}

/** Worker-side selection and ranking: within radius, by type priority then distance, capped. */
export function rankLandmarks(lat: number, lng: number, list: Landmark[], radius = RADIUS_M): RankedLandmark[] {
  return list
    .map((l) => ({ ...l, distanceM: Math.round(distanceM(lat, lng, l.lat, l.lng) / 10) * 10, direction: direction(lat, lng, l.lat, l.lng) }))
    .filter((l) => l.distanceM <= radius)
    .sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type] || a.distanceM - b.distanceM)
    .slice(0, MAX);
}

/** Optional OSM Overpass lookup (LANDMARKS_SOURCE=overpass), edge-cached 7 days, coords rounded to ~100 m. Off by default. */
export async function overpassLandmarks(env: Env, lat: number, lng: number): Promise<Landmark[] | undefined> {
  if (env.LANDMARKS_SOURCE !== "overpass") return undefined;
  const la = lat.toFixed(3), lo = lng.toFixed(3);
  const q = `[out:json][timeout:10];(nwr(around:${RADIUS_M},${la},${lo})[railway=station];nwr(around:${RADIUS_M},${la},${lo})[shop=mall];` +
    `nwr(around:${RADIUS_M},${la},${lo})[leisure=park][name];nwr(around:${RADIUS_M},${la},${lo})[amenity=school];nwr(around:${RADIUS_M},${la},${lo})[amenity=hospital]);out center 40;`;
  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q);
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const key = new Request(url);
  let res = cache && (await cache.match(key));
  if (!res) {
    const up = await fetch(url, { headers: { "User-Agent": ua(env) } });
    if (!up.ok) return undefined;
    res = new Response(up.body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=604800" } });
    if (cache) await cache.put(key, res.clone());
  }
  const j = (await res.json()) as { elements: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
  const typeOf = (t: Record<string, string>): LandmarkType | undefined =>
    t.railway === "station" ? "station" : t.shop === "mall" ? "shopping" : t.leisure === "park" ? "park" :
    t.amenity === "school" ? "school" : t.amenity === "hospital" ? "hospital" : undefined;
  return j.elements.flatMap((e) => {
    const t = e.tags ?? {}, type = typeOf(t), p = e.center ?? (e.lat != null ? { lat: e.lat, lon: e.lon! } : undefined);
    return t.name && type && p ? [{ name: t.name, type, lat: p.lat, lng: p.lon }] : [];
  });
}
