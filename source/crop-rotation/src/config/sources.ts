import type { SourceRef } from "../domain/types";
export interface RegistryEntry {
  id: string;
  name: string;
  datasetId: string;
  resolution: string;
  url: string;
  usage: string;
  license: string;
}
export const SOURCES: RegistryEntry[] = [
  {
    id: "power",
    name: "NASA POWER",
    datasetId:
      "POWER Daily API · T2M_MIN / T2M_MAX / PRECTOTCORR / GWETROOT / WS2M / ALLSKY_SFC_SW_DWN",
    resolution: "Региональная сетка; зависит от параметра, периода и исходной модели POWER",
    url: "https://power.larc.nasa.gov/docs/",
    usage: "Температура, GDD, осадки, влажность корневой зоны, радиация, ветер",
    license: "NASA Earth Science: открытые данные; условия POWER",
  },
  {
    id: "gibs",
    name: "NASA GIBS",
    datasetId:
      "MOD13Q4N 6.1NRT · C2007658439-LANCEMODIS; MODIS_Terra_NDVI_8Day; MODIS_Terra_CorrectedReflectance_TrueColor; VIIRS_SNPP_CorrectedReflectance_TrueColor",
    resolution:
      "NDVI: 250 м, ежедневный rolling-8-day; true color зависит от слоя",
    url: "https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/MODIS_Terra_NDVI_8Day.json",
    usage: "Визуализация NDVI и true color; не классификация культур",
    license: "NASA EOSDIS; атрибуция исходных продуктов",
  },
  {
    id: "worldview",
    name: "NASA Worldview",
    datasetId: "WVS Snapshot API v1; исходный layer ID сохраняется",
    resolution:
      "По bbox и запрошенному размеру; не улучшает исходное разрешение",
    url: "https://worldview.earthdata.nasa.gov/",
    usage: "Снимок выбранной области",
    license: "NASA EOSDIS; условия исходного слоя",
  },
  {
    id: "firms",
    name: "NASA FIRMS",
    datasetId: "VIIRS_SNPP_NRT",
    resolution: "375 м, NRT",
    url: "https://firms.modaps.eosdis.nasa.gov/api/area/",
    usage:
      "Тепловые аномалии в 20 км от полей, не доказательство сжигания стерни",
    license: "Открытые данные NASA FIRMS; рекомендации по цитированию",
  },
  {
    id: "eonet",
    name: "NASA EONET",
    datasetId: "EONET v3 events",
    resolution: "Каталог событий, не регулярная сетка",
    url: "https://eonet.gsfc.nasa.gov/docs/v3",
    usage: "Засухи, пыльные бури и пожары из открытого каталога",
    license: "Открытый каталог; источники отдельных событий указаны в ответе",
  },
  {
    id: "cmr",
    name: "NASA CMR",
    datasetId: "CMR collections.json; concept IDs из результатов",
    resolution: "Метаданные коллекций",
    url: "https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html",
    usage: "Поиск и проверка коллекций",
    license: "Открытые метаданные; права каждого продукта отдельно",
  },
];
export function sourceRef(id: string): SourceRef {
  const s = SOURCES.find((x) => x.id === id);
  return {
    id,
    kind: id === "rules" ? "agronomic-rule" : "nasa",
    datasetId: s?.datasetId ?? "AppName rotation rules v1 — эвристики",
    resolution: s?.resolution ?? "Настройки прототипа, не NASA",
    url: s?.url ?? "/sources#rules",
    observedAt: null,
    periodStart: null,
    periodEnd: null,
    fetchedAt: null,
  };
}
