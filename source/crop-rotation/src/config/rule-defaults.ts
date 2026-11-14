import type { RuleSettings } from "../domain/types";
export const RULE_IDS = [
  "same_crop_repeat",
  "short_return",
  "gdd_shortfall",
  "same_family_repeat",
  "cereal_after_cereal",
  "frost_risk_window",
  "drought_window",
  "no_legume_break",
  "soil_moisture_low",
  "good_predecessor",
];
export const DEFAULT_RULES: RuleSettings = {
  enabled: RULE_IDS,
  droughtDays: 14,
  droughtDailyMm: 1,
  lowSoilMoisture: 0.3,
  coverageMin: 0.9,
};

export const RULE_LABELS: Record<string, string> = {
  same_crop_repeat: "Повтор культуры",
  short_return: "Слишком ранний возврат",
  gdd_shortfall: "Нехватка тепла",
  same_family_repeat: "Повтор семейства",
  cereal_after_cereal: "Зерновая после зерновой",
  frost_risk_window: "Заморозки в окне посева",
  drought_window: "Засушливое окно",
  no_legume_break: "Пять лет без бобовых",
  soil_moisture_low: "Низкая влажность почвы",
  good_predecessor: "Подходящий предшественник",
};
