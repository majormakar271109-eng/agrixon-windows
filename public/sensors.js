/* Sensors tab: live UNO board readings from /api/sensors/*. */
(() => {
  const $ = (id) => document.getElementById(id);
  const fmt = (value, digits = 1) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(Number(value));
  };
  const timeLabel = (ts) => new Date(ts * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const iconPaths = {
    map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z M9 3v15M15 6v15',
    grid: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18',
    calendar: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h3M8 17h3',
    shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3zM8 12l3 3 5-6',
    layers: 'M12 3L2 8l10 5 10-5-10-5zM3 12l9 5 9-5M3 16l9 5 9-5',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10 3h4l1 3 3 1 3 2v4l-3 2-1 3-3 3h-4l-1-3-3-1-3-2v-4l3-2 1-3 3-3z',
    download: 'M12 3v13M7 11l5 5 5-5M4 17v4h16v-4',
    leaf: 'M20 3C7 3 3 8 5 14c2 7 13 7 15-11zM4 21L16 9',
    crosshair: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 2v6M12 16v6M2 12h6M16 12h6',
    refresh: 'M20 5v6h-6M4 19v-6h6M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3'
  };

  function paintIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      if (el.querySelector('svg')) return;
      const path = iconPaths[el.dataset.icon] || iconPaths.layers;
      el.insertAdjacentHTML('afterbegin', `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`);
    });
  }

  let lastSample = null;
  let history = [];
  let failures = 0;

  function setStatus(kind, text) {
    $('sensor-status-dot').className = 'status-dot ' + kind;
    $('sensor-status-text').textContent = text;
  }

  function setCard(prefix, value, sub, digits = 1, warning = false) {
    $(prefix + '-value').textContent = value === null || value === undefined ? '—' : fmt(value, digits);
    $(prefix + '-sub').textContent = sub;
    $(prefix + '-value').closest('.sensor-card').classList.toggle('warning', warning);
  }

  function limitsOf(sample) {
    const l = sample.limits || {};
    return {
      tempMin: Number(l.temp_min ?? 15),
      tempMax: Number(l.temp_max ?? 30),
      humMin: Number(l.hum_min ?? 30),
      humMax: Number(l.hum_max ?? 70),
      soilMin: Number(l.soil_min ?? 20)
    };
  }

  function update(sample) {
    lastSample = sample;
    const age = Date.now() / 1000 - Number(sample.ts || 0);
    const stale = age > 10;
    setStatus(stale ? 'warning' : '', stale ? `Stale · ${Math.round(age)} s` : 'Live');
    $('sensor-updated').textContent = sample.iso ? 'Last sample ' + sample.iso.replace('T', ' ') : 'No sample yet';
    $('sensor-offline').hidden = true;

    const lim = limitsOf(sample);
    const dhtOk = Boolean(sample.dht_ok) && sample.dht_temp !== null;
    const airWarn = dhtOk && (sample.dht_temp < lim.tempMin || sample.dht_temp > lim.tempMax);
    const humWarn = sample.humidity !== null && (sample.humidity < lim.humMin || sample.humidity > lim.humMax);
    const ntcWarn = sample.ntc_temp !== null && (sample.ntc_temp < lim.tempMin || sample.ntc_temp > lim.tempMax);
    const soilWarn = sample.soil_pct !== null && sample.soil_pct < lim.soilMin;

    setCard('air-temp', dhtOk ? sample.dht_temp : null,
      dhtOk ? (airWarn ? `⚠ normal ${lim.tempMin}…${lim.tempMax}` : 'DHT11 · A1') : (sample.dht_error ? `DHT error ${sample.dht_error}` : 'Not connected'),
      1, airWarn);
    setCard('humidity', sample.humidity,
      sample.humidity === null ? 'Not connected' : (humWarn ? `⚠ normal ${lim.humMin}…${lim.humMax}` : 'DHT11 · A1'),
      1, humWarn);
    setCard('soil-temp', sample.ntc_temp,
      sample.ntc_temp === null
        ? (sample.ntc_state === 'float' ? 'Not connected' : sample.ntc_state === 'short' ? 'Shorted to GND' : 'No data')
        : (ntcWarn ? `⚠ normal ${lim.tempMin}…${lim.tempMax}` : `NTC · A4 · ADC ${sample.ntc_adc ?? '—'}`),
      1, ntcWarn);
    setCard('soil-moisture', sample.soil_pct,
      sample.soil_pct === null ? 'No data' : (soilWarn ? `⚠ normal ${lim.soilMin}…100` : `EK1940 · A0 · ADC ${sample.soil_adc ?? '—'}`),
      0, soilWarn);

    $('raw-dht-temp').textContent = dhtOk ? `${fmt(sample.dht_temp)} °C` : (sample.dht_error ? `DHT error ${sample.dht_error}` : 'Not connected');
    $('raw-humidity').textContent = sample.humidity === null ? 'Not connected' : `${fmt(sample.humidity)} %`;
    $('raw-ntc-temp').textContent = sample.ntc_temp === null ? '—' : `${fmt(sample.ntc_temp)} °C`;
    $('raw-ntc-adc').textContent = `ADC ${sample.ntc_adc ?? '—'}`;
    $('raw-soil-pct').textContent = sample.soil_pct === null ? '—' : `${fmt(sample.soil_pct, 0)} %`;
    $('raw-soil-adc').textContent = `ADC ${sample.soil_adc ?? '—'}`;
    $('raw-time').textContent = sample.iso ? sample.iso.replace('T', ' ') : '—';
    $('raw-state').textContent = sample.ntc_state || '—';

    if (!history.length || Number(sample.ts) > Number(history[history.length - 1].ts)) {
      history.push(sample);
      if (history.length > 300) history.shift();
      drawCharts();
    }
  }

  function drawChart(el, series, unit, digits) {
    const now = Date.now() / 1000;
    const windowSeconds = 600;
    const rows = history.filter((row) => Number(row.ts) >= now - windowSeconds);
    if (rows.length < 2) {
      el.innerHTML = '<div class="chart-empty">Waiting for samples…</div>';
      return;
    }
    const values = rows.flatMap((row) => series.map((s) => row[s.key]))
      .filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v)))
      .map(Number);
    if (!values.length) {
      el.innerHTML = '<div class="chart-empty">No numeric values yet.</div>';
      return;
    }
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const padY = (max - min) * 0.12;
    min -= padY;
    max += padY;

    const width = 600, height = 180;
    const pad = { top: 12, right: 12, bottom: 24, left: 38 };
    const x = (ts) => pad.left + ((Number(ts) - (now - windowSeconds)) / windowSeconds) * (width - pad.left - pad.right);
    const y = (v) => pad.top + (1 - (Number(v) - min) / (max - min)) * (height - pad.top - pad.bottom);

    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const gy = pad.top + (i / 4) * (height - pad.top - pad.bottom);
      const value = max - (i / 4) * (max - min);
      grid += `<line class="grid-line" x1="${pad.left}" y1="${gy.toFixed(1)}" x2="${width - pad.right}" y2="${gy.toFixed(1)}"/>`;
      grid += `<text class="axis-label" x="0" y="${(gy + 3).toFixed(1)}">${fmt(value, digits)}</text>`;
    }

    let paths = '';
    for (const s of series) {
      let d = '', open = false;
      for (const row of rows) {
        const v = row[s.key];
        if (v === null || v === undefined || !Number.isFinite(Number(v))) { open = false; continue; }
        d += `${open ? 'L' : 'M'}${x(row.ts).toFixed(1)},${y(v).toFixed(1)} `;
        open = true;
      }
      if (d) paths += `<path class="${s.className}" d="${d}"/>`;
    }

    const first = rows[0], last = rows[rows.length - 1];
    const labels = `<text class="axis-label" x="${pad.left}" y="${height - 4}">${timeLabel(first.ts)}</text>` +
      `<text class="axis-label" x="${width - pad.right}" y="${height - 4}" text-anchor="end">${timeLabel(last.ts)}</text>`;
    el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${unit} chart">${grid}${paths}${labels}</svg>`;
  }

  function drawCharts() {
    drawChart($('temp-chart'), [
      { key: 'dht_temp', className: 'series-air' },
      { key: 'ntc_temp', className: 'series-soil' }
    ], 'Temperature', 1);
    drawChart($('moist-chart'), [
      { key: 'humidity', className: 'series-air' },
      { key: 'soil_pct', className: 'series-soil' }
    ], 'Moisture', 0);
  }

  async function loadLatest() {
    try {
      const response = await fetch('/api/sensors/latest', { cache: 'no-store' });
      if (!response.ok) throw new Error('no data');
      const sample = await response.json();
      failures = 0;
      update(sample);
    } catch {
      failures += 1;
      if (failures >= 2) {
        setStatus('error', 'No data');
        $('sensor-offline').hidden = false;
        if (lastSample) $('sensor-updated').textContent = 'Last sample ' + String(lastSample.iso || '').replace('T', ' ');
      }
    }
  }

  async function loadHistory() {
    try {
      const response = await fetch('/api/sensors/history', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data) && data.length) {
        history = data.slice(-300);
        drawCharts();
      }
    } catch {
      /* keep the last chart */
    }
  }

  function refresh() {
    loadLatest();
    loadHistory();
  }

  paintIcons();
  $('sensor-refresh').addEventListener('click', refresh);
  refresh();
  setInterval(loadLatest, 2000);
  setInterval(loadHistory, 30000);
})();
