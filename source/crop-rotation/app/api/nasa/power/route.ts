import { isoDate } from "@/domain/schemas";
import type { ApiEnvelope, ClimateDaily } from "@/domain/types";
import { parsePower, parsePowerMetadata } from "@/server/nasa/parsers";
import {
  coords,
  guarded,
  jsonProxy,
  nasaUrl,
  params,
} from "@/server/nasa/response";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return guarded("power", async () => {
    const p = coords
      .extend({ start: isoDate, end: isoDate })
      .refine(
        (x) =>
          x.start <= x.end &&
          Date.parse(x.end) - Date.parse(x.start) <= 370 * 86400000,
        "Не более 370 дней",
      )
      .parse(params(request));
    const url = nasaUrl(
      "https://power.larc.nasa.gov/api/temporal/daily/point",
      {
        parameters:
          "T2M_MIN,T2M_MAX,PRECTOTCORR,GWETROOT,ALLSKY_SFC_SW_DWN,WS2M",
        community: "AG",
        latitude: p.lat,
        longitude: p.lon,
        start: p.start.replaceAll("-", ""),
        end: p.end.replaceAll("-", ""),
        format: "JSON",
      },
    );
    let metadata: ReturnType<typeof parsePowerMetadata> | undefined;
    const response = await jsonProxy(
      "power",
      url,
      (b) => {const raw:unknown=JSON.parse(b);metadata=parsePowerMetadata(raw);return parsePower(raw);},
      { periodStart: p.start, periodEnd: p.end },
    );
    const body = (await response.json()) as ApiEnvelope<ClimateDaily[]>;
    if (body.data) {
      if(metadata)body.source={...body.source,...metadata};
      const valid = body.data.filter(
        (d) => d.tMin !== null || d.tMax !== null || d.precipMm !== null,
      );
      body.source.observedAt = valid.at(-1)?.date ?? null;
      body.source.periodEnd = valid.at(-1)?.date ?? null;
      if (!valid.length) {
        body.warnings.push(
          "Все значения ряда отсутствуют. Нули не подставляются.",
        );
        body.status = body.status === "stale" ? "stale" : "partial";
      } else if (
        body.data.some((d) => Object.values(d).some((v) => v === null))
      ) {
        body.status = body.status === "stale" ? "stale" : "partial";
        body.warnings.push(
          "Ряд содержит пропуски; проверьте покрытие окна вегетации.",
        );
      }
    }
    return Response.json(body, { status: response.status });
  });
}
