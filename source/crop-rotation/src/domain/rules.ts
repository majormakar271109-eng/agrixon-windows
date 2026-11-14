import type { EvaluationState, Finding } from "./types";
import { cropById } from "../config/crops";
import { sourceRef } from "../config/sources";
import {
  computeGdd,
  datesBetween,
  dryWindows,
  growingWindow,
  mean,
  subset,
} from "./climate";
export function evaluateField(
  fieldId: string,
  seasonId: string,
  state: EvaluationState,
): Finding[] {
  const current = state.plantings.find(
      (p) => p.fieldId === fieldId && p.seasonId === seasonId,
    ),
    season = state.seasons.find((s) => s.id === seasonId);
  if (!current || !season) return [];
  const crop = cropById(current.cropId);
  if (!crop) return [];
  const out: Finding[] = [];
  const add = (
    ruleId: string,
    severity: Finding["severity"],
    message: string,
    suggestion?: string,
    climate = false,
  ) => {
    if (state.rules.enabled.includes(ruleId))
      out.push({
        ruleId,
        severity,
        message,
        suggestion,
        plantingIds: [current.id],
        source: climate
          ? (state.climate[`${fieldId}:${seasonId}`]?.source ??
            sourceRef("power"))
          : sourceRef("rules"),
      });
  };
  const history = state.plantings
    .filter((p) => p.fieldId === fieldId)
    .map((p) => ({
      p,
      year: state.seasons.find((s) => s.id === p.seasonId)?.year ?? Infinity,
    }))
    .filter((x) => x.year < season.year)
    .sort((a, b) => b.year - a.year);
  const prev = history.find((x) => x.year === season.year - 1),
    prevCrop = prev ? cropById(prev.p.cropId) : undefined;
  const perennial = crop.id === "alfalfa" && prevCrop?.id === "alfalfa";
  if (crop.id !== "fallow" && !perennial) {
    if (prevCrop?.id === crop.id)
      add(
        "same_crop_repeat",
        "error",
        `${crop.name} повторяется два сезона подряд. Растёт риск специализированных болезней и истощения почвы.`,
        "Предложить: горох или пар.",
      );
    const last = history.find((x) => x.p.cropId === crop.id);
    if (last && season.year - last.year < crop.returnYears)
      add(
        "short_return",
        "error",
        `${crop.name} возвращается через ${season.year - last.year} г. (настройка: ${crop.returnYears}). Риск накопления общих патогенов.`,
        "Предложить: культуру другого семейства.",
      );
    if (prevCrop && prevCrop.id !== crop.id && prevCrop.family === crop.family)
      add(
        "same_family_repeat",
        "warning",
        "Одинаковое семейство в соседних сезонах: общие вредители и болезни.",
        "Предложить: горох или подсолнечник с допустимым возвратом.",
      );
    if (prevCrop?.family === "cereal" && crop.family === "cereal")
      add(
        "cereal_after_cereal",
        "warning",
        "Зерновая после зерновой: возможны корневые гнили и рост засорённости.",
        "Включить бобовую культуру или пар.",
      );
  }
  if (prevCrop?.isLegume && crop.family === "cereal")
    add(
      "good_predecessor",
      "good",
      "Бобовый предшественник разрывает зерновой цикл и поддерживает азотный режим.",
    );
  const known = Array.from({ length: 5 }, (_, i) =>
    history.find((x) => x.year === season.year - i - 1),
  );
  if (
    known.every(Boolean) &&
    !known.some((x) => x && cropById(x.p.cropId)?.isLegume) &&
    !crop.isLegume
  )
    add(
      "no_legume_break",
      "info",
      "За пять известных предыдущих лет не было бобовых. Возможна потеря разнообразия и азотного эффекта.",
      "Запланировать горох или люцерну.",
    );
  const record = state.climate[`${fieldId}:${seasonId}`];
  if (!record || crop.id === "fallow") return out;
  const [start, end] = growingWindow(season, current),
    days = subset(record.daily, start, end),
    expected = datesBetween(start, end).length;
  const coverage = expected
    ? days.filter((d) => d.tMin !== null && d.tMax !== null).length / expected
    : 0;
  const complete =
    record.source.periodEnd !== null &&
    record.source.periodEnd >= end &&
    end <= new Date().toISOString().slice(0, 10);
  if (
    complete &&
    coverage >= state.rules.coverageMin &&
    computeGdd(days, crop) < crop.gddTarget
  )
    add(
      "gdd_shortfall",
      "error",
      `Накопленный GDD ниже цели ${crop.gddTarget} °C·дней. Возможна нехватка тепла для созревания.`,
      "Рассмотреть раннеспелый сорт, ячмень или горох.",
      true,
    );
  const sowEnd = new Date(Date.parse(start) + 20 * 86400000)
    .toISOString()
    .slice(0, 10);
  if (
    crop.frostSensitive &&
    subset(record.daily, start, sowEnd).some((d) => d.frost === true)
  )
    add(
      "frost_risk_window",
      "warning",
      "В 21-дневном окне посева есть дни tMin < 0 °C. Возможны повреждения всходов.",
      "Пересмотреть дату посева; это историческая модель, не прогноз.",
      true,
    );
  const windows = dryWindows(
    days,
    state.rules.droughtDays,
    state.rules.droughtDailyMm,
  );
  if (windows.length)
    add(
      "drought_window",
      "warning",
      `Период осадков < ${state.rules.droughtDailyMm} мм/сут: ${windows[0].start} — ${windows[0].end}. Возможен водный стресс.`,
      "Рассмотреть менее влаголюбивую культуру.",
      true,
    );
  const wet = mean(days.map((d) => d.soilMoisture));
  if (wet !== null && wet < state.rules.lowSoilMoisture - 1e-12)
    add(
      "soil_moisture_low",
      "info",
      `Средний GWETROOT ${wet.toFixed(2)} ниже порога ${state.rules.lowSoilMoisture}. Возможен дефицит доступной влаги.`,
      "Проверить условия на месте; модель региональная.",
      true,
    );
  return out;
}
