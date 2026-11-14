import type { ClimateDaily, Crop, Planting, Season } from "./types";
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (
    let t = Date.parse(start + "T00:00:00Z");
    t <= Date.parse(end + "T00:00:00Z");
    t += 86400000
  )
    out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
export function computeGdd(climate: ClimateDaily[], crop: Crop): number {
  return climate.reduce(
    (s, d) =>
      d.tMax === null || d.tMin === null
        ? s
        : s + Math.max(0, (d.tMax + d.tMin) / 2 - crop.gddBase),
    0,
  );
}
export function growingWindow(
  season: Season,
  planting?: Planting,
): [string, string] {
  return [
    planting?.plantedAt ?? `${season.year}-05-01`,
    planting?.harvestedAt ?? `${season.year}-09-30`,
  ];
}
export function subset(
  climate: ClimateDaily[],
  start: string,
  end: string,
): ClimateDaily[] {
  return climate
    .filter((d) => d.date >= start && d.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function dryWindows(
  climate: ClimateDaily[],
  days = 14,
  threshold = 1,
): { start: string; end: string; days: number }[] {
  const out: { start: string; end: string; days: number }[] = [];
  let run: ClimateDaily[] = [];
  const flush = () => {
    if (run.length >= days)
      out.push({
        start: run[0].date,
        end: run[run.length - 1].date,
        days: run.length,
      });
    run = [];
  };
  for (const d of [...climate].sort((a, b) => a.date.localeCompare(b.date))) {
    if (
      run.length &&
      Date.parse(d.date) - Date.parse(run[run.length - 1].date) !== 86400000
    )
      flush();
    if (d.precipMm !== null && d.precipMm < threshold) run.push(d);
    else flush();
  }
  flush();
  return out;
}
export const mean = (v: (number | null)[]) => {
  const a = v.filter((x): x is number => x !== null);
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
};
