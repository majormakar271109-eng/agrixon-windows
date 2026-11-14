/* AGRIXON Field tools — local-first helpers on top of the main workspace. */
(() => {
  'use strict';

  const WS_KEY = 'appname-live-workspace-v1';
  const YIELD_KEY = 'agrixon-yield-v1';
  const DEFAULT_POINT = [67.243753, 47.979811];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const num = (value, digits = 1) => {
    if (value == null || (typeof value === 'string' && !value.trim())) return '—';
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : '—';
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));

  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 4200);
  }

  function loadWs() {
    try {
      const raw = localStorage.getItem(WS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveWs(ws) {
    localStorage.setItem(WS_KEY, JSON.stringify(ws));
  }

  const DEFAULT_RULES = {
    enabled: [
      'same_crop_repeat',
      'short_return',
      'gdd_shortfall',
      'same_family_repeat',
      'cereal_after_cereal',
      'frost_risk_window',
      'drought_window',
      'no_legume_break',
      'soil_moisture_low',
      'good_predecessor'
    ],
    droughtDays: 14,
    droughtDailyMm: 1,
    lowSoilMoisture: 0.3,
    coverageMin: 0.9
  };

  function defaultFarm() {
    return {
      fields: [],
      plantings: [],
      budgets: {},
      seasons: Array.from({ length: 5 }, (_, i) => ({
        id: String(2022 + i),
        year: 2022 + i,
        startsAt: `${2022 + i}-04-01`,
        endsAt: `${2022 + i}-10-31`
      })),
      groups: [],
      rules: structuredClone(DEFAULT_RULES),
      soilProfiles: [],
      fertilizerPlans: [],
      qualityRecords: [],
      sales: [],
      demo: false
    };
  }

  function getFarm() {
    return loadWs()?.state?.farm ?? null;
  }

  // The main workspace is only written on the first change, so /tools can be
  // opened before it exists. Create the same default farm the main app uses
  // and keep older workspaces safe when a collection is missing.
  function requireFarm() {
    const ws = loadWs();
    if (!ws?.state?.farm) {
      const fresh = { state: { farm: defaultFarm() }, version: 1 };
      saveWs(fresh);
      return fresh;
    }
    const farm = ws.state.farm;
    farm.fields ??= [];
    farm.groups ??= [];
    farm.soilProfiles ??= [];
    return ws;
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* ---------------- tabs ---------------- */

  const TITLES = {
    fields: 'Fields & groups',
    library: 'Plant library',
    weather: 'Weather',
    soil: 'Soil analysis',
    yield: 'Yield report',
    ndvi: 'NDVI compare',
    sensors: 'Sensors',
    metos: 'METOS stations',
    integrations: 'Integrations'
  };

  function showTab(tab) {
    if (!TITLES[tab]) tab = 'fields';
    stopMetosSync();
    $$('.tools-tab').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tab === tab));
    $$('.tools-view').forEach((view) => {
      const on = view.dataset.view === tab;
      view.hidden = !on;
      view.classList.toggle('is-active', on);
    });
    const crumb = $('#tools-crumb');
    if (crumb) crumb.textContent = TITLES[tab];
    document.body.classList.remove('nav-open');
    if (tab === 'library') renderLibrary();
    if (tab === 'weather') renderWeatherFields();
    if (tab === 'ndvi') renderNdviFields();
    if (tab === 'sensors') loadSensors();
    if (tab === 'metos') startMetosSync();
    if (tab === 'integrations') renderIntegrations();
    if (tab === 'soil') renderSoil();
    if (tab === 'yield') renderYield();
    if (tab === 'fields') renderFields();
  }

  /* ---------------- fields & groups ---------------- */

  function circlePolygon(lat, lon, radiusM, points = 64) {
    const ring = [];
    const dLat = radiusM / 111320;
    const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
    for (let i = 0; i < points; i += 1) {
      const angle = (i / points) * Math.PI * 2;
      ring.push([lon + dLon * Math.cos(angle), lat + dLat * Math.sin(angle)]);
    }
    ring.push(ring[0]);
    return { type: 'Polygon', coordinates: [ring] };
  }

  function renderFields() {
    const farm = getFarm();
    const fields = farm?.fields ?? [];
    const groups = farm?.groups ?? [];
    const totalArea = fields.reduce((sum, f) => sum + (Number(f.areaHa) || 0), 0);

    $('#stat-fields').innerHTML = `${fields.length}<em> contours</em>`;
    $('#stat-area').innerHTML = `${num(totalArea, 1)}<em> ha</em>`;
    $('#stat-groups').innerHTML = `${groups.length}<em> groups</em>`;

    const groupOptions = groups
      .map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`)
      .join('');
    const roundGroup = $('#round-group');
    if (roundGroup) roundGroup.innerHTML = `<option value="">No group</option>${groupOptions}`;

    const groupList = $('#group-list');
    if (groupList) {
      groupList.innerHTML = groups.length
        ? groups
            .map((g) => {
              const count = fields.filter((f) => f.groupId === g.id).length;
              return `<div class="tools-list-row"><div><strong>${esc(g.name)}</strong><small>${count} field${count === 1 ? '' : 's'}</small></div><button class="btn small danger" data-action="delete-group" data-id="${esc(g.id)}" type="button">Delete</button></div>`;
            })
            .join('')
        : '<div class="tools-muted">No groups yet.</div>';
    }

    const filter = ($('#field-filter')?.value ?? '').trim().toLowerCase();
    const visible = fields.filter((f) => !filter || String(f.name).toLowerCase().includes(filter));
    const rows = $('#field-rows');
    if (rows) {
      rows.innerHTML = visible
        .map((f) => {
          const options = [`<option value="">No group</option>`]
            .concat(groups.map((g) => `<option value="${esc(g.id)}" ${f.groupId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`))
            .join('');
          return `<tr>
            <td data-label="Field"><strong>${esc(f.name)}</strong><br><small>${esc(f.id.slice(0, 8))}</small></td>
            <td data-label="Area">${num(f.areaHa, 1)} ha</td>
            <td data-label="Group"><select data-action="assign-group" data-id="${esc(f.id)}" aria-label="Group for ${esc(f.name)}">${options}</select></td>
            <td data-label="Boundary"><div class="tools-row-actions"><button class="btn small" data-action="export-field-kml" data-id="${esc(f.id)}" type="button">KML</button><button class="btn small" data-action="export-field-geojson" data-id="${esc(f.id)}" type="button">GeoJSON</button></div></td>
          </tr>`;
        })
        .join('');
    }
    const empty = $('#fields-empty');
    if (empty) empty.hidden = fields.length > 0;
  }

  function addRoundField(form) {
    const ws = requireFarm();
    if (!ws) return;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const lat = Number(data.get('lat'));
    const lon = Number(data.get('lon'));
    const radius = Number(data.get('radius'));
    const groupId = String(data.get('groupId') ?? '').trim();
    if (!name) return toast('Enter a field name.');
    if (!Number.isFinite(lat) || Math.abs(lat) > 90) return toast('Latitude must be between -90 and 90.');
    if (!Number.isFinite(lon) || Math.abs(lon) > 180) return toast('Longitude must be between -180 and 180.');
    if (!Number.isFinite(radius) || radius < 10 || radius > 5000) return toast('Radius must be between 10 and 5000 m.');

    const farm = ws.state.farm;
    const field = {
      id: uid(),
      name,
      areaHa: (Math.PI * radius * radius) / 10000,
      geometry: circlePolygon(lat, lon, radius),
      color: '#6E8868',
      ...(groupId ? { groupId } : {})
    };
    farm.fields.push(field);
    saveWs(ws);
    form.reset();
    form.querySelector('[name="radius"]').value = '400';
    renderFields();
    syncWorkspaceSnapshot();
    toast(`Round field “${name}” added. Open the workspace to see it on the map.`);
  }

  function addGroup(form) {
    const ws = requireFarm();
    if (!ws) return;
    const name = String(new FormData(form).get('name') ?? '').trim();
    if (!name) return toast('Enter a group name.');
    const farm = ws.state.farm;
    if (farm.groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) return toast('A group with this name already exists.');
    farm.groups.push({ id: uid(), name });
    saveWs(ws);
    form.reset();
    renderFields();
    syncWorkspaceSnapshot();
    toast(`Group “${name}” added.`);
  }

  function deleteGroup(id) {
    const ws = requireFarm();
    if (!ws) return;
    const farm = ws.state.farm;
    const group = farm.groups.find((g) => g.id === id);
    if (!group) return;
    if (!confirm(`Delete group “${group.name}”? Fields stay, but lose the group assignment.`)) return;
    farm.groups = farm.groups.filter((g) => g.id !== id);
    farm.fields.forEach((f) => {
      if (f.groupId === id) delete f.groupId;
    });
    saveWs(ws);
    renderFields();
    syncWorkspaceSnapshot();
    toast('Group deleted.');
  }

  function assignGroup(fieldId, groupId) {
    const ws = requireFarm();
    if (!ws) return;
    const field = ws.state.farm.fields.find((f) => f.id === fieldId);
    if (!field) return;
    if (groupId) field.groupId = groupId;
    else delete field.groupId;
    saveWs(ws);
    renderFields();
    syncWorkspaceSnapshot();
    toast('Group updated.');
  }

  function exportGeoJson(fields, name = 'agrixon-fields.geojson') {
    const fc = {
      type: 'FeatureCollection',
      features: fields.map((f) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: f.id,
          name: f.name,
          areaHa: f.areaHa,
          groupId: f.groupId ?? null
        }
      }))
    };
    download(name, JSON.stringify(fc, null, 2), 'application/geo+json');
  }

  function xmlEsc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));
  }

  function exportKml(fields, name = 'agrixon-fields.kml') {
    const placemarks = fields
      .map((f) => {
        const ring = f.geometry.coordinates[0].map(([lon, lat]) => `${lon},${lat},0`).join(' ');
        return `<Placemark><name>${xmlEsc(f.name)}</name><ExtendedData><Data name="areaHa"><value>${num(f.areaHa, 2)}</value></Data><Data name="groupId"><value>${xmlEsc(f.groupId ?? '')}</value></Data></ExtendedData><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
      })
      .join('');
    const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>AGRIXON fields</name>${placemarks}</Document></kml>`;
    download(name, kml, 'application/vnd.google-earth.kml+xml');
  }

  /* ---------------- plant library ---------------- */

  const PLANTS = Array.isArray(window.AGRIXON_PLANTS) ? window.AGRIXON_PLANTS : [];
  let libraryCrop = null;

  function plantSearchText(plant) {
    return [
      plant.name,
      plant.family,
      plant.rotation,
      plant.sowing,
      plant.harvest,
      plant.gdd,
      plant.water,
      ...(plant.tips ?? []),
      ...(plant.diseases ?? []).flatMap((item) => [item.name, item.pathogen, item.symptoms, item.prevention, item.treatment]),
      ...(plant.pests ?? []).flatMap((item) => [item.name, item.symptoms, item.prevention, item.treatment])
    ]
      .join(' ')
      .toLowerCase();
  }

  function renderLibrary() {
    const grid = $('#library-grid');
    if (!grid) return;
    const needle = ($('#library-search')?.value ?? '').trim().toLowerCase();
    const visible = PLANTS.filter((plant) => !needle || plantSearchText(plant).includes(needle));
    grid.innerHTML = visible.length
      ? visible
          .map(
            (plant) => `<button class="library-card" data-action="open-plant" data-id="${esc(plant.id)}" type="button">
              <span class="library-swatch" style="background:${esc(plant.color)}"></span>
              <strong>${esc(plant.name)}</strong>
              <small>${esc(plant.family)}</small>
              <span class="library-count">${plant.diseases.length} diseases · ${plant.pests.length} pests</span>
            </button>`
          )
          .join('')
      : '<div class="tools-muted">No crop, disease or symptom matches this search.</div>';
    if (libraryCrop) renderPlantDetail(libraryCrop, false);
  }

  function renderPlantDetail(id, scroll = true) {
    const plant = PLANTS.find((item) => item.id === id);
    const box = $('#library-detail');
    if (!plant || !box) return;
    libraryCrop = id;
    box.hidden = false;
    box.innerHTML = `
      <div class="library-detail-head">
        <div><div class="eyebrow">${esc(plant.family)}</div><h2>${esc(plant.name)}</h2></div>
        <button class="btn small" data-action="close-plant" type="button">Close</button>
      </div>
      <div class="library-facts">
        <div><small>Rotation</small><p>${esc(plant.rotation)}</p></div>
        <div><small>Sowing</small><p>${esc(plant.sowing)}</p></div>
        <div><small>Harvest</small><p>${esc(plant.harvest)}</p></div>
        <div><small>Heat &amp; water</small><p>${esc(plant.gdd)}. ${esc(plant.water)}</p></div>
      </div>
      <h3>Diseases</h3>
      <div class="library-problems">
        ${plant.diseases
          .map(
            (item) => `<details class="library-problem"><summary><strong>${esc(item.name)}</strong><small>${esc(item.pathogen)}</small></summary><div><p><b>Symptoms.</b> ${esc(item.symptoms)}</p><p><b>Prevention.</b> ${esc(item.prevention)}</p><p><b>Treatment.</b> ${esc(item.treatment)}</p></div></details>`
          )
          .join('')}
      </div>
      <h3>Pests</h3>
      <div class="library-problems">
        ${plant.pests
          .map(
            (item) => `<details class="library-problem"><summary><strong>${esc(item.name)}</strong></summary><div><p><b>Symptoms.</b> ${esc(item.symptoms)}</p><p><b>Prevention.</b> ${esc(item.prevention)}</p><p><b>Treatment.</b> ${esc(item.treatment)}</p></div></details>`
          )
          .join('')}
      </div>
      <h3>Cultivation tips</h3>
      <ul class="library-tips">${plant.tips.map((tip) => `<li>${esc(tip)}</li>`).join('')}</ul>
    `;
    if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- weather ---------------- */

  function fieldCenter(field) {
    if (!field?.geometry?.coordinates?.[0]?.length) return DEFAULT_POINT;
    const ring = field.geometry.coordinates[0];
    let lon = 0;
    let lat = 0;
    for (const [x, y] of ring) {
      lon += x;
      lat += y;
    }
    return [lon / ring.length, lat / ring.length];
  }

  function renderWeatherFields() {
    const farm = getFarm();
    const fields = farm?.fields ?? [];
    const select = $('#weather-field');
    if (!select) return;
    const current = select.value;
    select.innerHTML = fields.length
      ? fields.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')
      : '<option value="">Farm center</option>';
    if (current && fields.some((f) => f.id === current)) select.value = current;
  }

  async function loadWeather() {
    const farm = getFarm();
    const fields = farm?.fields ?? [];
    const fieldId = $('#weather-field')?.value;
    const field = fields.find((f) => f.id === fieldId);
    const [lon, lat] = field ? fieldCenter(field) : DEFAULT_POINT;
    const status = $('#weather-status');
    status.hidden = false;
    status.textContent = 'Loading the 7-day forecast…';
    $('#weather-current').hidden = true;
    $('#weather-days').hidden = true;
    $('#weather-gdd').hidden = true;

    try {
      const response = await fetch(`/api/weather/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? `HTTP ${response.status}`);
      const data = payload.data;
      const current = data.current ?? {};
      const daily = data.daily ?? {};
      const units = data.current_units ?? {};

      $('#weather-current').innerHTML = [
        ['Temperature', current.temperature_2m, units.temperature_2m ?? '°C'],
        ['Humidity', current.relative_humidity_2m, units.relative_humidity_2m ?? '%'],
        ['Precipitation', current.precipitation, units.precipitation ?? 'mm'],
        ['Wind', current.wind_speed_10m, units.wind_speed_10m ?? 'km/h'],
        ['Cloud cover', current.cloud_cover, units.cloud_cover ?? '%'],
        ['Dew point', current.dew_point_2m, units.dew_point_2m ?? '°C']
      ]
        .map(
          ([label, value, unit]) =>
            `<div class="tools-weather-now"><small>${esc(label)}</small><strong>${num(value, 1)}<em>${esc(unit)}</em></strong></div>`
        )
        .join('');
      $('#weather-current').hidden = false;

      const days = (daily.time ?? []).map((date, i) => {
        const max = daily.temperature_2m_max?.[i];
        const min = daily.temperature_2m_min?.[i];
        const rain = daily.precipitation_sum?.[i];
        const wind = daily.wind_speed_10m_max?.[i];
        const humidity = daily.relative_humidity_2m_mean?.[i];
        return `<div class="tools-day"><small>${esc(new Date(date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }))}</small><strong>${num(max, 1)}° / ${num(min, 1)}°</strong><span class="tools-day-rain">${num(rain, 1)} mm</span><span>Wind ${num(wind, 0)} km/h</span><span>Humidity ${num(humidity, 0)}%</span></div>`;
      });
      $('#weather-days').innerHTML = days.join('');
      $('#weather-days').hidden = false;
      status.hidden = true;

      await loadGdd(lat, lon, field);
    } catch (error) {
      status.hidden = false;
      status.textContent = `Forecast unavailable: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  async function loadGdd(lat, lon, field) {
    const season = new Date().getFullYear();
    const start = `${season}-04-01`;
    const end = today();
    const box = $('#weather-gdd');
    box.hidden = false;
    box.innerHTML = '<h2>Growing degree days</h2><p class="card-description">NASA POWER daily observations for the current season. Base temperature 10 °C.</p><div class="tools-muted">Loading POWER…</div>';
    try {
      const response = await fetch(`/api/nasa/power?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&start=${start}&end=${end}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
      const rows = Array.isArray(payload.data) ? payload.data : [];
      let gdd = 0;
      let days = 0;
      for (const row of rows) {
        const tMax = Number(row.tMax);
        const tMin = Number(row.tMin);
        if (!Number.isFinite(tMax) || !Number.isFinite(tMin)) continue;
        gdd += Math.max(0, (tMax + tMin) / 2 - 10);
        days += 1;
      }
      box.innerHTML = `<h2>Growing degree days</h2><p class="card-description">NASA POWER daily observations for ${esc(field?.name ?? 'the farm center')}. Base temperature 10 °C. ${payload.status === 'stale' ? 'Cached response.' : ''}</p><div class="tools-gdd-grid"><div><small>Accumulated GDD</small><strong>${num(gdd, 0)}</strong></div><div><small>Days with data</small><strong>${days}</strong></div><div><small>Season</small><strong>${season}</strong></div></div>`;
    } catch (error) {
      box.innerHTML = `<h2>Growing degree days</h2><p class="card-description">NASA POWER is unavailable: ${esc(error instanceof Error ? error.message : 'unknown error')}</p>`;
    }
  }

  /* ---------------- CSV helpers ---------------- */

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quote = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quote) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i += 1;
          } else {
            quote = false;
          }
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        quote = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (ch !== '\r') {
        cell += ch;
      }
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  }

  function csvEscape(value) {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function toCsv(headers, rows) {
    return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\r\n');
  }

  function headerMap(header) {
    const map = {};
    header.forEach((h, i) => {
      map[String(h).trim().toLowerCase()] = i;
    });
    return map;
  }

  function findField(farm, value) {
    const needle = String(value ?? '').trim().toLowerCase();
    if (!needle) return null;
    return farm.fields.find((f) => f.id === value || String(f.name).trim().toLowerCase() === needle) ?? null;
  }

  /* ---------------- soil ---------------- */

  function renderSoil() {
    const farm = getFarm();
    const profiles = farm?.soilProfiles ?? [];
    const rows = $('#soil-rows');
    if (!rows) return;
    rows.innerHTML = profiles
      .map((p) => {
        const field = farm.fields.find((f) => f.id === p.fieldId);
        return `<tr><td data-label="Field"><strong>${esc(field?.name ?? p.fieldId)}</strong></td><td data-label="pH">${p.ph ?? '—'}</td><td data-label="Humus, %">${p.humus ?? '—'}</td><td data-label="Texture">${esc(p.texture ?? '—')}</td><td data-label="Drainage">${esc(p.drainage ?? '—')}</td><td data-label="Notes">${esc(p.notes ?? '—')}</td></tr>`;
      })
      .join('');
    const status = $('#soil-status');
    status.hidden = profiles.length > 0;
    status.textContent = profiles.length ? '' : 'No soil analysis imported yet.';
  }

  async function importSoil(file) {
    const ws = requireFarm();
    if (!ws) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) return toast('CSV must contain a header and at least one row.');
    const map = headerMap(rows[0]);
    if (map.field === undefined) return toast('CSV needs a “field” column.');
    const farm = ws.state.farm;
    let updated = 0;
    let skipped = 0;
    for (const row of rows.slice(1)) {
      const field = findField(farm, row[map.field]);
      if (!field) {
        skipped += 1;
        continue;
      }
      const ph = map.ph !== undefined && row[map.ph] !== '' ? Number(row[map.ph]) : undefined;
      const humus = map.humus !== undefined && row[map.humus] !== '' ? Number(row[map.humus]) : undefined;
      if (ph !== undefined && (!Number.isFinite(ph) || ph < 3 || ph > 10)) {
        skipped += 1;
        continue;
      }
      if (humus !== undefined && (!Number.isFinite(humus) || humus < 0 || humus > 20)) {
        skipped += 1;
        continue;
      }
      const existing = farm.soilProfiles.find((p) => p.fieldId === field.id);
      const profile = existing ?? { id: uid(), fieldId: field.id };
      if (ph !== undefined) profile.ph = ph;
      if (humus !== undefined) profile.humus = humus;
      if (map.texture !== undefined && row[map.texture]) profile.texture = String(row[map.texture]).slice(0, 20);
      if (map.drainage !== undefined && row[map.drainage]) profile.drainage = String(row[map.drainage]).slice(0, 20);
      if (map.notes !== undefined && row[map.notes]) profile.notes = String(row[map.notes]).slice(0, 400);
      profile.updatedAt = new Date().toISOString();
      if (!existing) farm.soilProfiles.push(profile);
      updated += 1;
    }
    saveWs(ws);
    renderSoil();
    toast(`Soil analysis: ${updated} updated, ${skipped} skipped.`);
  }

  function exportSoil() {
    const farm = getFarm();
    const profiles = farm?.soilProfiles ?? [];
    if (!profiles.length) return toast('No soil analysis to export.');
    const rows = profiles.map((p) => {
      const field = farm.fields.find((f) => f.id === p.fieldId);
      return [field?.name ?? p.fieldId, p.ph ?? '', p.humus ?? '', p.texture ?? '', p.drainage ?? '', p.notes ?? ''];
    });
    download('agrixon-soil.csv', toCsv(['field', 'ph', 'humus', 'texture', 'drainage', 'notes'], rows), 'text/csv;charset=utf-8');
  }

  /* ---------------- yield ---------------- */

  function loadYield() {
    try {
      const raw = localStorage.getItem(YIELD_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveYield(rows) {
    localStorage.setItem(YIELD_KEY, JSON.stringify(rows));
  }

  function renderYield() {
    const rows = loadYield();
    const summary = $('#yield-summary');
    const status = $('#yield-status');
    const tbody = $('#yield-rows');
    if (!tbody) return;
    const totalArea = rows.reduce((s, r) => s + (Number(r.area_ha) || 0), 0);
    const totalProduction = rows.reduce((s, r) => s + (Number(r.area_ha) || 0) * (Number(r.yield_t_ha) || 0), 0);
    const avg = totalArea > 0 ? totalProduction / totalArea : 0;
    $('#yield-count').textContent = String(rows.length);
    $('#yield-area').innerHTML = `${num(totalArea, 1)}<em> ha</em>`;
    $('#yield-total').innerHTML = `${num(totalProduction, 1)}<em> t</em>`;
    $('#yield-avg').innerHTML = `${num(avg, 2)}<em> t/ha</em>`;
    summary.hidden = rows.length === 0;
    status.hidden = rows.length > 0;
    status.textContent = rows.length ? '' : 'No yield data imported yet.';
    tbody.innerHTML = rows
      .map(
        (r) => `<tr><td data-label="Field"><strong>${esc(r.field)}</strong></td><td data-label="Crop">${esc(r.crop ?? '—')}</td><td data-label="Year">${esc(r.year ?? '—')}</td><td data-label="Area, ha">${num(r.area_ha, 1)}</td><td data-label="Yield, t/ha">${num(r.yield_t_ha, 2)}</td><td data-label="Production, t">${num((Number(r.area_ha) || 0) * (Number(r.yield_t_ha) || 0), 1)}</td><td data-label="Protein, %">${r.protein ?? '—'}</td><td data-label="Starch, %">${r.starch ?? '—'}</td></tr>`
      )
      .join('');
  }

  async function importYield(file) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) return toast('CSV must contain a header and at least one row.');
    const map = headerMap(rows[0]);
    if (map.field === undefined || map.yield_t_ha === undefined) return toast('CSV needs “field” and “yield_t_ha” columns.');
    const existing = loadYield();
    let added = 0;
    for (const row of rows.slice(1)) {
      const field = String(row[map.field] ?? '').trim();
      const yieldValue = Number(row[map.yield_t_ha]);
      if (!field || !Number.isFinite(yieldValue)) continue;
      existing.push({
        id: uid(),
        field,
        crop: map.crop !== undefined ? String(row[map.crop] ?? '').trim() : '',
        year: map.year !== undefined ? String(row[map.year] ?? '').trim() : '',
        area_ha: map.area_ha !== undefined ? Number(row[map.area_ha]) || 0 : 0,
        yield_t_ha: yieldValue,
        moisture: map.moisture !== undefined ? String(row[map.moisture] ?? '').trim() : '',
        protein: map.protein !== undefined ? String(row[map.protein] ?? '').trim() : '',
        starch: map.starch !== undefined ? String(row[map.starch] ?? '').trim() : '',
        notes: map.notes !== undefined ? String(row[map.notes] ?? '').trim() : ''
      });
      added += 1;
    }
    saveYield(existing);
    renderYield();
    toast(`Yield report: ${added} rows imported.`);
  }

  function exportYield() {
    const rows = loadYield();
    if (!rows.length) return toast('No yield data to export.');
    const headers = ['field', 'crop', 'year', 'area_ha', 'yield_t_ha', 'moisture', 'protein', 'starch', 'notes'];
    download(
      'agrixon-yield.csv',
      toCsv(headers, rows.map((r) => headers.map((h) => r[h] ?? ''))),
      'text/csv;charset=utf-8'
    );
  }

  /* ---------------- NDVI ---------------- */

  function renderNdviFields() {
    const farm = getFarm();
    const fields = farm?.fields ?? [];
    const select = $('#ndvi-field');
    if (!select) return;
    const current = select.value;
    select.innerHTML = fields.length
      ? fields.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')
      : '<option value="">No fields</option>';
    if (current && fields.some((f) => f.id === current)) select.value = current;
    const date1 = $('#ndvi-date-1');
    const date2 = $('#ndvi-date-2');
    if (date1 && !date1.value) {
      const d = new Date();
      d.setDate(d.getDate() - 8);
      date1.value = d.toISOString().slice(0, 10);
    }
    if (date2 && !date2.value) date2.value = today();
    [date1, date2].forEach((input) => {
      if (input) input.max = today();
    });
  }

  function fieldBbox(field) {
    const ring = field?.geometry?.coordinates?.[0] ?? [];
    if (!ring.length) return null;
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const [lon, lat] of ring) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    const padLon = Math.max((maxLon - minLon) * 0.08, 0.005);
    const padLat = Math.max((maxLat - minLat) * 0.08, 0.005);
    return [minLon - padLon, minLat - padLat, maxLon + padLon, maxLat + padLat].map((v) => v.toFixed(6)).join(',');
  }

  let ndviUrls = [];
  async function loadNdvi() {
    const farm = getFarm();
    const field = farm?.fields.find((f) => f.id === $('#ndvi-field')?.value);
    const date1 = $('#ndvi-date-1')?.value;
    const date2 = $('#ndvi-date-2')?.value;
    const status = $('#ndvi-status');
    if (!field) return toast('Add a field first.');
    if (!date1 || !date2) return toast('Choose two dates.');
    const bbox = fieldBbox(field);
    if (!bbox) return toast('Field geometry is empty.');
    status.hidden = false;
    status.textContent = 'Loading NASA GIBS NDVI imagery…';
    $('#ndvi-grid').hidden = true;
    ndviUrls.forEach((url) => URL.revokeObjectURL(url));
    ndviUrls = [];
    try {
      const images = await Promise.all(
        [date1, date2].map(async (date) => {
          const response = await fetch(
            `/api/nasa/worldview?bbox=${encodeURIComponent(bbox)}&date=${encodeURIComponent(date)}&layer=MODIS_Terra_NDVI_8Day&width=640&height=480`
          );
          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
          }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          ndviUrls.push(url);
          return url;
        })
      );
      $('#ndvi-img-1').src = images[0];
      $('#ndvi-img-2').src = images[1];
      $('#ndvi-cap-1').textContent = `${field.name} · ${date1} · MODIS Terra NDVI 8-day`;
      $('#ndvi-cap-2').textContent = `${field.name} · ${date2} · MODIS Terra NDVI 8-day`;
      $('#ndvi-grid').hidden = false;
      status.hidden = true;
    } catch (error) {
      status.hidden = false;
      status.textContent = `NDVI imagery unavailable: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  /* ---------------- sensors ---------------- */

  let sensorHistory = [];
  let sensorLatest = [];
  let sensorCapsules = [];

  function sensorTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  }

  function moistureTone(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'unknown';
    if (n <= 25) return 'dry';
    if (n <= 45) return 'low';
    return 'ok';
  }

  function renderSensorCards() {
    const box = $('#sensor-cards');
    if (!box) return;
    const capsules = sensorCapsules.length
      ? sensorCapsules
      : sensorLatest.map((reading) => ({
          id: reading.capsuleId,
          name: `Capsule ${reading.capsuleId}`,
          lastReadingAt: reading.receivedAt,
          moisture: reading.moisture,
          nitrogen: reading.nitrogen,
          temperature: reading.temperature,
          battery: reading.battery
        }));
    if (!capsules.length) {
      box.innerHTML = '<div class="tools-muted">No sensors linked yet. Add sensors.config.json or POST to /api/soil.</div>';
      return;
    }
    box.innerHTML = capsules
      .map((capsule) => {
        const hasReading = capsule.lastReadingAt !== null && capsule.lastReadingAt !== undefined;
        const tone = hasReading ? moistureTone(capsule.moisture) : 'unknown';
        const parts = [];
        if (capsule.nitrogen !== null && capsule.nitrogen !== undefined) parts.push(`${num(capsule.nitrogen, 1)} N`);
        if (capsule.temperature !== null && capsule.temperature !== undefined) parts.push(`${num(capsule.temperature, 1)} °C`);
        if (capsule.battery !== null && capsule.battery !== undefined) parts.push(`battery ${num(capsule.battery, 0)}%`);
        const name = capsule.name && capsule.name !== `Capsule ${capsule.id}` ? `<div class="sensor-name">${esc(capsule.name)}</div>` : '';
        return `<div class="sensor-card sensor-${tone}">
          <div class="sensor-card-head"><strong>Capsule ${esc(capsule.id)}</strong><span class="sensor-dot"></span></div>
          ${name}
          <div class="sensor-moisture">${hasReading ? num(capsule.moisture, 1) : '—'}<em>% moisture</em></div>
          <div class="sensor-meta">${hasReading ? (parts.length ? esc(parts.join(' · ')) : 'No extra sensors') : 'Linked · waiting for the first reading'}</div>
          <div class="sensor-time">${hasReading ? esc(sensorTime(capsule.lastReadingAt)) : 'No data yet'}</div>
        </div>`;
      })
      .join('');
  }

  function renderSensorRows() {
    const tbody = $('#sensor-rows');
    if (!tbody) return;
    const filter = $('#sensor-filter')?.value ?? '';
    const rows = sensorHistory.filter((reading) => !filter || reading.capsuleId === filter);
    tbody.innerHTML = rows
      .map(
        (reading) => `<tr>
          <td data-label="Time">${esc(sensorTime(reading.receivedAt))}</td>
          <td data-label="Capsule"><strong>${esc(reading.capsuleId)}</strong></td>
          <td data-label="Moisture">${num(reading.moisture, 1)}%</td>
          <td data-label="Nitrogen">${reading.nitrogen === null ? '—' : num(reading.nitrogen, 1)}</td>
          <td data-label="Temperature">${reading.temperature === null ? '—' : num(reading.temperature, 1) + ' °C'}</td>
          <td data-label="Battery">${reading.battery === null ? '—' : num(reading.battery, 0) + '%'}</td>
        </tr>`
      )
      .join('');
    const empty = $('#sensors-empty');
    if (empty) empty.hidden = rows.length > 0;
  }

  function renderSensorFilter() {
    const select = $('#sensor-filter');
    if (!select) return;
    const current = select.value;
    const ids = [
      ...new Set([
        ...sensorCapsules.map((capsule) => capsule.id),
        ...sensorHistory.map((reading) => reading.capsuleId)
      ])
    ];
    select.innerHTML = '<option value="">All capsules</option>' + ids.map((id) => `<option value="${esc(id)}">${esc(id)}</option>`).join('');
    if (current && ids.includes(current)) select.value = current;
  }

  async function loadSensors() {
    const status = $('#sensors-status');
    if (status) {
      status.hidden = false;
      status.textContent = 'Loading sensor data…';
    }
    try {
      const [statusResponse, capsulesResponse, readingsResponse, telegramResponse] = await Promise.all([
        fetch('/api/sensors/status'),
        fetch('/api/sensors/capsules'),
        fetch('/api/sensors/readings?limit=200'),
        fetch('/api/telegram/status')
      ]);
      const statusData = await statusResponse.json();
      const capsulesData = await capsulesResponse.json();
      const readingsData = await readingsResponse.json();
      const telegramData = await telegramResponse.json();

      sensorLatest = Array.isArray(readingsData.items) ? readingsData.items : [];
      sensorHistory = Array.isArray(readingsData.items) ? readingsData.items : [];
      sensorCapsules = Array.isArray(capsulesData.capsules)
        ? capsulesData.capsules
        : Array.isArray(statusData.capsuleList)
          ? statusData.capsuleList
          : [];

      $('#sensor-count').textContent = String(statusData.capsules ?? sensorCapsules.length ?? 0);
      $('#sensor-total').textContent = String(statusData.count ?? 0);
      const lastReading = statusData.lastReadingAt ? new Date(statusData.lastReadingAt) : null;
      $('#sensor-last').textContent = lastReading
        ? lastReading.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '—';
      $('#sensor-last').title = lastReading ? sensorTime(statusData.lastReadingAt) : '';
      $('#sensor-alerts').textContent = String(statusData.alerts ?? 0);
      $('#sensors-summary').hidden = false;

      renderSensorCards();
      renderSensorFilter();
      renderSensorRows();

      if (status) {
        const host = statusData.host ?? '';
        const lanOnly = host === '127.0.0.1' || host === '::1';
        status.hidden = false;
        status.innerHTML = [
          `<span class="tools-badge-ok">Endpoint ready</span> · ${statusData.linkedCapsules ?? 0} linked · ${statusData.count ?? 0} readings · dry threshold ${statusData.dryThreshold ?? 25}%`,
          statusData.sensorKeyRequired ? ' · sensor key required' : ' · no sensor key',
          lanOnly
            ? '<br><span class="tools-badge-warn">Localhost only.</span> The ESP32 cannot reach 127.0.0.1. Restart with <code>HOST=0.0.0.0 SENSOR_KEY=…</code> to accept LAN readings.'
            : `<br>Listening on ${esc(host)}:${esc(statusData.port ?? '')} — the capsule can post to this machine.`
        ].join('');
      }

      const telegram = $('#telegram-status');
      if (telegram) {
        telegram.innerHTML = telegramData.configured
          ? `<span class="tools-badge-ok">Connected</span> · @${esc(telegramData.username ?? 'agrixonnasa_bot')} · ${telegramData.subscribers ?? 0} subscriber${telegramData.subscribers === 1 ? '' : 's'}${telegramData.lastError ? `<br><span class="tools-badge-warn">Last error:</span> ${esc(telegramData.lastError)}` : ''}`
          : '<span class="tools-badge-warn">Not configured.</span> Add <code>TELEGRAM_BOT_TOKEN</code> to <code>.env.local</code>, restart, then send /start to @agrixonnasa_bot.';
      }
    } catch (error) {
      if (status) {
        status.hidden = false;
        status.textContent = `Sensor endpoint unavailable: ${error instanceof Error ? error.message : 'unknown error'}`;
      }
    }
  }

  async function sendTestReading() {
    const moisture = 18 + Math.round(Math.random() * 30);
    const nitrogen = 10 + Math.round(Math.random() * 30);
    try {
      const response = await fetch('/api/soil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capsule_id: 'demo-101', moisture, nitrogen, temperature: 12.4, battery: 87 })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? `HTTP ${response.status}`);
      toast(`Test reading stored: capsule ${payload.reading.capsuleId}, ${payload.reading.moisture}% moisture.`);
      await loadSensors();
    } catch (error) {
      toast(`Test reading failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  async function sendTelegramTest() {
    try {
      const response = await fetch('/api/telegram/test', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? `HTTP ${response.status}`);
      toast(`Telegram test sent to ${payload.sent} subscriber${payload.sent === 1 ? '' : 's'}.`);
    } catch (error) {
      toast(`Telegram test failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  async function syncWorkspaceSnapshot() {
    const farm = getFarm();
    if (!farm) return;
    try {
      await fetch('/api/workspace/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: (farm.fields ?? []).map((field) => ({
            id: field.id,
            name: field.name,
            areaHa: field.areaHa,
            groupId: field.groupId ?? null
          })),
          groups: farm.groups ?? []
        })
      });
    } catch {
      /* the bot will show the last snapshot */
    }
  }

  /* ---------------- METOS ---------------- */

  let metosStations = [];
  let metosTimer = null;
  let metosGeneration = 0;
  let metosDataRequest = 0;
  const metosVisible = () => !document.hidden && !$('.tools-view[data-view="metos"]').hidden;
  function stopMetosSync() {
    clearTimeout(metosTimer);
    metosGeneration++;
    metosDataRequest++;
  }
  async function startMetosSync() {
    stopMetosSync();
    if (!metosVisible()) return;
    const generation = metosGeneration;
    const connected = await loadMetosStatus(generation);
    if (generation !== metosGeneration || !metosVisible()) return;
    if (connected && selectedStation()) await loadMetosCurrent();
    if (generation === metosGeneration && metosVisible()) {
      metosTimer = setTimeout(startMetosSync, 300000);
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (metosVisible()) startMetosSync();
    else stopMetosSync();
  });

  function stationId(station) {
    return String(station?.uid ?? station?.stationId ?? station?.id ?? station?.info?.uid ?? station?.name?.original ?? '');
  }

  function stationName(station) {
    return String(station?.name?.custom || station?.name?.original || station?.info?.device_name || stationId(station));
  }

  async function loadMetosStatus(generation = metosGeneration) {
    const status = $('#metos-status');
    const connectCard = $('#metos-connect-card');
    try {
      const response = await fetch('/api/metos/status', { signal: AbortSignal.timeout(25000) });
      const data = await response.json();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (generation !== metosGeneration) return false;
      if (data.configured) {
        status.hidden = false;
        status.textContent = 'Keys configured locally. Checking linked stations…';
        connectCard.hidden = true;
        return await loadMetosStations(generation);
      } else {
        status.hidden = false;
        status.textContent = 'Not connected. Add your FieldClimate Public Key and Private Key below.';
        connectCard.hidden = false;
        $('#metos-stations').innerHTML = '<div class="tools-muted">Not connected.</div>';
        metosStations = [];
        $('#metos-data-card').hidden = true;
        $('#metos-sync').textContent = 'Not connected.';
      }
    } catch (error) {
      if (generation !== metosGeneration) return false;
      status.hidden = false;
      status.textContent = `METOS status unavailable: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
    return false;
  }

  async function loadMetosStations(generation = metosGeneration) {
    const box = $('#metos-stations');
    const selected = selectedStation();
    try {
      const response = await fetch('/api/metos/stations', { signal: AbortSignal.timeout(25000) });
      const payload = await response.json();
      if (generation !== metosGeneration) return false;
      if (!response.ok) throw new Error(payload?.message ?? `HTTP ${response.status}`);
      const raw = payload.data;
      metosStations = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      if (!metosStations.length) {
        box.innerHTML = '<div class="tools-muted">No stations linked to this FieldClimate account.</div>';
        $('#metos-data-card').hidden = true;
        $('#metos-sync').textContent = 'No linked stations.';
        return false;
      }
      const chosen = metosStations.some(s => stationId(s) === selected) ? selected : stationId(metosStations[0]);
      box.innerHTML = metosStations
        .map((station) => {
          const id = stationId(station);
          const name = stationName(station);
          const last = station?.dates?.last_communication ?? station?.dates?.max_date ?? '';
          return `<label class="tools-list-row" style="cursor:pointer"><div><strong>${esc(name)}</strong><small>${esc(id)}${last ? ' · last ' + esc(last) : ''}</small></div><input type="radio" name="metos-station" value="${esc(id)}" ${id === chosen ? 'checked' : ''}></label>`;
        })
        .join('');
      return true;
    } catch (error) {
      if (generation !== metosGeneration) return false;
      $('#metos-status').textContent = `Stations unavailable: ${error instanceof Error ? error.message : 'unknown error'}. Previously loaded data may be stale.`;
      $('#metos-sync').textContent = 'Sync failed. Retrying in 5 minutes while visible.';
      return false;
    }
  }

  function selectedStation() {
    const checked = $('input[name="metos-station"]:checked');
    if (checked) return checked.value;
    return metosStations.length ? stationId(metosStations[0]) : '';
  }

  async function connectMetos(form) {
    const data = new FormData(form);
    const publicKey = String(data.get('publicKey') ?? '').trim();
    const privateKey = String(data.get('privateKey') ?? '').trim();
    if (!publicKey || !privateKey) return toast('Both keys are required.');
    const status = $('#metos-status');
    status.hidden = false;
    status.textContent = 'Testing the keys with FieldClimate…';
    try {
      const response = await fetch('/api/metos/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey, privateKey })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? `HTTP ${response.status}`);
      form.reset();
      toast('FieldClimate connected.');
      await startMetosSync();
    } catch (error) {
      status.hidden = false;
      status.textContent = `Connection failed: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  async function disconnectMetos() {
    if (!confirm('Remove the FieldClimate keys from this machine?')) return;
    stopMetosSync();
    try {
      const response = await fetch('/api/metos/disconnect', { method: 'POST', signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      toast('Could not disconnect. Connection state has not been changed.');
      return startMetosSync();
    }
    metosStations = [];
    $('#metos-data-card').hidden = true;
    await loadMetosStatus();
    toast('Saved keys removed. Environment-configured keys, if present, require a server restart to remove.');
  }

  function renderMetosRows(data, title) {
    const card = $('#metos-data-card');
    const tbody = $('#metos-rows');
    $('#metos-data-title').textContent = title;
    const sensors = Array.isArray(data?.data) ? data.data : [];
    if (!sensors.length) {
      tbody.innerHTML = '<tr><td colspan="3">No sensor values returned.</td></tr>';
    } else {
      tbody.innerHTML = sensors
        .map((sensor) => {
          const values = sensor?.values?.aggr ?? sensor?.values?.result ?? [];
          const value = Array.isArray(values) ? values[values.length - 1] : values;
          return `<tr><td data-label="Sensor"><strong>${esc(sensor.name ?? sensor.name_original ?? 'Sensor')}</strong></td><td data-label="Value">${num(value, 2)}</td><td data-label="Unit">${esc(sensor.unit ?? '')}</td></tr>`;
        })
        .join('');
    }
    card.hidden = false;
  }

  async function loadMetosCurrent() {
    const station = selectedStation();
    if (!station) return toast('Select a station first.');
    const request = ++metosDataRequest;
    const status = $('#metos-status');
    status.hidden = false;
    status.textContent = 'Loading current station data…';
    try {
      const response = await fetch(`/api/metos/current?stationId=${encodeURIComponent(station)}`, { signal: AbortSignal.timeout(25000) });
      const payload = await response.json();
      if (request !== metosDataRequest || station !== selectedStation()) return;
      if (!response.ok) throw new Error(payload?.message ?? `HTTP ${response.status}`);
      renderMetosRows(payload.data, 'Current data · last 24 h');
      status.hidden = true;
      $('#metos-sync').textContent = `Last successful fetch: ${new Date().toLocaleTimeString()}. Sensor timestamps may be older. Auto-refresh: 5 minutes.`;
    } catch (error) {
      if (request !== metosDataRequest) return;
      status.hidden = false;
      status.textContent = `Current data unavailable: ${error instanceof Error ? error.message : 'unknown error'}`;
      $('#metos-sync').textContent = 'Sync failed. Previously loaded readings may be stale; retry in 5 minutes.';
    }
  }

  async function loadMetosForecast() {
    const station = selectedStation();
    if (!station) return toast('Select a station first.');
    const request = ++metosDataRequest;
    const status = $('#metos-status');
    status.hidden = false;
    status.textContent = 'Loading the 7-day station forecast…';
    try {
      const response = await fetch(`/api/metos/forecast?stationId=${encodeURIComponent(station)}`, { signal: AbortSignal.timeout(25000) });
      const payload = await response.json();
      if (request !== metosDataRequest || station !== selectedStation()) return;
      if (!response.ok) throw new Error(payload?.message ?? `HTTP ${response.status}`);
      renderMetosRows(payload.data, '7-day forecast · FieldClimate');
      status.hidden = true;
    } catch (error) {
      if (request !== metosDataRequest) return;
      status.hidden = false;
      status.textContent = `Forecast unavailable: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  /* ---------------- integrations ---------------- */

  const INTEGRATIONS = [
    {
      name: 'Planet Labs high-resolution imagery',
      status: 'Requires account',
      tone: 'warn',
      text: 'Planet Labs imagery is a paid subscription. The local build uses NASA GIBS MODIS imagery instead.',
      link: 'https://www.planet.com/'
    },
    {
      name: 'John Deere Operations Center',
      status: 'Requires partnership',
      tone: 'off',
      text: 'Yield data, resources and work plans need John Deere OAuth and an approved integration. Export boundaries as KML/GeoJSON in the meantime.',
      link: 'https://developer.deere.com/'
    },
    {
      name: 'BBLeap precision spraying',
      status: 'Requires partnership',
      tone: 'off',
      text: 'BBLeap LeapSpace integration is a commercial partnership. Not available in the local build.',
      link: 'https://bbleap.com/'
    },
    {
      name: 'Variable rate application (VRA)',
      status: 'Not in local build',
      tone: 'off',
      text: 'VRA maps need zone delineation, rate rules and machinery formats. The current build focuses on rotation planning and field data.',
      link: ''
    },
    {
      name: 'Strip trials',
      status: 'Not in local build',
      tone: 'off',
      text: 'Side-by-side product trials need statistical design and multi-season data. Not implemented.',
      link: ''
    },
    {
      name: 'Yield calibration',
      status: 'Not in local build',
      tone: 'off',
      text: 'Calibrating yield monitor data requires proprietary algorithms and raw machine files. The yield report accepts manual CSV data.',
      link: ''
    },
    {
      name: 'Subscription management',
      status: 'Not applicable',
      tone: 'warn',
      text: 'AGRIXON is a local-first workspace without accounts or subscriptions. There is nothing to manage.',
      link: ''
    },
    {
      name: 'Soil sampling task maps',
      status: 'Not in local build',
      tone: 'off',
      text: 'Sampling point design needs zone algorithms and lab workflows. Soil analysis upload is available in the Soil tab.',
      link: ''
    }
  ];

  function renderIntegrations() {
    const box = $('#integration-cards');
    if (!box) return;
    box.innerHTML = INTEGRATIONS.map(
      (item) => `<article class="card tools-integration-card"><span class="tools-badge ${item.tone}">${esc(item.status)}</span><h2>${esc(item.name)}</h2><p>${esc(item.text)}</p>${item.link ? `<a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">Provider documentation ↗</a>` : ''}</article>`
    ).join('');
  }

  /* ---------------- events ---------------- */

  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]');
    if (tab) {
      event.preventDefault();
      showTab(tab.dataset.tab);
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const id = action.dataset.id;
    switch (action.dataset.action) {
      case 'menu':
        document.body.classList.toggle('nav-open');
        break;
      case 'export-geojson': {
        const farm = getFarm();
        if (!farm?.fields?.length) return toast('No fields to export.');
        exportGeoJson(farm.fields);
        break;
      }
      case 'export-kml': {
        const farm = getFarm();
        if (!farm?.fields?.length) return toast('No fields to export.');
        exportKml(farm.fields);
        break;
      }
      case 'export-field-geojson': {
        const field = getFarm()?.fields.find((f) => f.id === id);
        if (field) exportGeoJson([field], `agrixon-${field.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.geojson`);
        break;
      }
      case 'export-field-kml': {
        const field = getFarm()?.fields.find((f) => f.id === id);
        if (field) exportKml([field], `agrixon-${field.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.kml`);
        break;
      }
      case 'delete-group':
        deleteGroup(id);
        break;
      case 'open-plant':
        renderPlantDetail(id);
        break;
      case 'close-plant':
        libraryCrop = null;
        $('#library-detail').hidden = true;
        break;
      case 'load-weather':
        loadWeather();
        break;
      case 'export-soil':
        exportSoil();
        break;
      case 'export-yield':
        exportYield();
        break;
      case 'load-ndvi':
        loadNdvi();
        break;
      case 'sensors-refresh':
        loadSensors();
        break;
      case 'sensors-test':
        sendTestReading();
        break;
      case 'telegram-test':
        sendTelegramTest();
        break;
      case 'metos-refresh':
        startMetosSync();
        break;
      case 'metos-disconnect':
        disconnectMetos();
        break;
      case 'metos-current':
        loadMetosCurrent();
        break;
      case 'metos-forecast':
        loadMetosForecast();
        break;
      default:
        break;
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.name === 'metos-station') {
      $('#metos-data-card').hidden = true;
      loadMetosCurrent();
    }
    const select = event.target.closest('[data-action="assign-group"]');
    if (select) assignGroup(select.dataset.id, select.value);
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'field-filter') renderFields();
    if (event.target.id === 'library-search') renderLibrary();
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'sensor-filter') renderSensorRows();
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'round-form') {
      event.preventDefault();
      addRoundField(event.target);
    }
    if (event.target.id === 'group-form') {
      event.preventDefault();
      addGroup(event.target);
    }
    if (event.target.id === 'metos-form') {
      event.preventDefault();
      connectMetos(event.target);
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'soil-file' && event.target.files?.[0]) {
      importSoil(event.target.files[0]).catch((error) => toast(error instanceof Error ? error.message : 'Import failed.'));
      event.target.value = '';
    }
    if (event.target.id === 'yield-file' && event.target.files?.[0]) {
      importYield(event.target.files[0]).catch((error) => toast(error instanceof Error ? error.message : 'Import failed.'));
      event.target.value = '';
    }
  });

  /* ---------------- boot ---------------- */

  renderFields();
  renderLibrary();
  renderSoil();
  renderYield();
  renderIntegrations();
  renderWeatherFields();
  renderNdviFields();
  syncWorkspaceSnapshot();
  showTab('fields');
})();
