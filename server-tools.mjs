/*
 * AGRIXON Field Tools server.
 *
 * Wraps the existing standalone server (server.mjs) and adds:
 *   - /tools              Field Tools page
 *   - /api/metos/*        METOS / FieldClimate HMAC proxy
 *   - /api/weather/*      Open-Meteo forecast proxy
 *
 * The original server is imported with APPNAME_NO_LISTEN=1 so it does not
 * bind a second port. All unknown routes are passed to its handle().
 */
import './prelude.mjs';
import { handle } from './server.mjs';

import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

const assetRoot = process.env.AGRIXON_ASSET_ROOT
  ? path.resolve(process.env.AGRIXON_ASSET_ROOT)
  : path.dirname(fileURLToPath(import.meta.url));
const dataRoot = process.env.AGRIXON_DATA_DIR ? path.resolve(process.env.AGRIXON_DATA_DIR) : assetRoot;
const publicDir = path.join(assetRoot, 'public');

if (process.argv.includes('--check')) {
  console.log('AGRIXON exe check');
  console.log('pkg       ', Boolean(process.pkg));
  console.log('execPath  ', process.execPath);
  console.log('assetRoot ', assetRoot);
  console.log('dataRoot  ', dataRoot);
  console.log('public    ', existsSync(path.join(publicDir, 'index.html')) ? 'OK' : 'MISSING');
  console.log('env       ', existsSync(path.join(dataRoot, '.env.local')) || existsSync(path.join(assetRoot, '.env.local')) ? 'OK' : 'MISSING');
  console.log('node      ', process.version);
  process.exit(0);
}

const metosFile = path.join(dataRoot, '.metos.json');
const sensorsFile = path.join(dataRoot, '.sensors.json');
const telegramFile = path.join(dataRoot, '.telegram.json');
const snapshotFile = path.join(dataRoot, '.workspace-snapshot.json');
const sensorConfigFile = path.join(assetRoot, 'sensors.config.json');
const sensorConfigOverride = path.join(dataRoot, 'sensors.config.json');

const SENSOR_LIMIT = 5000;
const ALERT_LIMIT = 200;
const DRY_THRESHOLD = Number(process.env.SENSOR_DRY_THRESHOLD ?? 25);
const ALERT_COOLDOWN_MS = Number(process.env.SENSOR_ALERT_COOLDOWN_HOURS ?? 6) * 3600 * 1000;
const DEFAULT_POINT = { lat: 47.979811, lon: 67.243753 };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function serveFile(res, name, type) {
  try {
    const body = await readFile(path.join(publicDir, name));
    res.writeHead(200, {
      'Content-Type': type ?? MIME[path.extname(name)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': body.length
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

/* ---------------- METOS / FieldClimate ---------------- */

async function loadMetosCreds() {
  if (process.env.METOS_PUBLIC_KEY && process.env.METOS_PRIVATE_KEY) {
    return { publicKey: process.env.METOS_PUBLIC_KEY, privateKey: process.env.METOS_PRIVATE_KEY };
  }
  try {
    const raw = await readFile(metosFile, 'utf8');
    const data = JSON.parse(raw);
    if (data && typeof data.publicKey === 'string' && typeof data.privateKey === 'string') {
      return { publicKey: data.publicKey, privateKey: data.privateKey };
    }
  } catch {
    /* not configured */
  }
  return null;
}

function metosSign(method, requestPath, publicKey, privateKey) {
  const timestamp = new Date().toUTCString();
  const content = method + requestPath + timestamp + publicKey;
  const signature = createHmac('sha256', privateKey).update(content).digest('hex');
  return { timestamp, authorization: `hmac ${publicKey}:${signature}` };
}

async function fieldClimate(requestPath, method = 'GET', body = null, credsOverride = null) {
  const creds = credsOverride ?? (await loadMetosCreds());
  if (!creds) {
    const error = new Error('METOS_NOT_CONFIGURED');
    error.status = 424;
    throw error;
  }
  const { timestamp, authorization } = metosSign(method, requestPath, creds.publicKey, creds.privateKey);
  const response = await fetch('https://api.fieldclimate.com/v2' + requestPath, {
    method,
    headers: {
      Authorization: authorization,
      'Request-Date': timestamp,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!response.ok) {
    const detail =
      typeof data === 'string'
        ? data.slice(0, 300)
        : data?.message ?? data?.error ?? JSON.stringify(data).slice(0, 300);
    const error = new Error(`FieldClimate HTTP ${response.status}: ${detail}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function handleMetos(req, res, url) {
  const route = url.pathname.replace('/api/metos/', '');

  if (route === 'status' && req.method === 'GET') {
    const creds = await loadMetosCreds();
    return sendJson(res, 200, {
      configured: Boolean(creds),
      publicKey: creds ? creds.publicKey.slice(0, 6) + '…' : null,
      source: 'FieldClimate API v2'
    });
  }

  if (route === 'connect' && req.method === 'POST') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'INVALID_JSON', message: 'Expected a JSON body.' });
    }
    const publicKey = String(payload?.publicKey ?? '').trim();
    const privateKey = String(payload?.privateKey ?? '').trim();
    if (!publicKey || !privateKey) {
      return sendJson(res, 400, { error: 'MISSING_KEYS', message: 'Public Key and Private Key are required.' });
    }
    try {
      const stations = await fieldClimate('/user/stations', 'GET', null, { publicKey, privateKey });
      await writeFile(metosFile, JSON.stringify({ publicKey, privateKey }, null, 2), { mode: 0o600 });
      return sendJson(res, 200, { ok: true, stations });
    } catch (error) {
      return sendJson(res, error.status && error.status >= 400 ? error.status : 502, {
        error: 'METOS_CONNECT_FAILED',
        message: error instanceof Error ? error.message : 'FieldClimate did not accept the keys.'
      });
    }
  }

  if (route === 'disconnect' && req.method === 'POST') {
    try {
      await unlink(metosFile);
    } catch {
      /* already absent */
    }
    return sendJson(res, 200, { ok: true });
  }

  if (route === 'stations' && req.method === 'GET') {
    try {
      return sendJson(res, 200, { data: await fieldClimate('/user/stations') });
    } catch (error) {
      return sendJson(res, error.status ?? 502, {
        error: 'METOS_STATIONS_FAILED',
        message: error instanceof Error ? error.message : 'Could not load stations.'
      });
    }
  }

  if (route === 'current' && req.method === 'GET') {
    const stationId = String(url.searchParams.get('stationId') ?? '').trim();
    if (!stationId) return sendJson(res, 400, { error: 'MISSING_STATION', message: 'stationId is required.' });
    try {
      const data = await fieldClimate(`/data/${encodeURIComponent(stationId)}/hourly/last/24h`);
      return sendJson(res, 200, { data });
    } catch (error) {
      return sendJson(res, error.status ?? 502, {
        error: 'METOS_CURRENT_FAILED',
        message: error instanceof Error ? error.message : 'Could not load current station data.'
      });
    }
  }

  if (route === 'forecast' && req.method === 'GET') {
    const stationId = String(url.searchParams.get('stationId') ?? '').trim();
    if (!stationId) return sendJson(res, 400, { error: 'MISSING_STATION', message: 'stationId is required.' });
    try {
      const data = await fieldClimate(`/forecast/${encodeURIComponent(stationId)}/daily`, 'POST', { name: 'general7' });
      return sendJson(res, 200, { data });
    } catch (error) {
      return sendJson(res, error.status ?? 502, {
        error: 'METOS_FORECAST_FAILED',
        message: error instanceof Error ? error.message : 'Could not load the station forecast.'
      });
    }
  }

  return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Unknown METOS route.' });
}

/* ---------------- Open-Meteo forecast ---------------- */

async function handleWeather(req, res, url) {
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return sendJson(res, 400, { error: 'INVALID_COORDINATES', message: 'lat and lon are required.' });
  }
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,cloud_cover,dew_point_2m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_mean,cloud_cover_mean,dew_point_2m_mean',
    timezone: 'auto',
    forecast_days: '7'
  });
  try {
    const response = await fetch('https://api.open-meteo.com/v1/forecast?' + params, {
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    if (!response.ok) {
      return sendJson(res, 502, {
        error: 'OPEN_METEO_FAILED',
        message: data?.reason ?? `Open-Meteo HTTP ${response.status}`
      });
    }
    return sendJson(res, 200, { data, source: 'Open-Meteo' });
  } catch (error) {
    return sendJson(res, 502, {
      error: 'OPEN_METEO_FAILED',
      message: error instanceof Error ? error.message : 'Weather forecast is unavailable.'
    });
  }
}

/* ---------------- local JSON stores ---------------- */

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await writeFile(file, JSON.stringify(data, null, 2), { mode: 0o600 });
}

async function loadSensorStore() {
  const data = await readJson(sensorsFile, { readings: [], alerts: [] });
  return {
    readings: Array.isArray(data.readings) ? data.readings : [],
    alerts: Array.isArray(data.alerts) ? data.alerts : []
  };
}

async function saveSensorStore(store) {
  store.readings = store.readings.slice(-SENSOR_LIMIT);
  store.alerts = store.alerts.slice(-ALERT_LIMIT);
  await writeJson(sensorsFile, store);
}

async function loadSensorConfig() {
  const data = await readJson(sensorConfigOverride, null);
  const source = data ?? (await readJson(sensorConfigFile, { capsules: [] }));
  const capsules = Array.isArray(source?.capsules) ? source.capsules : [];
  return capsules
    .map((capsule) => ({
      id: String(capsule?.id ?? '').trim(),
      name: String(capsule?.name ?? '').trim(),
      field: String(capsule?.field ?? '').trim(),
      note: String(capsule?.note ?? '').trim()
    }))
    .filter((capsule) => capsule.id);
}

function legacySample(reading) {
  if (!reading) return null;
  return {
    ts: Math.floor(Date.parse(reading.receivedAt) / 1000),
    iso: reading.receivedAt,
    dht_temp: null,
    humidity: null,
    ntc_temp: reading.temperature,
    soil_pct: reading.moisture,
    soil_adc: null,
    ntc_adc: null,
    dht_ok: false,
    dht_error: null,
    ntc_state: reading.temperature === null ? 'no_data' : 'ok',
    limits: { temp_min: 15, temp_max: 30, hum_min: 30, hum_max: 70, soil_min: 20 },
    capsule_id: reading.capsuleId,
    nitrogen: reading.nitrogen,
    battery: reading.battery
  };
}

function mergeCapsules(store, configured) {
  const latest = new Map();
  for (const reading of store.readings) latest.set(reading.capsuleId, reading);
  const merged = [];
  const seen = new Set();
  for (const capsule of configured) {
    const reading = latest.get(capsule.id) ?? null;
    merged.push({
      id: capsule.id,
      name: capsule.name || `Capsule ${capsule.id}`,
      field: capsule.field || '',
      note: capsule.note || '',
      linked: true,
      lastReadingAt: reading?.receivedAt ?? null,
      moisture: reading?.moisture ?? null,
      nitrogen: reading?.nitrogen ?? null,
      temperature: reading?.temperature ?? null,
      battery: reading?.battery ?? null
    });
    seen.add(capsule.id);
  }
  for (const [id, reading] of latest) {
    if (seen.has(id)) continue;
    merged.push({
      id,
      name: `Capsule ${id}`,
      field: '',
      note: '',
      linked: false,
      lastReadingAt: reading.receivedAt,
      moisture: reading.moisture,
      nitrogen: reading.nitrogen,
      temperature: reading.temperature,
      battery: reading.battery
    });
  }
  return merged;
}

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

/* ---------------- sensors ---------------- */

async function handleSensorIngest(req, res, url) {
  if (process.env.SENSOR_KEY) {
    const key = url.searchParams.get('key') ?? req.headers['x-sensor-key'];
    if (key !== process.env.SENSOR_KEY) {
      return sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Invalid sensor key.' });
    }
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: 'INVALID_JSON', message: 'Expected a JSON body.' });
  }

  const capsuleId = String(payload?.capsule_id ?? payload?.capsuleId ?? '').trim();
  const moisture = Number(payload?.moisture);
  const nitrogenRaw = payload?.nitrogen;
  const nitrogen =
    nitrogenRaw === undefined || nitrogenRaw === null || nitrogenRaw === '' ? null : Number(nitrogenRaw);
  const temperatureRaw = payload?.temperature ?? payload?.temp;
  const temperature =
    temperatureRaw === undefined || temperatureRaw === null || temperatureRaw === '' ? null : Number(temperatureRaw);
  const batteryRaw = payload?.battery;
  const battery = batteryRaw === undefined || batteryRaw === null || batteryRaw === '' ? null : Number(batteryRaw);

  if (!capsuleId) {
    return sendJson(res, 400, { error: 'MISSING_CAPSULE', message: 'capsule_id is required.' });
  }
  if (!Number.isFinite(moisture) || moisture < 0 || moisture > 100) {
    return sendJson(res, 400, { error: 'INVALID_MOISTURE', message: 'moisture must be a number between 0 and 100.' });
  }
  if (nitrogen !== null && (!Number.isFinite(nitrogen) || nitrogen < 0 || nitrogen > 1000)) {
    return sendJson(res, 400, { error: 'INVALID_NITROGEN', message: 'nitrogen must be between 0 and 1000.' });
  }
  if (temperature !== null && (!Number.isFinite(temperature) || temperature < -40 || temperature > 60)) {
    return sendJson(res, 400, { error: 'INVALID_TEMPERATURE', message: 'temperature must be between -40 and 60.' });
  }
  if (battery !== null && (!Number.isFinite(battery) || battery < 0 || battery > 100)) {
    return sendJson(res, 400, { error: 'INVALID_BATTERY', message: 'battery must be between 0 and 100.' });
  }

  const reading = {
    id: randomUUID(),
    capsuleId,
    moisture: round1(moisture),
    nitrogen: nitrogen === null ? null : round1(nitrogen),
    temperature: temperature === null ? null : round1(temperature),
    battery: battery === null ? null : round1(battery),
    receivedAt: new Date().toISOString(),
    deviceTime: typeof payload?.ts === 'string' ? payload.ts.slice(0, 40) : null
  };

  const store = await loadSensorStore();
  store.readings.push(reading);

  let alert = null;
  if (reading.moisture <= DRY_THRESHOLD) {
    const last = [...store.alerts].reverse().find((item) => item.capsuleId === capsuleId);
    if (!last || Date.now() - Date.parse(last.at) > ALERT_COOLDOWN_MS) {
      alert = {
        id: randomUUID(),
        capsuleId,
        moisture: reading.moisture,
        threshold: DRY_THRESHOLD,
        at: reading.receivedAt,
        kind: 'dry'
      };
      store.alerts.push(alert);
      notifyTelegram(
        `⚠️ <b>Dry soil alert</b>\nCapsule ${escapeTelegram(capsuleId)}: ${reading.moisture}% moisture (threshold ${DRY_THRESHOLD}%).`
      ).catch(() => {});
    }
  }

  await saveSensorStore(store);
  return sendJson(res, 201, { ok: true, reading, alert });
}

async function handleSensorStatus(req, res) {
  const store = await loadSensorStore();
  const configured = await loadSensorConfig();
  const capsuleList = mergeCapsules(store, configured);
  const last = store.readings.at(-1) ?? null;
  return sendJson(res, 200, {
    ok: true,
    configured: true,
    sensorKeyRequired: Boolean(process.env.SENSOR_KEY),
    dryThreshold: DRY_THRESHOLD,
    count: store.readings.length,
    capsules: capsuleList.length,
    linkedCapsules: configured.length,
    capsuleList,
    alerts: store.alerts.length,
    lastReadingAt: last?.receivedAt ?? null,
    host: server.address()?.address ?? null,
    port: server.address()?.port ?? null,
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN)
  });
}

async function handleSensorLatest(req, res) {
  const store = await loadSensorStore();
  const latest = store.readings.at(-1) ?? null;
  if (!latest) {
    return sendJson(res, 404, {
      error: 'NO_SENSOR_DATA',
      message: 'No sensor readings yet. The capsule is linked; waiting for the first POST to /api/soil.'
    });
  }
  return sendJson(res, 200, legacySample(latest));
}

async function handleSensorHistory(req, res, url) {
  const store = await loadSensorStore();
  const capsuleId = String(url.searchParams.get('capsuleId') ?? '').trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 300) || 300, 1), 1000);
  const items = store.readings
    .filter((item) => !capsuleId || item.capsuleId === capsuleId)
    .slice(-limit)
    .map(legacySample);
  return sendJson(res, 200, items);
}

async function handleSensorCapsules(req, res) {
  const store = await loadSensorStore();
  const configured = await loadSensorConfig();
  return sendJson(res, 200, { ok: true, capsules: mergeCapsules(store, configured) });
}

async function handleSensorReadings(req, res, url) {
  const store = await loadSensorStore();
  const capsuleId = String(url.searchParams.get('capsuleId') ?? '').trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 200) || 200, 1), 1000);
  const items = store.readings
    .filter((item) => !capsuleId || item.capsuleId === capsuleId)
    .slice(-limit)
    .reverse();
  return sendJson(res, 200, { ok: true, items });
}

/* ---------------- workspace snapshot (for the bot) ---------------- */

async function handleWorkspaceSnapshot(req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 200, await readJson(snapshotFile, { fields: [], groups: [], updatedAt: null }));
  }
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: 'INVALID_JSON', message: 'Expected a JSON body.' });
  }
  const fields = Array.isArray(payload?.fields)
    ? payload.fields.slice(0, 500).map((field) => ({
        id: String(field?.id ?? '').slice(0, 80),
        name: String(field?.name ?? '').slice(0, 100),
        areaHa: Number(field?.areaHa) || 0,
        groupId: field?.groupId ? String(field.groupId).slice(0, 80) : null
      }))
    : [];
  const groups = Array.isArray(payload?.groups)
    ? payload.groups.slice(0, 100).map((group) => ({
        id: String(group?.id ?? '').slice(0, 80),
        name: String(group?.name ?? '').slice(0, 60)
      }))
    : [];
  const snapshot = { fields, groups, updatedAt: new Date().toISOString() };
  await writeJson(snapshotFile, snapshot);
  return sendJson(res, 200, { ok: true, snapshot });
}

/* ---------------- Telegram bot ---------------- */

let telegramState = { subscribers: [], lastUpdateId: 0 };
let telegramStarted = false;
let telegramLastError = null;
let telegramLastMessageAt = null;

function telegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

function escapeTelegram(value) {
  return String(value ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

async function loadTelegramState() {
  const data = await readJson(telegramFile, { subscribers: [], lastUpdateId: 0 });
  telegramState = {
    subscribers: Array.isArray(data.subscribers) ? data.subscribers.map(String) : [],
    lastUpdateId: Number(data.lastUpdateId) || 0
  };
}

async function saveTelegramState() {
  await writeJson(telegramFile, telegramState);
}

async function telegramApi(method, payload) {
  const token = telegramToken();
  if (!token) throw new Error('TELEGRAM_NOT_CONFIGURED');
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => null);
  if (!data?.ok) throw new Error(data?.description ?? `Telegram HTTP ${response.status}`);
  return data.result;
}

async function sendTelegram(chatId, text) {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  });
  telegramLastMessageAt = new Date().toISOString();
}

async function notifyTelegram(text) {
  if (!telegramToken() || !telegramState.subscribers.length) return;
  for (const chatId of telegramState.subscribers) {
    try {
      await sendTelegram(chatId, text);
    } catch (error) {
      console.error('[telegram] send failed:', error instanceof Error ? error.message : error);
    }
  }
}

function formatArea(value) {
  return `${(Number(value) || 0).toFixed(1)} ha`;
}

async function telegramStatusText() {
  const snapshot = await readJson(snapshotFile, { fields: [], groups: [], updatedAt: null });
  const store = await loadSensorStore();
  const configured = await loadSensorConfig();
  const capsuleList = mergeCapsules(store, configured);
  const totalArea = snapshot.fields.reduce((sum, field) => sum + (Number(field.areaHa) || 0), 0);
  const lines = [
    '<b>AGRIXON status</b>',
    `Fields: ${snapshot.fields.length} · ${formatArea(totalArea)} · ${snapshot.groups.length} group${snapshot.groups.length === 1 ? '' : 's'}`,
    snapshot.updatedAt ? `Workspace synced: ${new Date(snapshot.updatedAt).toLocaleString('en-GB')}` : 'Workspace not synced yet — open /tools once.',
    ''
  ];
  if (capsuleList.length) {
    lines.push('<b>Sensors</b>');
    for (const capsule of capsuleList) {
      if (capsule.lastReadingAt) {
        const parts = [`${capsule.moisture}% moisture`];
        if (capsule.nitrogen !== null) parts.push(`${capsule.nitrogen} N`);
        if (capsule.temperature !== null) parts.push(`${capsule.temperature} °C`);
        lines.push(`Capsule ${escapeTelegram(capsule.id)} (${escapeTelegram(capsule.name)}): ${parts.join(' · ')} · ${new Date(capsule.lastReadingAt).toLocaleString('en-GB')}`);
      } else {
        lines.push(`Capsule ${escapeTelegram(capsule.id)} (${escapeTelegram(capsule.name)}): linked, waiting for the first reading`);
      }
    }
  } else {
    lines.push('No sensors linked yet.');
  }
  return lines.join('\n');
}

async function telegramFieldsText() {
  const snapshot = await readJson(snapshotFile, { fields: [], groups: [] });
  if (!snapshot.fields.length) return 'No fields in the workspace yet. Add them in /tools → Fields & groups.';
  const groups = new Map(snapshot.groups.map((group) => [group.id, group.name]));
  const lines = ['<b>Fields</b>'];
  for (const field of snapshot.fields.slice(0, 30)) {
    const group = field.groupId ? groups.get(field.groupId) : null;
    lines.push(`• ${escapeTelegram(field.name)} — ${formatArea(field.areaHa)}${group ? ` · ${escapeTelegram(group)}` : ''}`);
  }
  if (snapshot.fields.length > 30) lines.push(`…and ${snapshot.fields.length - 30} more.`);
  return lines.join('\n');
}

async function telegramSensorsText() {
  const store = await loadSensorStore();
  const configured = await loadSensorConfig();
  const capsuleList = mergeCapsules(store, configured);
  if (!capsuleList.length) return 'No sensors linked yet. Add sensors.config.json or POST to /api/soil.';
  const lines = ['<b>Sensor capsules</b>'];
  for (const capsule of capsuleList) {
    if (capsule.lastReadingAt) {
      const parts = [`${capsule.moisture}% moisture`];
      if (capsule.nitrogen !== null) parts.push(`${capsule.nitrogen} N`);
      if (capsule.temperature !== null) parts.push(`${capsule.temperature} °C`);
      if (capsule.battery !== null) parts.push(`battery ${capsule.battery}%`);
      lines.push(`Capsule ${escapeTelegram(capsule.id)} (${escapeTelegram(capsule.name)}): ${parts.join(' · ')}`);
      lines.push(`  ${new Date(capsule.lastReadingAt).toLocaleString('en-GB')}`);
    } else {
      lines.push(`Capsule ${escapeTelegram(capsule.id)} (${escapeTelegram(capsule.name)}): linked, no readings yet`);
    }
  }
  return lines.join('\n');
}

async function telegramAlertsText() {
  const store = await loadSensorStore();
  if (!store.alerts.length) return 'No dry-soil alerts yet.';
  const lines = ['<b>Recent alerts</b>'];
  for (const alert of store.alerts.slice(-8).reverse()) {
    lines.push(`⚠️ Capsule ${escapeTelegram(alert.capsuleId)}: ${alert.moisture}% at ${new Date(alert.at).toLocaleString('en-GB')}`);
  }
  return lines.join('\n');
}

async function telegramWeatherText() {
  const snapshot = await readJson(snapshotFile, { fields: [] });
  const point = DEFAULT_POINT;
  const params = new URLSearchParams({
    latitude: String(point.lat),
    longitude: String(point.lon),
    current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'auto',
    forecast_days: '4'
  });
  const response = await fetch('https://api.open-meteo.com/v1/forecast?' + params, {
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.reason ?? `Open-Meteo HTTP ${response.status}`);
  const current = data.current ?? {};
  const daily = data.daily ?? {};
  const lines = [
    '<b>Weather · farm center</b>',
    `Now: ${current.temperature_2m ?? '—'} °C · ${current.precipitation ?? '—'} mm · wind ${current.wind_speed_10m ?? '—'} km/h`,
    ''
  ];
  (daily.time ?? []).forEach((date, index) => {
    lines.push(
      `${date}: ${daily.temperature_2m_max?.[index] ?? '—'} / ${daily.temperature_2m_min?.[index] ?? '—'} °C · ${daily.precipitation_sum?.[index] ?? '—'} mm`
    );
  });
  lines.push('', 'Open-Meteo forecast — model output, not a field measurement.');
  return lines.join('\n');
}

async function handleTelegramCommand(message) {
  const chatId = String(message.chat?.id ?? '');
  if (!chatId) return;
  const text = String(message.text ?? '').trim();
  const command = text.split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');

  if (command === '/start') {
    if (!telegramState.subscribers.includes(chatId)) {
      telegramState.subscribers.push(chatId);
      await saveTelegramState();
    }
    await sendTelegram(
      chatId,
      'AGRIXON is connected.\n\nCommands:\n/status — farm and sensors\n/fields — field list\n/sensors — latest readings\n/reading 101 42 25 — save a sensor reading\n/weather — 4-day forecast\n/alerts — dry-soil alerts\n/stop — unsubscribe\n\nData stays on the AGRIXON machine; only these replies leave it.'
    );
    return;
  }

  if (command === '/stop') {
    telegramState.subscribers = telegramState.subscribers.filter((id) => id !== chatId);
    await saveTelegramState();
    await sendTelegram(chatId, 'Unsubscribed. Send /start to reconnect.');
    return;
  }

  if (command === '/help') {
    await sendTelegram(
      chatId,
      'Commands: /status, /fields, /sensors, /reading <capsule> <moisture> [nitrogen] [temperature] [battery], /weather, /alerts, /stop'
    );
    return;
  }

  if (command === '/reading') {
    const parts = text.split(/\s+/).slice(1);
    const capsuleId = parts[0];
    const moisture = Number(parts[1]);
    if (!capsuleId || !Number.isFinite(moisture)) {
      await sendTelegram(chatId, 'Usage: /reading <capsule> <moisture 0-100> [nitrogen] [temperature] [battery]');
      return;
    }
    const payload = { capsule_id: capsuleId, moisture };
    if (parts[2] !== undefined) payload.nitrogen = Number(parts[2]);
    if (parts[3] !== undefined) payload.temperature = Number(parts[3]);
    if (parts[4] !== undefined) payload.battery = Number(parts[4]);
    const key = process.env.SENSOR_KEY ? `?key=${encodeURIComponent(process.env.SENSOR_KEY)}` : '';
    const response = await fetch(`http://127.0.0.1:${server.address()?.port ?? port}/api/soil${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      await sendTelegram(chatId, `Reading rejected: ${escapeTelegram(data?.message ?? `HTTP ${response.status}`)}`);
      return;
    }
    const reading = data?.reading ?? {};
    const bits = [`${reading.moisture}% moisture`];
    if (reading.nitrogen !== null && reading.nitrogen !== undefined) bits.push(`${reading.nitrogen} N`);
    if (reading.temperature !== null && reading.temperature !== undefined) bits.push(`${reading.temperature} °C`);
    if (reading.battery !== null && reading.battery !== undefined) bits.push(`battery ${reading.battery}%`);
    await sendTelegram(chatId, `Reading saved · capsule ${escapeTelegram(reading.capsuleId ?? capsuleId)} · ${bits.join(' · ')}`);
    return;
  }

  if (command === '/status') return sendTelegram(chatId, await telegramStatusText());
  if (command === '/fields') return sendTelegram(chatId, await telegramFieldsText());
  if (command === '/sensors') return sendTelegram(chatId, await telegramSensorsText());
  if (command === '/alerts') return sendTelegram(chatId, await telegramAlertsText());
  if (command === '/weather') return sendTelegram(chatId, await telegramWeatherText());

  await sendTelegram(chatId, 'Unknown command. Send /help for the list.');
}

async function pollTelegram() {
  if (!telegramToken()) return;
  try {
    const updates = await telegramApi('getUpdates', {
      offset: telegramState.lastUpdateId + 1,
      timeout: 25,
      allowed_updates: ['message']
    });
    for (const update of updates) {
      telegramState.lastUpdateId = Math.max(telegramState.lastUpdateId, Number(update.update_id) || 0);
      if (update.message?.text) {
        try {
          await handleTelegramCommand(update.message);
        } catch (error) {
          console.error('[telegram] command failed:', error instanceof Error ? error.message : error);
        }
      }
    }
    if (updates.length) await saveTelegramState();
    telegramLastError = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    telegramLastError = message;
    if (!/timeout|aborted|fetch failed/i.test(message)) console.error('[telegram]', message);
  } finally {
    setTimeout(pollTelegram, 1200);
  }
}

async function startTelegramBot() {
  if (telegramStarted || !telegramToken() || process.env.AGRIXON_NO_TELEGRAM === '1') return;
  telegramStarted = true;
  await loadTelegramState();
  try {
    const me = await telegramApi('getMe', {});
    console.log(`[telegram] bot @${me.username} polling`);
  } catch (error) {
    telegramLastError = error instanceof Error ? error.message : String(error);
    console.error('[telegram] getMe failed:', telegramLastError);
  }
  pollTelegram();
}

async function handleTelegramStatus(req, res) {
  return sendJson(res, 200, {
    ok: true,
    configured: Boolean(telegramToken()),
    username: 'agrixonnasa_bot',
    subscribers: telegramState.subscribers.length,
    lastMessageAt: telegramLastMessageAt,
    lastError: telegramLastError
  });
}

async function handleTelegramTest(req, res) {
  if (!telegramToken()) {
    return sendJson(res, 424, {
      error: 'TELEGRAM_NOT_CONFIGURED',
      message: 'Add TELEGRAM_BOT_TOKEN to .env.local and restart the server.'
    });
  }
  if (!telegramState.subscribers.length) {
    return sendJson(res, 409, {
      error: 'NO_SUBSCRIBERS',
      message: 'Open @agrixonnasa_bot in Telegram and send /start first.'
    });
  }
  await notifyTelegram('✅ AGRIXON test message. The bot is connected.');
  return sendJson(res, 200, { ok: true, sent: telegramState.subscribers.length });
}

/* ---------------- HTTP server ---------------- */

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/tools' || url.pathname === '/tools/') {
      return serveFile(res, 'tools.html', 'text/html; charset=utf-8');
    }
    if (url.pathname === '/tools.css') return serveFile(res, 'tools.css', 'text/css; charset=utf-8');
    if (url.pathname === '/tools.js') return serveFile(res, 'tools.js', 'text/javascript; charset=utf-8');
    if (url.pathname === '/plant-library.js') return serveFile(res, 'plant-library.js', 'text/javascript; charset=utf-8');
    if (url.pathname.startsWith('/api/metos/')) return handleMetos(req, res, url);
    if (url.pathname === '/api/weather/forecast') return handleWeather(req, res, url);
    if ((url.pathname === '/api/soil' || url.pathname === '/api/sensors/ingest') && req.method === 'POST') {
      return handleSensorIngest(req, res, url);
    }
    if (url.pathname === '/api/sensors/status' && req.method === 'GET') return handleSensorStatus(req, res);
    if (url.pathname === '/api/sensors/latest' && req.method === 'GET') return handleSensorLatest(req, res);
    if (url.pathname === '/api/sensors/history' && req.method === 'GET') return handleSensorHistory(req, res, url);
    if (url.pathname === '/api/sensors/capsules' && req.method === 'GET') return handleSensorCapsules(req, res);
    if (url.pathname === '/api/sensors/readings' && req.method === 'GET') return handleSensorReadings(req, res, url);
    if (url.pathname === '/api/workspace/snapshot') return handleWorkspaceSnapshot(req, res);
    if (url.pathname === '/api/telegram/status' && req.method === 'GET') return handleTelegramStatus(req, res);
    if (url.pathname === '/api/telegram/test' && req.method === 'POST') return handleTelegramTest(req, res);

    let bodyText = '';
    if (req.method === 'POST') bodyText = await readBody(req);
    const response = await handle(
      new Request('http://' + (req.headers.host ?? 'localhost') + (req.url ?? '/'), { method: req.method }),
      bodyText
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (req.method !== 'HEAD') res.end(Buffer.from(await response.arrayBuffer()));
    else res.end();
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        error: 'SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Request processing failed.'
      })
    );
  }
});

function lanAddresses() {
  const result = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) result.push(entry.address);
    }
  }
  return result;
}

function openBrowser(url) {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    spawn(command, args, { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
  } catch {
    /* the browser is a convenience; the server keeps running */
  }
}

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
server.listen(port, host, () => {
  console.log(`AGRIXON Field Tools: http://localhost:${port}/tools`);
  console.log(`Workspace: http://localhost:${port}`);
  if (host === '0.0.0.0') {
    const lan = lanAddresses();
    if (lan.length) {
      console.log('Sensor ingest on the LAN (use this URL in the ESP32 sketch):');
      for (const ip of lan) console.log(`  http://${ip}:${port}/api/soil`);
    }
    console.log('Set SENSOR_KEY to require ?key=… on POST /api/soil.');
  } else {
    console.log('Localhost only. For ESP32 capsules start with HOST=0.0.0.0 and SENSOR_KEY=…');
  }
  console.log('To stop: Ctrl+C. METOS keys stay on this machine.');
  if (process.env.AGRIXON_OPEN_BROWSER === '1') {
    setTimeout(() => openBrowser(`http://localhost:${port}/tools`), 600);
  }
  startTelegramBot().catch((error) => console.error('[telegram] start failed:', error.message));
});
server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? 'Port busy. Stop the previous app or start with PORT=3001.'
      : 'Could not start the server: ' + error.code
  );
  process.exitCode = 1;
});
