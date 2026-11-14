import "server-only";
import { z } from "zod/v3";
import type { ApiEnvelope, SourceRef } from "../../domain/types";
import { sourceRef } from "../../config/sources";
import { NasaError, TTL, staleHours, upstream, transportMessage } from "./client";
export async function jsonProxy<T>(
  id: string,
  url: string,
  parse: (data: string) => T,
  source?: Partial<SourceRef>,
): Promise<Response> {
  try {
    const { entry, stale } = await upstream(url, false, (b) => {
      parse(b);
    });
    const data = parse(entry.body);
    const value: ApiEnvelope<T> = {
      data,
      status: stale ? "stale" : "fresh",
      source: { ...sourceRef(id), ...source, fetchedAt: entry.fetchedAt },
      cache: {
        fetchedAt: entry.fetchedAt,
        expiresAt: new Date(Date.parse(entry.fetchedAt) + TTL).toISOString(),
        staleAgeHours: stale ? staleHours(entry.fetchedAt) : 0,
      },
      warnings: stale
        ? ["Источник недоступен. Показан последний успешный ответ."]
        : [],
      error: null,
    };
    return Response.json(value);
  } catch (error) {
    const code=error instanceof NasaError?error.code:"UPSTREAM_UNAVAILABLE";
    return unavailable(id,code,transportMessage(code));
  }
}
export function unavailable(
  id: string,
  code: string,
  message: string,
  status = 503,
): Response {
  const data: ApiEnvelope<never> = {
    data: null,
    status: "unavailable",
    source: sourceRef(id),
    cache: { fetchedAt: null, expiresAt: null, staleAgeHours: null },
    warnings: [],
    error: { code, message },
  };
  return Response.json(data, { status });
}
export async function guarded(
  id: string,
  action: () => Promise<Response>,
): Promise<Response> {
  try {
    return await action();
  } catch (e) {
    if (e instanceof z.ZodError)
      return unavailable(
        id,
        "INVALID_INPUT",
        e.issues.map((x) => x.message).join("; "),
        400,
      );
    if (e instanceof NasaError)
      return unavailable(
        id,
        e.code,
        transportMessage(e.code),
        e.status >= 400 && e.status < 500 ? 400 : 503,
      );
    return unavailable(
      id,
      "INVALID_INPUT",
      "Некорректные параметры запроса.",
      400,
    );
  }
}
export const coords = z.object({
  lat: z
    .string()
    .trim()
    .min(1, "Широта обязательна")
    .pipe(z.coerce.number().min(-85).max(85)),
  lon: z
    .string()
    .trim()
    .min(1, "Долгота обязательна")
    .pipe(z.coerce.number().min(-180).max(180)),
});
export const boxSchema = z
  .string()
  .refine(
    (v) =>
      v.split(",").length === 4 &&
      v.split(",").every((part) => part.trim().length > 0),
    "bbox должен содержать четыре непустые координаты",
  )
  .transform((v) => v.split(",").map(Number))
  .pipe(
    z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-85).max(85),
      z.number().min(-180).max(180),
      z.number().min(-85).max(85),
    ]),
  )
  .refine(
    (b) => b[0] < b[2] && b[1] < b[3] && b[2] - b[0] <= 10 && b[3] - b[1] <= 10,
    "bbox должен быть west,south,east,north и не более 10°",
  );
export function params(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}
export function nasaUrl(
  base: string,
  values: Record<string, string | number>,
): string {
  const url = new URL(base);
  Object.keys(values)
    .sort()
    .forEach((k) => url.searchParams.set(k, String(values[k])));
  return url.toString();
}
