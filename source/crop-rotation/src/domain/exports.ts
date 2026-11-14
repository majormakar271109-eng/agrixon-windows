import type { FarmSnapshot } from "./types";
import { cropById } from "../config/crops";
const cell = (v: string | number | undefined) =>
  '"' +
  String(v ?? "")
    .replace(/^[=+@-]/, "'$&")
    .replaceAll('"', '""') +
  '"';
export function exportCsv(state: FarmSnapshot): string {
  return (
    "\uFEFF" +
    [
      [
        "Поле",
        "Сезон",
        "Культура",
        "Сорт",
        "Площадь, га",
        "Посев",
        "Уборка",
        "Урожай, т",
        "Происхождение",
      ]
        .map(cell)
        .join(";"),
      ...state.plantings.map((p) =>
        [
          state.fields.find((f) => f.id === p.fieldId)?.name,
          p.seasonId,
          cropById(p.cropId)?.name,
          p.variety,
          p.areaHa.toFixed(2),
          p.plantedAt,
          p.harvestedAt,
          p.yieldT,
          state.demo ? "демо, не спутниковая классификация" : "пользователь",
        ]
          .map((v) => cell(v))
          .join(";"),
      ),
    ].join("\r\n")
  );
}
export function exportGeojson(state: FarmSnapshot): string {
  return JSON.stringify(
    {
      type: "FeatureCollection",
      features: state.fields.map((f) => ({
        type: "Feature",
        id: f.id,
        geometry: f.geometry,
        properties: {
          id: f.id,
          name: f.name,
          areaHa: f.areaHa,
          groupId: f.groupId ?? null,
          origin: state.demo ? "synthetic demo" : "user",
          plantings: state.plantings.filter((p) => p.fieldId === f.id),
        },
      })),
    },
    null,
    2,
  );
}
