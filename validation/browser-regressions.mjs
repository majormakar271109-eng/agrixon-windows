// Run with playwright_browser_run_code_unsafe filename pointing to this file.
// All data and requests below are isolated fixtures; no farm or keys are changed.
async (page) => {
  const context = await page.context().browser().newContext();
  const p = await context.newPage();
  const results = [];
  let currentRequests = 0;
  try {
    await p.clock.install();
    await p.route('**/api/metos/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data;
      if (path.endsWith('/status')) data = { configured: true };
      else if (path.endsWith('/stations')) data = { data: [{ uid: 'fixture-station', name: { custom: 'Fixture station' } }] };
      else {
        currentRequests++;
        data = { data: { data: [{ name: 'Temperature', unit: '°C', values: { aggr: [null] } }] } };
      }
      await route.fulfill({ json: data });
    });
    await p.route('**/api/workspace/snapshot', route => route.fulfill({ json: { ok: true } }));
    await p.goto('http://localhost:3000/tools');
    await p.waitForLoadState('load');
    results.push({ name: 'one redesign stylesheet', pass: await p.locator('link[href*="redesign.css"]').count() === 1 });
    await p.locator('[data-nav-more-button]').click();
    results.push({ name: 'More opens with one click', pass: await p.locator('[data-nav-more]').evaluate(el => el.classList.contains('open')) });
    await p.keyboard.press('Escape');
    await p.locator('[data-tab="metos"]').click();
    await p.locator('input[name="metos-station"]').waitFor();
    // Drain asynchronous responses without advancing the virtual interval clock.
    for (let i = 0; i < 10; i++) await p.evaluate(() => new Promise(r => setTimeout(r, 0)));
    results.push({ name: 'METOS current loads automatically', pass: currentRequests > 0 });
    results.push({ name: 'missing METOS reading is not zero', pass: (await p.locator('#metos-rows').innerText()).includes('—') });
    const before = currentRequests;
    await p.clock.runFor(300001);
    for (let i = 0; i < 10; i++) await p.evaluate(() => new Promise(r => setTimeout(r, 0)));
    results.push({ name: 'METOS refreshes after five minutes', pass: currentRequests > before });
    await p.locator('[data-tab="fields"]').click();
    const paused = currentRequests;
    await p.clock.runFor(300001);
    results.push({ name: 'METOS pauses outside its tab', pass: currentRequests === paused });

    await p.route('**/api/dem/**', () => {});
    await p.route('**/api/nasa/gibs/tile/**', () => {});
    await p.evaluate(async () => {
      const { open } = await import('/field3d.js');
      void open({ field: { name: 'Fixture', areaHa: 1, geometry: { coordinates: [[[67,48],[67.001,48],[67.001,48.001],[67,48.001],[67,48]]] } }, crops: [], season: '2026', imageryDate: '2026-05-01' });
    });
    await p.locator('[data-f3d="close"]').click();
    results.push({ name: '3D closes while terrain is loading', pass: await p.locator('.f3d-dialog').count() === 0 });
    return results;
  } finally {
    await context.close();
  }
}
