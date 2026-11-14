export type Position = [number, number];
export interface Polygon {
  type: "Polygon";
  coordinates: Position[][];
}
export interface Crop {
  id: string;
  name: string;
  family: string;
  color: string;
  returnYears: number;
  isLegume: boolean;
  isCover: boolean;
  gddBase: number;
  gddTarget: number;
  frostSensitive: boolean;
  waterMin: number;
  waterMax: number;
}
export interface Field {
  id: string;
  name: string;
  areaHa: number;
  geometry: Polygon;
  groupId?: string;
  color: string;
}
export interface Season {
  id: string;
  year: number;
  startsAt: string;
  endsAt: string;
}
export interface Planting {
  id: string;
  fieldId: string;
  seasonId: string;
  cropId: string;
  variety?: string;
  plantedAt?: string;
  harvestedAt?: string;
  yieldT?: number;
  areaHa: number;
}
export interface ClimateDaily {
  date: string;
  tMin: number | null;
  tMax: number | null;
  precipMm: number | null;
  soilMoisture: number | null;
  radiation: number | null;
  windMs: number | null;
  frost: boolean | null;
}
export type Severity = "error" | "warning" | "info" | "good";
export type DataStatus = "fresh" | "stale" | "unavailable" | "partial";
export interface SourceRef {
  id: string;
  kind: "nasa" | "agronomic-rule" | "demo" | "user";
  nativeSources?: string[];
  parameterUnits?: Record<string,string>;
  timeStandard?: string;
  datasetId: string;
  observedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  fetchedAt: string | null;
  resolution: string;
  url: string;
}
export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  plantingIds: string[];
  suggestion?: string;
  source: SourceRef;
  relatedSources?: SourceRef[];
}
export interface ApiEnvelope<T> {
  data: T | null;
  status: DataStatus;
  source: SourceRef;
  cache: {
    fetchedAt: string | null;
    expiresAt: string | null;
    staleAgeHours: number | null;
  };
  warnings: string[];
  error: { code: string; message: string } | null;
}
export interface ClimateRecord {
  daily: ClimateDaily[];
  source: SourceRef;
  status: DataStatus;
}
export interface RuleSettings {
  enabled: string[];
  droughtDays: number;
  droughtDailyMm: number;
  lowSoilMoisture: number;
  coverageMin: number;
}
export interface FarmSnapshot {
  fields: Field[];
  seasons: Season[];
  plantings: Planting[];
  budgets: Record<string, number>;
  rules: RuleSettings;
  groups: { id: string; name: string }[];
  demo: boolean;
}
export interface EvaluationState extends FarmSnapshot {
  climate: Record<string, ClimateRecord>;
}
export interface FitFactor {
  id: string;
  label: string;
  score: number | null;
  weight: number;
  explanation: string;
  sources: SourceRef[];
}
export interface FitResult {
  score: number | null;
  factors: FitFactor[];
  coverage: number;
  status: DataStatus;
}
export interface FireDetection {
  lat: number;
  lon: number;
  date: string;
  time: string;
  confidence: string;
  frp: number | null;
}
export interface NaturalEvent {
  id: string;
  title: string;
  categories: string[];
  date: string | null;
  coordinates: Position | null;
  url: string;
}
export interface GIBSLayer {
  id: string;
  title: string;
  matrixSet: string;
  dates: string[];
}
export interface CollectionSummary {
  id: string;
  shortName: string;
  title: string;
  version: string;
  url: string;
}
export interface AllocationChange {
  fieldId: string;
  before: string | null;
  after: string;
  errorCount: number;
}
export interface AllocationPreview {
  changes: AllocationChange[];
  actual: Record<string, number>;
  deviations: Record<string, number>;
  withinTolerance: boolean;
  errorCount: number;
  notes: string[];
}
