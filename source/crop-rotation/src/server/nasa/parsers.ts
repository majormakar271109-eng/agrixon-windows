import { z } from "zod/v3";
import type {
  ClimateDaily,
  FireDetection,
  NaturalEvent,
  CollectionSummary,
} from "../../domain/types";
const powerSchema = z.object({
  properties: z.object({
    parameter: z.record(z.record(z.number().nullable())),
  }),
  header: z.object({ fill_value: z.number().optional() }).optional(),
});
export function parsePower(input: unknown): ClimateDaily[] {
  const parsed = powerSchema.parse(input),
    p = parsed.properties.parameter,
    fill = parsed.header?.fill_value ?? -999;
  const value = (name: string, date: string) => {
    const v = p[name]?.[date];
    return v === undefined || v === null || v === fill || v <= -900 ? null : v;
  };
  return [...new Set(Object.values(p).flatMap((x) => Object.keys(x)))]
    .filter((d) => /^\d{8}$/.test(d))
    .sort()
    .map((d) => {
      const tMin = value("T2M_MIN", d);
      return {
        date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
        tMin,
        tMax: value("T2M_MAX", d),
        precipMm: value("PRECTOTCORR", d),
        soilMoisture: value("GWETROOT", d),
        radiation: value("ALLSKY_SFC_SW_DWN", d),
        windMs: value("WS2M", d),
        frost: tMin === null ? null : tMin < 0,
      };
    });
}
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Некорректный CSV");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
export function parseFirms(text: string): FireDetection[] {
  const [header, ...rows] = csvRows(text.replace(/^\uFEFF/, ""));
  if (
    !header?.includes("latitude") ||
    !header.includes("longitude") ||
    !header.includes("acq_date")
  )
    throw new Error("FIRMS вернул не CSV детекций");
  return rows
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])))
    .filter(
      (r) =>
        r.latitude !== "" &&
        r.longitude !== "" &&
        Number.isFinite(Number(r.latitude)) &&
        Number.isFinite(Number(r.longitude)),
    )
    .map((r) => ({
      lat: Number(r.latitude),
      lon: Number(r.longitude),
      date: r.acq_date,
      time: r.acq_time,
      confidence: r.confidence,
      frp:
        r.frp !== "" && Number.isFinite(Number(r.frp)) ? Number(r.frp) : null,
    }));
}
const eventSchema = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      link: z.string(),
      categories: z.array(z.object({ id: z.string() })),
      geometry: z.array(
        z.object({
          date: z.string(),
          type: z.string(),
          coordinates: z.unknown(),
        }),
      ),
    }),
  ),
});
export function parseEonet(input: unknown): NaturalEvent[] {
  return eventSchema.parse(input).events.map((e) => {
    const g = e.geometry.at(-1),
      coords =
        g?.type === "Point"
          ? z.tuple([z.number(), z.number()]).safeParse(g.coordinates)
          : null;
    return {
      id: e.id,
      title: e.title,
      categories: e.categories.map((c) => c.id),
      date: g?.date ?? null,
      coordinates: coords?.success ? coords.data : null,
      url: e.link,
    };
  });
}
const cmrSchema = z.object({
  feed: z.object({
    entry: z.array(
      z.object({
        id: z.string(),
        short_name: z.string(),
        title: z.string(),
        version_id: z.string().optional(),
      }),
    ),
  }),
});
export function parseCmr(input: unknown): CollectionSummary[] {
  return cmrSchema
    .parse(input)
    .feed.entry.map((e) => ({
      id: e.id,
      shortName: e.short_name,
      title: e.title,
      version: e.version_id ?? "",
      url: `https://cmr.earthdata.nasa.gov/search/concepts/${encodeURIComponent(e.id)}.html`,
    }));
}

export function parsePowerMetadata(input:unknown):{datasetId:string;resolution:string;nativeSources:string[];parameterUnits:Record<string,string>;timeStandard?:string}{
 const schema=z.object({header:z.object({sources:z.array(z.string()).optional(),time_standard:z.string().optional()}).optional(),parameters:z.record(z.object({units:z.string().optional()})).optional()});
 const value=schema.parse(input),nativeSources=value.header?.sources??[];
 const parameterUnits=Object.fromEntries(Object.entries(value.parameters??{}).flatMap(([key,meta])=>meta.units?[[key,meta.units]]:[]));
 return {datasetId:'NASA POWER Daily'+(nativeSources.length?' · '+nativeSources.join(' / '):''),resolution:'Региональная сетка POWER; зависит от источника и параметра, не датчик поля.',nativeSources,parameterUnits,...(value.header?.time_standard?{timeStandard:value.header.time_standard}:{})};
}
