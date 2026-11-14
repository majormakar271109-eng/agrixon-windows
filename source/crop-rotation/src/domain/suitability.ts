import type {
  Crop,
  EvaluationState,
  Field,
  FitFactor,
  FitResult,
  Season,
} from "./types";
import { sourceRef } from "../config/sources";
import { evaluateField } from "./rules";
import {
  computeGdd,
  datesBetween,
  growingWindow,
  mean,
  subset,
} from "./climate";
const clamp = (x: number) => Math.round(Math.max(0, Math.min(100, x)));
export function climateFit(
  field: Field,
  season: Season,
  crop: Crop,
  state: EvaluationState,
): FitResult {
  if (crop.id === "fallow")
    return { score: null, factors: [], coverage: 0, status: "unavailable" };
  const record = state.climate[`${field.id}:${season.id}`],
    p = state.plantings.find(
      (p) => p.fieldId === field.id && p.seasonId === season.id,
    ),
    [start, end] = growingWindow(season, p),
    daily = subset(record?.daily ?? [], start, end),
    expected = datesBetween(start, end).length;
  const coverage = expected
    ? daily.filter(
        (d) =>
          d.tMin !== null &&
          d.tMax !== null &&
          d.precipMm !== null &&
          d.soilMoisture !== null,
      ).length / expected
    : 0;
  const full =
    coverage >= state.rules.coverageMin &&
    end <= new Date().toISOString().slice(0, 10);
  const source = record?.source ?? sourceRef("power");
  const gdd = computeGdd(daily, crop),
    rain = daily.reduce((a, d) => a + (d.precipMm ?? 0), 0),
    wet = mean(daily.map((d) => d.soilMoisture));
  const trial = {
    ...state,
    plantings: [
      ...state.plantings.filter((x) => x.id !== p?.id),
      {
        ...p,
        id: p?.id ?? "trial",
        fieldId: field.id,
        seasonId: season.id,
        cropId: crop.id,
        areaHa: field.areaHa,
      },
    ],
  };
  const findings = evaluateField(field.id, season.id, trial);
  const rotation = findings.some((f) =>
    ["same_crop_repeat", "short_return"].includes(f.ruleId),
  )
    ? 0
    : findings.some(
          (f) => f.severity === "warning" && f.source.kind === "agronomic-rule",
        )
      ? 50
      : 100;
  const sowEnd = new Date(Date.parse(start) + 20 * 86400000)
      .toISOString()
      .slice(0, 10),
    sow = subset(daily, start, sowEnd),
    sowFull = sow.filter((d) => d.frost !== null).length === 21;
  const factors: FitFactor[] = [
    {
      id: "gdd",
      label: "Тепло · GDD",
      weight: 35,
      score: full ? clamp((gdd / crop.gddTarget) * 100) : null,
      explanation: daily.length
        ? `${gdd.toFixed(0)} / ${crop.gddTarget} °C·дней; ${full ? "полный ряд" : "неполный ряд"}`
        : "Нет температурного ряда; GDD не рассчитан",
      sources: [source],
    },
    {
      id: "frost",
      label: "Заморозки",
      weight: 20,
      score: sowFull
        ? !crop.frostSensitive || !sow.some((d) => d.frost)
          ? 100
          : 20
        : null,
      explanation: "21 день после даты посева; исторические tMin < 0 °C",
      sources: [source],
    },
    {
      id: "precipitation",
      label: "Осадки",
      weight: 20,
      score: full
        ? clamp(
            rain < crop.waterMin
              ? (rain / crop.waterMin) * 100
              : rain > crop.waterMax
                ? 100 - ((rain - crop.waterMax) / crop.waterMax) * 100
                : 100,
          )
        : null,
      explanation: full
        ? `${rain.toFixed(0)} мм; ориентир ${crop.waterMin}–${crop.waterMax} мм`
        : "Недостаточно наблюдений осадков; сумма не оценена",
      sources: [source],
    },
    {
      id: "soilMoisture",
      label: "Корневая влажность",
      weight: 10,
      score:
        full && wet !== null
          ? clamp((wet / state.rules.lowSoilMoisture) * 100)
          : null,
      explanation:
        wet === null
          ? "GWETROOT недоступен"
          : `GWETROOT ${wet.toFixed(2)}, доля насыщения 0–1`,
      sources: [source],
    },
    {
      id: "rotation",
      label: "Возврат культуры",
      weight: 15,
      score: rotation,
      explanation: "Версионированные агрономические настройки, не NASA",
      sources: [sourceRef("rules")],
    },
  ];
  return {
    score: factors.every((f) => f.score !== null)
      ? Math.round(
          factors.reduce((s, f) => s + ((f.score ?? 0) * f.weight) / 100, 0),
        )
      : null,
    factors,
    coverage,
    status: record?.status ?? "unavailable",
  };
}
