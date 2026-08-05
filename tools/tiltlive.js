#!/usr/bin/env node
/**
 * Does axial tilt take effect without a restart?
 *
 *   node tools/tiltlive.js
 *
 * Everything the axis touches is derived: POLE, the sun's basis, the daily spin
 * matrix and the ring's geometry. The terrain is not — the six noise octaves
 * are built from the seed and know nothing about the axis — which is the whole
 * reason this can be live at all.
 *
 * The ring is the one thing that has to be MADE again rather than read again:
 * it lies in the equatorial plane and is built once in world coordinates, so
 * leaning the axis moves the plane its vertices sit in. If that is missed, the
 * world leans and its ring stays where it was.
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const PAGE = path.resolve(ROOT, 'index.html').split(path.sep).join('/');
const GL_ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
                 '--ignore-gpu-blocklist','--enable-webgl'];
let bad = 0;
const ok = m => console.log('  \x1b[32mok\x1b[0m   ' + m);
const no = m => { bad++; console.log('  \x1b[31mFAIL\x1b[0m ' + m); };

(async () => {
  const browser = await chromium.launch({ args: GL_ARGS });
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  page.setDefaultTimeout(5 * 60 * 1000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await page.goto('file://' + PAGE + '#seed=31337');
  await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0, { timeout: 240000 });
  await page.waitForFunction(() => { const s = document.getElementById('splash');
                                     return !s || s.classList.contains('gone'); });

  const card = await page.evaluate(() => {
    const row = document.querySelector('#setlist .card[data-key="tilt"]');
    return { exists: !!row, restartNote: !!(row && row.querySelector('.setnote')),
             pinnable: !!(row && row.querySelector('.pin')) };
  });
  await page.click('#gear');
  const shape = await page.evaluate(() => {
    const row = document.querySelector('#setlist .card[data-key="tilt"]');
    return { restartNote: !!row.querySelector('.setnote'), pinnable: !!row.querySelector('.pin') };
  });
  check(!shape.restartNote, 'tilt no longer says it needs a restart');
  check(shape.pinnable, 'and can therefore be pinned to the world view');

  /* drag it and watch the axis, the sun and the ring all follow */
  const before = await page.evaluate(() => ({
    pole: Array.from(window.__world.pole()), sun: window.__world.sunDir(),
    ring: window.__world.ringPoint(), tilt: window.__world.params().tilt,
  }));
  await page.evaluate(() => {
    const sr = document.querySelector('#setlist .card[data-key="tilt"] .srange');
    const t = sr.querySelector('.strack').getBoundingClientRect();
    const b = sr.getBoundingClientRect(), y = b.top + b.height / 2;
    const ev = (k, x) => new PointerEvent(k, { pointerId: 5, clientX: x, clientY: y,
                                               bubbles: true, cancelable: true });
    sr.dispatchEvent(ev('pointerdown', t.left + t.width * 0.85));
    sr.dispatchEvent(ev('pointerup',   t.left + t.width * 0.85));
  });
  /* SUN is recomputed in the frame loop, not on assignment, so give it a frame
     before asking — otherwise this reads the value from before the lean and
     calls a working thing broken */
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    pole: Array.from(window.__world.pole()), sun: window.__world.sunDir(),
    ring: window.__world.ringPoint(), tilt: window.__world.params().tilt,
  }));
  const moved = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
  check(after.tilt > before.tilt + 20, `the slider moved it: ${before.tilt}° -> ${after.tilt}°`);
  check(moved(before.pole, after.pole) > 0.1,
    `the axis leaned with no restart (moved ${moved(before.pole, after.pole).toFixed(3)})`);
  check(moved(before.sun, after.sun) > 1e-4,
    `the sun's basis followed it (moved ${moved(before.sun, after.sun).toFixed(4)})`);
  check(moved(before.ring, after.ring) > 0.1,
    `the ring's geometry was rebuilt (a vertex moved ${moved(before.ring, after.ring).toFixed(3)})`);
  check(errs.length === 0, 'no console errors' + (errs[0] ? ': ' + errs[0] : ''));
  await browser.close();
  console.log();
  if (bad) { console.log(`\x1b[31m${bad} check(s) failed\x1b[0m`); process.exit(1); }
  console.log('\x1b[32mThe axis leans while the world runs\x1b[0m');
})().catch(e => { console.error(e); process.exit(1); });

function check(c, m) { c ? ok(m) : no(m); }
