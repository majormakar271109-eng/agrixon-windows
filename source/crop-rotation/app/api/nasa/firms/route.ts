import { z } from "zod/v3";
import {
  boxSchema,
  guarded,
  jsonProxy,
  params,
  unavailable,
} from "@/server/nasa/response";
import { parseFirms } from "@/server/nasa/parsers";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return guarded("firms", async () => {
    const p = z
      .object({
        bbox: boxSchema,
        days: z.coerce.number().int().min(1).max(10).default(3),
      })
      .parse(params(request));
    const key = process.env.FIRMS_MAP_KEY;
    if (!key)
      return unavailable(
        "firms",
        "KEY_REQUIRED",
        "Добавьте FIRMS_MAP_KEY на сервере.",
        424,
      );
    return jsonProxy(
      "firms",
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/VIIRS_SNPP_NRT/${p.bbox.join(",")}/${p.days}`,
      parseFirms,
      { periodEnd: new Date().toISOString().slice(0, 10) },
    );
  });
}
