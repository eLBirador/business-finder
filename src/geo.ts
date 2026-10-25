// Draft lookups for labels. Bounding boxes are coarse; real boundaries (e.g. ABS / api.gis.ph) are a TODO.
export interface Area { name: string; abbr?: string; bbox: [number, number, number, number]; center: [number, number]; zoom: number }
// bbox = [minLng, minLat, maxLng, maxLat]; ordered smallest-first so ACT wins over NSW.
export const STATES: Area[] = [
  { name: "Australian Capital Territory", abbr: "ACT", bbox: [148.76, -35.92, 149.40, -35.12], center: [149.0, -35.5], zoom: 8 },
  { name: "Tasmania", abbr: "TAS", bbox: [143.8, -43.7, 148.5, -39.5], center: [146.6, -42.0], zoom: 6 },
  { name: "Victoria", abbr: "VIC", bbox: [140.96, -39.2, 149.98, -33.98], center: [144.8, -36.9], zoom: 5.6 },
  { name: "New South Wales", abbr: "NSW", bbox: [140.99, -37.51, 153.64, -28.15], center: [147.0, -32.5], zoom: 5 },
  { name: "Queensland", abbr: "QLD", bbox: [137.99, -29.18, 153.55, -10.05], center: [144.5, -20.5], zoom: 4.3 },
  { name: "South Australia", abbr: "SA", bbox: [129.0, -38.07, 141.0, -25.99], center: [135.5, -30.5], zoom: 4.8 },
  { name: "Northern Territory", abbr: "NT", bbox: [129.0, -26.0, 138.0, -10.9], center: [133.5, -19.0], zoom: 4.5 },
  { name: "Western Australia", abbr: "WA", bbox: [112.9, -35.2, 129.0, -13.6], center: [121.5, -25.5], zoom: 4.2 },
];
// Stub LGU lookup: pilot area only (Hornsby Shire, approximate bbox).
export const LGUS: Area[] = [
  { name: "Hornsby Shire", bbox: [150.95, -33.79, 151.23, -33.41], center: [151.09, -33.62], zoom: 10.3 },
];
const inBox = (a: Area, lng: number, lat: number) =>
  lng >= a.bbox[0] && lng <= a.bbox[2] && lat >= a.bbox[1] && lat <= a.bbox[3];
export const findState = (lng: number, lat: number) => STATES.find((s) => inBox(s, lng, lat));
export const findLgu = (lng: number, lat: number) => LGUS.find((l) => inBox(l, lng, lat));
