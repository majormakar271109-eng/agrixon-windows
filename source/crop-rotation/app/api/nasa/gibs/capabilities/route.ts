import { guarded, jsonProxy } from "@/server/nasa/response";
import { parseCapabilities } from "@/server/nasa/gibs";
export const runtime = "nodejs";
export async function GET() {
  return guarded("gibs", () =>
    jsonProxy(
      "gibs",
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml",
      parseCapabilities,
    ),
  );
}
