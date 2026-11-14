import type { AllocationPreview, EvaluationState } from "./types";
import { CROPS } from "../config/crops";
import { evaluateField } from "./rules";
import { climateFit } from "./suitability";
export function allocate(
  state: EvaluationState,
  seasonId: string,
  locked: string[] = [],
): AllocationPreview {
  const season = state.seasons.find((s) => s.id === seasonId);
  if (!season) throw new Error("Сезон не найден");
  const crops = CROPS.filter((c) => (state.budgets[c.id] ?? 0) > 0),
    actual: Record<string, number> = {},
    changes: AllocationPreview["changes"] = [];
  let errorCount = 0;
  const notes = [
    "Эвристический поиск, не гарантия глобального оптимума. Назначаются только целые поля.",
  ];
  if (!crops.length)
    return {
      changes,
      actual,
      deviations: {},
      withinTolerance: false,
      errorCount: 0,
      notes: ["Сначала задайте бюджет площадей."],
    };
  for (const field of state.fields.filter((f) => locked.includes(f.id))) {
    const p = state.plantings.find(
      (p) => p.fieldId === field.id && p.seasonId === seasonId,
    );
    if (p) actual[p.cropId] = (actual[p.cropId] ?? 0) + field.areaHa;
  }
  for (const field of [...state.fields].sort(
    (a, b) => b.areaHa - a.areaHa || a.id.localeCompare(b.id),
  )) {
    if (locked.includes(field.id)) continue;
    const old = state.plantings.find(
      (p) => p.fieldId === field.id && p.seasonId === seasonId,
    );
    const candidates = crops
      .map((crop) => {
        const planting = {
          id: old?.id ?? `${field.id}-${seasonId}`,
          fieldId: field.id,
          seasonId,
          cropId: crop.id,
          areaHa: field.areaHa,
        };
        const trial = {
          ...state,
          plantings: [
            ...state.plantings.filter((p) => p.id !== old?.id),
            planting,
          ],
        };
        const errors = evaluateField(field.id, seasonId, trial).filter(
            (f) => f.severity === "error",
          ).length,
          fit = climateFit(field, season, crop, trial).score ?? 50;
        const target = state.budgets[crop.id],
          before = actual[crop.id] ?? 0;
        const improvement =
          (Math.abs(before + field.areaHa - target) -
            Math.abs(before - target)) /
          target;
        return {
          crop,
          errors,
          cost: errors * 100000 + improvement * 100 - fit / 100,
        };
      })
      .sort((a, b) => a.cost - b.cost || a.crop.id.localeCompare(b.crop.id));
    const best = candidates[0];
    actual[best.crop.id] = (actual[best.crop.id] ?? 0) + field.areaHa;
    errorCount += best.errors;
    changes.push({
      fieldId: field.id,
      before: old?.cropId ?? null,
      after: best.crop.id,
      errorCount: best.errors,
    });
  }
  // Preserve an already feasible plan when greedy search makes it worse.
  const existingActual: Record<string, number> = {};
  for (const f of state.fields) {
    const p = state.plantings.find(
      (p) => p.fieldId === f.id && p.seasonId === seasonId,
    );
    if (p)
      existingActual[p.cropId] = (existingActual[p.cropId] ?? 0) + f.areaHa;
  }
  const deviation = (totals: Record<string, number>) =>
    Object.fromEntries(
      CROPS.map((c) => {
        const t = state.budgets[c.id] ?? 0,
          a = totals[c.id] ?? 0;
        return [c.id, t === 0 ? (a === 0 ? 0 : 100) : ((a - t) / t) * 100];
      }),
    );
  let deviations = deviation(actual);
  const existingDeviation = deviation(existingActual);
  const existingErrors = state.fields.reduce(
    (s, f) =>
      s +
      evaluateField(f.id, seasonId, state).filter((x) => x.severity === "error")
        .length,
    0,
  );
  if (
    Object.values(existingDeviation).every((v) => Math.abs(v) <= 5) &&
    (existingErrors < errorCount ||
      (existingErrors === errorCount &&
        !Object.values(deviations).every((v) => Math.abs(v) <= 5)))
  ) {
    for (const k of Object.keys(actual)) delete actual[k];
    Object.assign(actual, existingActual);
    changes.splice(0, changes.length);
    deviations = existingDeviation;
    errorCount = existingErrors;
    notes.push("Текущий план лучше найденного: назначения сохранены.");
  }
  const withinTolerance = Object.values(deviations).every(
    (v) => Math.abs(v) <= 5,
  );
  if (!withinTolerance)
    notes.push(
      "Допуск ±5% не достигнут. Измените бюджет или назначения; недостижимость не доказана.",
    );
  return { changes, actual, deviations, withinTolerance, errorCount, notes };
}
