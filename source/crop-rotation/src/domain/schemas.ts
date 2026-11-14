import { z } from "zod/v3";
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Некорректная дата",
  );
export const position = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-85).max(85),
]);
export const polygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(position).min(4)).length(1),
});
const field = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  areaHa: z.number().positive(),
  geometry: polygon,
  groupId: z.string().optional(),
  color: z.string(),
});
const planting = z.object({
  id: z.string(),
  fieldId: z.string(),
  seasonId: z.string(),
  cropId: z.string(),
  variety: z.string().max(100).optional(),
  plantedAt: isoDate.optional(),
  harvestedAt: isoDate.optional(),
  yieldT: z.number().nonnegative().optional(),
  areaHa: z.number().positive(),
});
export const farmSchema = z.object({
  fields: z.array(field).max(500),
  plantings: z.array(planting),
  seasons: z.array(
    z.object({
      id: z.string(),
      year: z.number().int(),
      startsAt: isoDate,
      endsAt: isoDate,
    }),
  ),
  budgets: z.record(z.number().nonnegative()),
  rules: z.object({
    enabled: z.array(z.string()),
    droughtDays: z.number().int().min(2).max(90),
    droughtDailyMm: z.number().min(0).max(20),
    lowSoilMoisture: z.number().min(0).max(1),
    coverageMin: z.number().min(0.5).max(1),
  }),
  groups: z.array(z.object({ id: z.string(), name: z.string() })),
  demo: z.boolean(),
});
