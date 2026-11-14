import "server-only";
import {
  cacheKey,
  coalesce,
  readCached,
  saveCached,
  staleHours,
  TTL,
  type CacheEntry,
} from "./cache-core";
export class NasaError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
export function transportCode(error:unknown):string {
 let current:unknown=error;
 for(let i=0;i<5&&current&&typeof current==='object';i++){
  const value=current as {code?:unknown;name?:unknown;cause?:unknown};
  if(value.code==='ENOTFOUND'||value.code==='EAI_AGAIN')return 'DNS_FAILURE';
  if(value.name==='TimeoutError'||value.code==='ETIMEDOUT'||value.code==='UND_ERR_CONNECT_TIMEOUT')return 'NETWORK_TIMEOUT';
  if(value.code==='ECONNREFUSED'||value.code==='ENETUNREACH')return 'NETWORK_UNREACHABLE';
  if(value.code==='SELF_SIGNED_CERT_IN_CHAIN'||value.code==='CERT_HAS_EXPIRED'||value.code==='UNABLE_TO_VERIFY_LEAF_SIGNATURE')return 'TLS_CERTIFICATE_ERROR';
  current=value.cause;
 }
 return error instanceof NasaError?error.code:'UPSTREAM_UNAVAILABLE';
}
export function transportMessage(code:string):string {
 const messages:Record<string,string>={DNS_FAILURE:'Сервер не может разрешить адрес источника (DNS). Проверьте интернет и DNS на компьютере с приложением. Это не означает, что NASA не работает.',NETWORK_TIMEOUT:'Истекло время ожидания ответа источника. Проверьте сеть и повторите запрос.',NETWORK_UNREACHABLE:'Сеть источника недоступна с компьютера, на котором запущен сервер.',TLS_CERTIFICATE_ERROR:'Не удалось проверить сертификат HTTPS источника. Проверьте дату компьютера и доверенные сертификаты; не отключайте проверку TLS.',UPSTREAM_REJECTED:'Источник отклонил серверный запрос.',UPSTREAM_UNAVAILABLE:'Не удалось получить источник; успешного ответа в кэше нет.'};
 return messages[code]??messages.UPSTREAM_UNAVAILABLE;
}
let active = 0;
const queue: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 6) await new Promise<void>((r) => queue.push(r));
  else active++;
  try {
    return await fn();
  } finally {
    const next = queue.shift();
    if (next) next();
    else active--;
  }
}
const hosts = new Set([
  "power.larc.nasa.gov",
  "gibs.earthdata.nasa.gov",
  "wvs.earthdata.nasa.gov",
  "firms.modaps.eosdis.nasa.gov",
  "eonet.gsfc.nasa.gov",
  "cmr.earthdata.nasa.gov",
  "tiles.openfreemap.org",
]);
export async function upstream(
  url: string,
  binary = false,
  validate?: (body: string) => void,
  mapAsset = false,
): Promise<{ entry: CacheEntry; stale: boolean }> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !hosts.has(parsed.hostname))
    throw new NasaError("HOST_NOT_ALLOWED", 400);
  const key = cacheKey(url),
    cached = await readCached(key);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < TTL)
    return { entry: cached, stale: false };
  try {
    const entry = await coalesce(key, () =>
      limited(async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          let pause = 250 * 2 ** attempt;
          try {
            const response = await fetch(url, {
              signal: AbortSignal.timeout(8000),
              redirect: "error",
              cache: "no-store",
            });
            if (!response.ok) {
              if (
                ![408, 429].includes(response.status) &&
                response.status < 500
              )
                throw new NasaError("UPSTREAM_REJECTED", response.status);
              const retry = Number(response.headers.get("retry-after"));
              if (Number.isFinite(retry))
                pause = Math.min(4000, Math.max(pause, retry * 1000));
              throw new NasaError("UPSTREAM_TEMPORARY", response.status);
            }
            const type = response.headers.get("content-type") ?? "";
            const body = binary
              ? Buffer.from(await response.arrayBuffer()).toString("base64")
              : await response.text();
            if (binary && !mapAsset && !type.startsWith("image/"))
              throw new NasaError("NOT_AN_IMAGE", 502);
            if (mapAsset && !/^(image\/|application\/(json|x-protobuf|vnd\.mapbox-vector-tile|octet-stream))/.test(type)) throw new NasaError("INVALID_MAP_CONTENT",502);
            if (validate) validate(body);
            const value = {
              body,
              contentType: type,
              fetchedAt: new Date().toISOString(),
            };
            await saveCached(key, value);
            return value;
          } catch (error) {
            if (
              error instanceof NasaError &&
              error.code === "UPSTREAM_REJECTED"
            )
              throw error;
            if (attempt === 2) throw new NasaError(transportCode(error), 503);
            await new Promise((r) =>
              setTimeout(r, pause + Math.random() * 100),
            );
          }
        }
        throw new NasaError("UPSTREAM_UNAVAILABLE", 503);
      }),
    );
    return { entry, stale: false };
  } catch (error) {
    if (cached) return { entry: cached, stale: true };
    throw error instanceof NasaError ? error : new NasaError(transportCode(error),503);
  }
}
export { TTL, staleHours };
