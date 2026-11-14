import { z } from "zod/v3";
import { guarded, jsonProxy, nasaUrl, params } from "@/server/nasa/response";
import { parseCmr } from "@/server/nasa/parsers";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return guarded("cmr", async () => {
    const p = z
      .object({
        query: z.string().min(1).max(100).default("MOD13Q4N"),
        pageSize: z.coerce.number().int().min(1).max(50).default(10),
        pageNum: z.coerce.number().int().min(1).max(100).default(1),
      })
      .parse(params(request));
    return jsonProxy(
      "cmr",
      nasaUrl("https://cmr.earthdata.nasa.gov/search/collections.json", {
        keyword: p.query,
        page_size: p.pageSize,
        page_num: p.pageNum,
      }),
      (b) => parseCmr(JSON.parse(b)),
    );
  });
}
