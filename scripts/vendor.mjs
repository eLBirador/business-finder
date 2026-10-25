// Copies the MapLibre GL JS bundle into public/vendor so Pages serves it (no third-party CDN).
import { mkdirSync, copyFileSync } from "node:fs";
mkdirSync("public/vendor", { recursive: true });
for (const f of ["maplibre-gl.js", "maplibre-gl.css"]) copyFileSync(`node_modules/maplibre-gl/dist/${f}`, `public/vendor/${f}`);
console.log("vendored maplibre-gl into public/vendor");
