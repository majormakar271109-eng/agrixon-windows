import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEM_MAX_ZOOM,
  pickZoom,
  stageName,
  gddBetween,
  synthDaily,
  plantHeight
} from './public/field-model.js';

test('pickZoom never asks the DEM proxy for z15', () => {
  const tiny = [67.2437, 47.9798, 67.2447, 47.9808];
  assert.equal(pickZoom(tiny), DEM_MAX_ZOOM);
  assert.ok(pickZoom(tiny) <= 14);
});

test('pickZoom stays inside the supported 10..14 range for a large bbox', () => {
  const wide = [60, 40, 80, 55];
  const z = pickZoom(wide);
  assert.ok(z >= 10 && z <= 14, `unexpected zoom ${z}`);
});

test('stageName follows the GDD fraction boundaries', () => {
  assert.equal(stageName(0), 'Sowing');
  assert.equal(stageName(0.05), 'Emergence');
  assert.equal(stageName(0.5), 'Heading / flowering');
  assert.equal(stageName(1), 'Maturity');
});

test('gddBetween ignores missing temperatures and dates outside the window', () => {
  const daily = [
    { date: '2026-05-01', tMax: 20, tMin: 10 },
    { date: '2026-05-02', tMax: null, tMin: 8 },
    { date: '2026-05-03', tMax: 24, tMin: 14 },
    { date: '2026-06-01', tMax: 30, tMin: 20 }
  ];
  const { gdd, days } = gddBetween(daily, '2026-05-01', '2026-05-31', 5);
  assert.equal(days, 2);
  assert.equal(gdd, 10 + 14);
});

test('plantHeight is monotonic and bounded', () => {
  let previous = -1;
  for (let f = 0; f <= 1.0001; f += 0.1) {
    const h = plantHeight(f);
    assert.ok(h >= 0 && h <= 1);
    assert.ok(h >= previous, `height dropped at ${f}`);
    previous = h;
  }
});

test('synthDaily is explicitly marked synthetic', () => {
  const series = synthDaily('2026-05-01', '2026-05-10');
  assert.equal(series.length, 10);
  assert.ok(series.every((d) => d.synthetic === true));
});
