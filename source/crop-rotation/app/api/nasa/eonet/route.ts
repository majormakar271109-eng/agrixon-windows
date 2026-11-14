import { z } from "zod/v3";
import {
  boxSchema,
  guarded,
  jsonProxy,
  nasaUrl,
  params,
} from "@/server/nasa/response";
import { parseEonet } from "@/server/nasa/parsers";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return guarded("eonet", async () => {
    const p = z
      .object({
        bbox: boxSchema,
        days: z.coerce.number().int().min(1).max(365).default(30),
      })
      .parse(params(request));
    const [w, s, e, n] = p.bbox;
    return jsonProxy(
      "eonet",
      nasaUrl("https://eonet.gsfc.nasa.gov/api/v3/events", {
        bbox: [w, n, e, s].join(","),
        days: p.days,
        status: "all",
        limit: 500,
      }),
      (b) => parseEonet(JSON.parse(b)),
    );
  });
}
