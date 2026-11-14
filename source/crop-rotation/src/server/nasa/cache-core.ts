import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
  readdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
export const TTL = 6 * 60 * 60 * 1000;
export interface CacheEntry {
  body: string;
  contentType: string;
  fetchedAt: string;
}
const memory = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<CacheEntry>>();
const directory = () =>
  process.env.NASA_CACHE_DIR ?? path.join(process.cwd(), ".cache/nasa");
export const cacheKey = (url: string) =>
  createHash("sha256")
    .update("v1:" + url.replace(/\/csv\/[^/]+\//, "/csv/KEY/"))
    .digest("hex");
export async function readCached(key: string): Promise<CacheEntry | null> {
  const m = memory.get(key);
  if (m) return m;
  try {
    const raw: unknown = JSON.parse(
      await readFile(path.join(directory(), key + ".json"), "utf8"),
    );
    if (
      typeof raw === "object" &&
      raw !== null &&
      "body" in raw &&
      typeof raw.body === "string" &&
      "contentType" in raw &&
      typeof raw.contentType === "string" &&
      "fetchedAt" in raw &&
      typeof raw.fetchedAt === "string"
    )
      return {
        body: raw.body,
        contentType: raw.contentType,
        fetchedAt: raw.fetchedAt,
      };
  } catch {
    return null;
  }
  return null;
}
export async function saveCached(
  key: string,
  value: CacheEntry,
): Promise<void> {
  memory.set(key, value);
  if (memory.size > 200) memory.delete(memory.keys().next().value ?? "");
  try {
    await mkdir(directory(), { recursive: true });
    const file = path.join(directory(), key + ".json"),
      temp = file + "." + crypto.randomUUID() + ".tmp";
    await writeFile(temp, JSON.stringify(value));
    await rename(temp, file);
    const files = (await readdir(directory())).filter((f) =>
      f.endsWith(".json"),
    );
    if (files.length > 500) {
      const remove = files
        .slice(0, files.length - 500)
        .filter((f) => f !== key + ".json");
      await Promise.all(
        remove.map((f) =>
          unlink(path.join(directory(), f)).catch(() => undefined),
        ),
      );
    }
  } catch {
    /* Read-only hosts retain only process-local cache. */
  }
}
export async function coalesce(
  key: string,
  load: () => Promise<CacheEntry>,
): Promise<CacheEntry> {
  const old = pending.get(key);
  if (old) return old;
  const next = load().finally(() => pending.delete(key));
  pending.set(key, next);
  return next;
}
export const staleHours = (fetchedAt: string, now = Date.now()) =>
  Math.max(0, (now - Date.parse(fetchedAt) - TTL) / 3600000);
