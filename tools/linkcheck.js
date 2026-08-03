#!/usr/bin/env node
/**
 * Does the settings panel keep the visitor's settings in the URL?
 *
 *   node tools/linkcheck.js
 *
 * The panel's whole claim about the address bar is that seed plus parameters
 * determine a world completely, so the URL IS the saved state and a planet
 * worth keeping is a link somebody can send. That claim is only as good as
 * what writeHash() actually emits, and it emits every parameter that differs
 * from "the defaults" — so what counts as a default is load-bearing.
 *
 * Three journeys, each of which a visitor makes without thinking about it:
 * change something and reopen the panel; arrive on a link somebody sent;
 * change a restart-only setting and press restart. All three must end with
 * every setting still named in the URL and in the copy field.
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'index.html');
const GL_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl',
];

let failures = 0;
const pass = m => console.log('  \x1b[32mok\x1b[0m   ' + m);
const fail = m => { failures++; console.log('  \x1b[31mFAIL\x1b[0m ' + m); };
const check = (c, m) => c ? pass(m) : fail(m);

/* what the URL and the copy field say, and whether they agree */
const linkState = page => page.evaluate(() => ({
  hash: location.hash,
  field: document.getElementById('setlink').value,
}));

const has = (s, k, v) => new RegExp('[#&]' + k + '=' + String(v).replace('.', '\\.') + '(&|$)').test(s);

async function open(browser, hash) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.setDefaultTimeout(5 * 60 * 1000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await page.goto('file://' + PAGE + hash);
  await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
    { timeout: 180000 });
  page.__errs = errs;
  return page;
}

/* Drive the real control with a real drag rather than assigning into PARAMS,
   because the thing under test is the panel's own write path and assigning
   would skip all of it. */
async function setSlider(page, key, value) {
  const at = await page.evaluate(([nm, v]) => {
    /* by parameter, never by label: the copy is edited often and has nothing
       to do with whether the control works */
    const row = document.querySelector('#setlist .card[data-key="' + nm + '"]');
    if (!row) throw new Error('no control for ' + nm);
    row.scrollIntoView({ block: 'center' });
    const sr = row.querySelector('.srange');
    const box = sr.getBoundingClientRect();
    const rail = sr.querySelector('.strack').getBoundingClientRect();
    const lo = +sr.getAttribute('aria-valuemin'), hi = +sr.getAttribute('aria-valuemax');
    return { x: rail.left + ((v - lo) / (hi - lo)) * rail.width, y: box.top + box.height / 2 };
  }, [key, value]);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x, at.y);
  await page.mouse.up();
}

(async () => {
  const browser = await chromium.launch({ args: GL_ARGS });

  /* ---- 1. change things, close the panel, reopen it ---- */
  console.log('\n\x1b[1mJourney 1 — change settings, close, reopen\x1b[0m');
  {
    /* both live settings on purpose: touching a restart-only one is supposed
       to take the close button away, and journey 3 tests that path */
    const page = await open(browser, '#seed=31337');
    await page.click('#gear');
    await setSlider(page, 'tgtocean', 0.80);
    await setSlider(page, 'minfrag', 30);
    const afterEdit = await linkState(page);
    await page.click('#setclose');
    await page.click('#gear');
    const afterReopen = await linkState(page);
    check(has(afterEdit.hash, 'tgtocean', 0.8) && has(afterEdit.hash, 'minfrag', 30),
      `the edit reaches the URL: ${afterEdit.hash}`);
    check(has(afterReopen.hash, 'tgtocean', 0.8) && has(afterReopen.hash, 'minfrag', 30),
      `and survives closing and reopening: ${afterReopen.hash}`);
    check(afterReopen.field.endsWith(afterReopen.hash),
      'the copy field agrees with the address bar');
    check(page.__errs.length === 0, 'no console errors' + (page.__errs[0] || ''));
    await page.close();
  }

  /* ---- 2. arrive on a link somebody sent ---- */
  console.log('\n\x1b[1mJourney 2 — arrive on a shared link, then open the panel\x1b[0m');
  {
    const sent = '#seed=31337&tgtocean=0.8&kids=6&spore=0.02';
    const page = await open(browser, sent);
    const before = await linkState(page);
    await page.click('#gear');
    const after = await linkState(page);
    check(before.hash === sent, `the link arrives intact: ${before.hash}`);
    check(has(after.hash, 'tgtocean', 0.8) && has(after.hash, 'kids', 6) && has(after.hash, 'spore', 0.02),
      `opening the panel keeps the settings that arrived: ${after.hash}`);
    check(after.field.includes('tgtocean=0.8'),
      `the copy field offers the same world: ${after.field.slice(-70)}`);
    check(page.__errs.length === 0, 'no console errors' + (page.__errs[0] || ''));
    await page.close();
  }

  /* ---- 3. change a restart-only setting and restart ---- */
  console.log('\n\x1b[1mJourney 3 — change a restart-only setting, press restart\x1b[0m');
  {
    const page = await open(browser, '#seed=31337');
    await page.click('#gear');
    await setSlider(page, 'tgtocean', 0.80);     // live
    await setSlider(page, 'relief', 2.0);         // restart-only
    const armed = await page.evaluate(() => ({
      restart: getComputedStyle(document.getElementById('setrestart')).display !== 'none',
      cancel: getComputedStyle(document.getElementById('setcancel')).display !== 'none',
      close: getComputedStyle(document.getElementById('setclose')).display !== 'none',
    }));
    check(armed.restart && armed.cancel && !armed.close,
      'touching a restart-only setting leaves only restart or cancel');
    await Promise.all([
      page.waitForFunction(() => !window.__world, { timeout: 60000 }).catch(() => {}),
      page.click('#setrestart'),
    ]);
    await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
      { timeout: 180000 });
    const reloaded = await linkState(page);
    check(has(reloaded.hash, 'relief', 2) && has(reloaded.hash, 'tgtocean', 0.8),
      `the restart carries both settings: ${reloaded.hash}`);
    const applied = await page.evaluate(() => {
      const p = window.__world.params();
      return { relief: p.relief, tgtocean: p.tgtocean };
    });
    check(applied.relief === 2 && applied.tgtocean === 0.8,
      `and the restarted world is actually built with them: ${JSON.stringify(applied)}`);
    await page.click('#gear');
    const afterReopen = await linkState(page);
    check(has(afterReopen.hash, 'relief', 2) && has(afterReopen.hash, 'tgtocean', 0.8),
      `and reopening the panel does not throw them away: ${afterReopen.hash}`);
    await page.close();
  }

  /* ---- 4. reset means the piece's defaults, not this page's ---- */
  console.log('\n\x1b[1mJourney 4 — "reset" from a world that arrived with settings\x1b[0m');
  {
    const page = await open(browser, '#seed=31337&tgtocean=0.8&kids=6');
    await page.click('#gear');
    await page.click('#setreset');
    const after = await page.evaluate(() => {
      const p = window.__world.params();
      return { hash: location.hash, tgtocean: p.tgtocean, kids: p.kids };
    });
    check(after.tgtocean === 0.635 && after.kids === 8,
      `reset restores what the piece ships with, not what this page booted with ` +
      `(ocean ${after.tgtocean}, kids ${after.kids})`);
    check(after.hash === '#seed=31337', `and the URL says so: ${after.hash}`);
    await page.close();
  }

  /* ---- 5. every slider writes a number a human would write ---- */
  console.log('\n\x1b[1mJourney 5 — drive every slider; the URL must stay legible\x1b[0m');
  {
    const page = await open(browser, '#seed=31337');
    await page.click('#gear');
    /* Reversed controls mirror the value by subtracting it from min+max, which
       is where float noise enters: a quantised slider position comes back as
       0.08999999999999997 and no longer equals the default it started on, so
       the URL fills with settings nobody changed. Drive every knob and read
       what the address bar says. */
    const names = await page.evaluate(() =>
      [...document.querySelectorAll('#setlist .card .srange')]
        .map(sr => sr.closest('.card').dataset.key));
    for (const s of names)
      for (const f of [0.5, 0.34, 0.72]) {
        const at = await page.evaluate(([nm, ff]) => {
          const row = document.querySelector('#setlist .card[data-key="' + nm + '"]');
          row.scrollIntoView({ block: 'center' });
          const sr = row.querySelector('.srange');
          const b = sr.getBoundingClientRect(), t = sr.querySelector('.strack').getBoundingClientRect();
          return { x: t.left + ff * t.width, y: b.top + b.height / 2 };
        }, [s, f]);
        await page.mouse.move(at.x, at.y);
        await page.mouse.down(); await page.mouse.move(at.x, at.y); await page.mouse.up();
      }
    const hash = await page.evaluate(() => location.hash);
    const ugly = hash.slice(1).split('&')
      .filter(p => /\d\.\d{5,}/.test(p) || /e-?\d+$/.test(p));
    check(ugly.length === 0,
      ugly.length ? `float noise in the URL: ${ugly.join(', ')}`
                  : `${names.length} sliders driven, every value legible: ${hash}`);
    check(page.__errs.length === 0, 'no console errors' + (page.__errs[0] || ''));
    await page.close();
  }

  await browser.close();
  console.log();
  if (failures) { console.log(`\x1b[31m${failures} check(s) failed\x1b[0m`); process.exit(1); }
  console.log('\x1b[32mAll checks passed\x1b[0m');
})().catch(e => { console.error(e); process.exit(1); });
