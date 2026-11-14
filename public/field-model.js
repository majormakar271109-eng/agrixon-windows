/* AGRIXON — pure field-model helpers.
   No DOM, no WebGL: safe to unit-test in Node. */

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const rad = (d) => (d * Math.PI) / 180;
const lon2tile = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const lat2tile = (lat, z) => {
  const r = rad(lat);
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

/* The DEM proxy accepts z 0..14 (server.mjs). Never ask for z15. */
export const DEM_MAX_ZOOM = 14;

export function pickZoom(bbox) {
  const [w, s, e, n] = bbox;
  for (let z = DEM_MAX_ZOOM; z >= 10; z--) {
    const span = Math.max(lon2tile(e, z) - lon2tile(w, z), lat2tile(s, z) - lat2tile(n, z));
    if (span <= 2.2) return z;
  }
  return 10;
}

export const STAGES = [
  [0.0, 'Sowing'],
  [0.04, 'Emergence'],
  [0.12, 'Tillering / vegetative'],
  [0.34, 'Stem elongation'],
  [0.5, 'Heading / flowering'],
  [0.66, 'Grain fill'],
  [0.86, 'Ripening'],
  [1.0, 'Maturity']
];

export function stageName(f) {
  let name = STAGES[0][1];
  for (const [t, n] of STAGES) if (f >= t) name = n;
  return name;
}

export function gddBetween(daily, from, to, base) {
  let sum = 0;
  let days = 0;
  for (const d of daily || []) {
    if (!d || !d.date || d.date < from || d.date > to) continue;
    if (d.tMax == null || d.tMin == null) continue;
    sum += Math.max(0, (d.tMax + d.tMin) / 2 - base);
    days++;
  }
  return { gdd: sum, days };
}

/* Climatological fallback: seasonal sine, no observations. Labelled in the HUD. */
export function synthDaily(start, end) {
  const out = [];
  const t0 = Date.parse(start + 'T00:00:00Z');
  const t1 = Date.parse(end + 'T00:00:00Z');
  const amp = 17.5;
  const mean = 2.5;
  for (let t = t0; t <= t1; t += 864e5) {
    const d = new Date(t);
    const doy = Math.round((t - Date.parse(d.getUTCFullYear() + '-01-01T00:00:00Z')) / 864e5);
    const tm = mean - amp * Math.cos((2 * Math.PI * (doy - 105)) / 365);
    out.push({ date: d.toISOString().slice(0, 10), tMax: tm + 6, tMin: tm - 6, synthetic: true });
  }
  return out;
}

/* Logistic growth, normalised to 0..1. A model estimate, not a measurement. */
export function plantHeight(f) {
  const raw = 1 / (1 + Math.exp(-9 * (f - 0.42)));
  const lo = 1 / (1 + Math.exp(-9 * (0 - 0.42)));
  const hi = 1 / (1 + Math.exp(-9 * (1 - 0.42)));
  return clamp((raw - lo) / (hi - lo), 0, 1);
}
