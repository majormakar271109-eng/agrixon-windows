import type { Field, Polygon, Position } from "./types";
const R = 6371008.8;
const rad = (v: number) => (v * Math.PI) / 180;
export function areaHa(g: Polygon): number {
  return (
    Math.abs(
      g.coordinates.reduce((total, ring, i) => {
        let sum = 0;
        for (let j = 0; j < ring.length - 1; j++) {
          const a = ring[j],
            b = ring[j + 1];
          sum +=
            rad(b[0] - a[0]) * (2 + Math.sin(rad(a[1])) + Math.sin(rad(b[1])));
        }
        return total + (i === 0 ? 1 : -1) * Math.abs((sum * R * R) / 2);
      }, 0),
    ) / 10000
  );
}
export function centroid(g: Polygon): Position {
  const r = g.coordinates[0];
  let a = 0,
    x = 0,
    y = 0;
  for (let i = 0; i < r.length - 1; i++) {
    const p = r[i],
      q = r[i + 1],
      c = p[0] * q[1] - q[0] * p[1];
    a += c;
    x += (p[0] + q[0]) * c;
    y += (p[1] + q[1]) * c;
  }
  return Math.abs(a) < 1e-12 ? [r[0][0], r[0][1]] : [x / (3 * a), y / (3 * a)];
}
export function bbox(
  fields: Field[],
  pad = 0,
): [number, number, number, number] {
  const all = fields.flatMap((f) => f.geometry.coordinates[0]);
  if (!all.length) return [66.9, 47.7, 67.6, 48.2];
  return [
    Math.min(...all.map((p) => p[0])) - pad,
    Math.min(...all.map((p) => p[1])) - pad,
    Math.max(...all.map((p) => p[0])) + pad,
    Math.max(...all.map((p) => p[1])) + pad,
  ];
}
export function pointInPolygon(p: Position, g: Polygon): boolean {
  const ring = g.coordinates[0];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function distanceToFieldKm(p: Position, g: Polygon): number {
  if (pointInPolygon(p, g)) return 0;
  const ring = g.coordinates[0],
    cos = Math.cos(rad(p[1]));
  const xy = (q: Position): Position => [
    rad(q[0] - p[0]) * R * cos,
    rad(q[1] - p[1]) * R,
  ];
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = xy(ring[i]),
      b = xy(ring[i + 1]),
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      t = Math.max(
        0,
        Math.min(1, -(a[0] * dx + a[1] * dy) / (dx * dx + dy * dy || 1)),
      );
    best = Math.min(best, Math.hypot(a[0] + t * dx, a[1] + t * dy));
  }
  return best / 1000;
}
export function validPolygon(g: Polygon): boolean {
  const r = g.coordinates[0];
  if (g.coordinates.length !== 1 || r.length < 4 || r.length > 1000)
    return false;
  if (
    r.some(
      (p) =>
        !Number.isFinite(p[0]) ||
        !Number.isFinite(p[1]) ||
        Math.abs(p[0]) > 180 ||
        Math.abs(p[1]) > 85,
    )
  )
    return false;
  if (r[0][0] !== r.at(-1)?.[0] || r[0][1] !== r.at(-1)?.[1]) return false;
  const cross = (a: Position, b: Position, c: Position) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < r.length - 1; i++)
    for (let j = i + 2; j < r.length - 1; j++) {
      if (i === 0 && j === r.length - 2) continue;
      const a = r[i],
        b = r[i + 1],
        c = r[j],
        d = r[j + 1];
      if (
        cross(a, b, c) * cross(a, b, d) <= 0 &&
        cross(c, d, a) * cross(c, d, b) <= 0 &&
        Math.max(a[0], b[0]) >= Math.min(c[0], d[0]) &&
        Math.max(c[0], d[0]) >= Math.min(a[0], b[0]) &&
        Math.max(a[1], b[1]) >= Math.min(c[1], d[1]) &&
        Math.max(c[1], d[1]) >= Math.min(a[1], b[1])
      )
        return false;
    }
  return areaHa(g) > 0.01;
}
