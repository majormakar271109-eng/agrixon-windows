import { z } from "zod/v3";
import { isoDate } from "@/domain/schemas";
import { layerSchema } from "@/server/nasa/gibs";
import { boxSchema, guarded, nasaUrl, params } from "@/server/nasa/response";
import { upstream, staleHours } from "@/server/nasa/client";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return guarded("worldview", async () => {
    const p = z
      .object({
        bbox: boxSchema,
        date: isoDate,
        layer: layerSchema,
        width: z.coerce.number().int().min(64).max(2048).default(1200),
        height: z.coerce.number().int().min(64).max(2048).default(800),
      })
      .parse(params(request));
    const { entry, stale } = await upstream(
      nasaUrl("https://wvs.earthdata.nasa.gov/api/v1/snapshot", {
        REQUEST: "GetSnapshot",
        TIME: p.date,
        BBOX: p.bbox.join(","),
        CRS: "EPSG:4326",
        LAYERS: p.layer,
        WRAP: "day",
        FORMAT: "image/png",
        WIDTH: p.width,
        HEIGHT: p.height,
      }),
      true,
    );
    return new Response(Buffer.from(entry.body, "base64"), {
      headers: {
        "Content-Type": entry.contentType,
        "X-NASA-Date": p.date,
        "X-NASA-Status": stale ? "stale" : "fresh",
        "X-NASA-Stale-Hours": String(staleHours(entry.fetchedAt)),
      },
    });
  });
}
