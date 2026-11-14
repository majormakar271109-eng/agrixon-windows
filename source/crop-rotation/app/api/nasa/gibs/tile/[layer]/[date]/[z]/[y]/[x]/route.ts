import { z } from "zod/v3";
import { isoDate } from "@/domain/schemas";
import {
  availableDate,
  layerSchema,
  parseCapabilities,
} from "@/server/nasa/gibs";
import { guarded, unavailable } from "@/server/nasa/response";
import { upstream, staleHours, TTL } from "@/server/nasa/client";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      layer: string;
      date: string;
      z: string;
      y: string;
      x: string;
    }>;
  },
) {
  return guarded("gibs", async () => {
    const p = z
      .object({
        layer: layerSchema,
        date: isoDate,
        z: z.coerce.number().int().min(0).max(9),
        y: z.coerce.number().int().min(0),
        x: z.coerce.number().int().min(0),
      })
      .parse(await context.params);
    if (p.x >= 2 ** p.z || p.y >= 2 ** p.z)
      return unavailable(
        "gibs",
        "INVALID_TILE",
        "Неверные координаты тайла",
        400,
      );
    const caps = await upstream(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml",
      false,
      (b) => {
        parseCapabilities(b);
      },
    );
    const layer = parseCapabilities(caps.entry.body).find(
      (l) => l.id === p.layer,
    );
    if (!layer?.matrixSet || !availableDate(layer.dates, p.date))
      return unavailable("gibs", "NO_IMAGE", "Нет снимка за эту дату.", 404);
    const { entry, stale } = await upstream(
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${p.layer}/default/${p.date}/${encodeURIComponent(layer.matrixSet)}/${p.z}/${p.y}/${p.x}.png`,
      true,
    );
    return new Response(Buffer.from(entry.body, "base64"), {
      headers: {
        "Content-Type": entry.contentType,
        "Cache-Control": `public, max-age=${stale ? 0 : Math.floor(TTL / 1000)}`,
        "X-NASA-Status": stale ? "stale" : "fresh",
        "X-NASA-Date": p.date,
        "X-NASA-Fetched-At": entry.fetchedAt,
        "X-NASA-Stale-Hours": String(staleHours(entry.fetchedAt)),
      },
    });
  });
}
