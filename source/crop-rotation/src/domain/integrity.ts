import type { FarmSnapshot } from "./types";
import { CROPS } from "../config/crops";

/**
 * Referential-integrity check for a farm snapshot that already passed farmSchema.
 * Zod validates shapes; this validates links between records (fields ↔ seasons ↔ plantings ↔ crops ↔ groups).
 * Returns a list of human-readable problems (Russian, max 10). Empty list = snapshot is consistent.
 */
export function integrityProblems(farm: FarmSnapshot): string[] {
  const problems: string[] = [];
  const add = (message: string) => {
    if (problems.length < 10) problems.push(message);
  };
  const cropIds = new Set(CROPS.map((c) => c.id));
  const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

  if (farm.seasons.length === 0) add("В архиве нет ни одного сезона");
  for (const id of new Set(dupes(farm.seasons.map((s) => s.id)))) add(`Сезон «${id}» повторяется`);
  for (const id of new Set(dupes(farm.fields.map((f) => f.id)))) add(`Поле «${id}» повторяется`);
  for (const id of new Set(dupes(farm.plantings.map((p) => p.id)))) add(`Посев «${id}» повторяется`);
  for (const id of new Set(dupes(farm.groups.map((g) => g.id)))) add(`Группа «${id}» повторяется`);

  for (const s of farm.seasons)
    if (s.startsAt > s.endsAt) add(`Сезон ${s.id}: начало позже окончания`);

  const groupIds = new Set(farm.groups.map((g) => g.id));
  for (const f of farm.fields)
    if (f.groupId && !groupIds.has(f.groupId)) add(`Поле «${f.name}» ссылается на несуществующую группу`);

  const fields = new Map(farm.fields.map((f) => [f.id, f]));
  const seasonIds = new Set(farm.seasons.map((s) => s.id));
  const slots = new Set<string>();
  for (const p of farm.plantings) {
    const field = fields.get(p.fieldId);
    if (!field) add(`Посев ${p.id} ссылается на несуществующее поле`);
    if (!seasonIds.has(p.seasonId)) add(`Посев ${p.id} ссылается на несуществующий сезон ${p.seasonId}`);
    if (!cropIds.has(p.cropId)) add(`Посев ${p.id}: неизвестная культура «${p.cropId}»`);
    if (field && p.areaHa > field.areaHa * 1.001 + 1e-9)
      add(`Посев ${p.id}: площадь больше площади поля «${field.name}»`);
    if (p.plantedAt && p.harvestedAt && p.plantedAt > p.harvestedAt)
      add(`Посев ${p.id}: уборка раньше посева`);
    const slot = `${p.fieldId}|${p.seasonId}`;
    if (slots.has(slot)) add(`Поле ${p.fieldId} имеет два посева в сезоне ${p.seasonId}`);
    slots.add(slot);
  }

  for (const cropId of Object.keys(farm.budgets))
    if (!cropIds.has(cropId)) add(`Бюджет для неизвестной культуры «${cropId}»`);

  return problems;
}
