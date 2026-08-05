#!/usr/bin/env node
/**
 * Photograph every framing the tour can fly to.
 *
 *   node tools/tourshots.js [--out docs/img/tour] [--hash '#seed=31337']
 *
 * verify.js cannot see a composition. The tour is ten framings chosen for what
 * they look like and nothing else, so each one is flown to and looked at — and
 * the ones that need time to say anything (a terminator arriving, a ring
 * opening) get a second frame taken a while later, because a still cannot tell
 * a shot that is drifting from one that is stuck.
 *
 * It also reports the disc's place in each frame, which is the one thing a
 * still image will not tell you at a glance: whether the planet is centred,
 * off to one side, or — for the tangent shot, deliberately — mostly below the
 * bottom of the picture with the horizon across the middle.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n);
                        return i === -1 ? d : process.argv[i + 1]; };
const PAGE = path.resolve(ROOT, 'index.html').split(path.sep).join('/');
const OUT = path.resolve(arg('out', path.join(ROOT, 'docs', 'img', 'tour')));
const HASH = arg('hash', '#seed=31337');
/* long enough that the planet has plants on it — the framings that look for
   somewhere lively have nothing to find on a bare world */
const WARM = +arg('warm', 2500);
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist', '--enable-webgl'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: GL });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(10 * 60 * 1000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await page.goto('file://' + PAGE + HASH);
  await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
    { timeout: 240000 });
  await page.waitForFunction(() => { const s = document.getElementById('splash');
                                     return !s || s.classList.contains('gone'); });
  await page.evaluate(n => window.__world.runWorld(n), WARM);
  const pop = await page.evaluate(() => {
    const p = window.__world.plants();
    return { live: p.live, bodies: p.bodies, largest: p.largestBody };
  });
  console.log(`warmed ${WARM} ticks: ${pop.live} living nodes in ${pop.bodies} bodies, ` +
              `largest ${pop.largest}\n`);

  const shots = await page.evaluate(() => window.__world.tour().shots);
  for (const name of shots) {
    const ok = await page.evaluate(n => window.__world.tourGo(n), name);
    if (!ok) { console.log(`  ?? no such shot: ${name}`); continue; }
    /* Frames, not milliseconds. Software rendering under load manages about one
       frame every few seconds, and a fixed wait is then a wait for nothing —
       the camera is driven from the frame loop, so what has to elapse is
       frames. Two of them, because the first is the one the change lands on. */
    await page.evaluate(() => new Promise(r =>
      requestAnimationFrame(() => requestAnimationFrame(r))));
    const file = name.replace(/[^a-z]+/gi, '-').replace(/^-|-$/g, '');
    await page.screenshot({ path: path.join(OUT, file + '.png') });
    const a = await page.evaluate(() => window.__world.tour());
    /* And again after a while, for the ones whose whole point is that something
       is arriving — a still cannot tell a shot that is drifting from one that
       is stuck. Measured in the world's own clock rather than in seconds, so
       the gap is the same amount of PLANET however slowly the frames come. */
    const spun = await page.evaluate(async () => {
      const t0 = performance.now();
      /* six seconds as the camera counts them — the tour's own dwell clock,
         which only advances on the frames it actually gets */
      while (performance.now() - t0 < 25000 && window.__world.tour().held < 6)
        await new Promise(r => requestAnimationFrame(r));
      return window.__world.tour().held;
    });
    await page.screenshot({ path: path.join(OUT, file + '-later.png') });
    const b = await page.evaluate(() => window.__world.tour());
    const moved = Math.hypot(...a.eye.map((v, i) => v - b.eye[i]));
    const off = Math.hypot(...a.aim);
    console.log(`${name.padEnd(30)} zoom ${a.zoom.toFixed(3)} dist ${a.dist.toFixed(2)}  ` +
      `aim ${off < 1e-4 ? 'centre' : 'off by ' + off.toFixed(2)}  ` +
      `ride ${a.rate}  eye moved ${moved.toFixed(4)} over ${spun.toFixed(1)}s of dwell`);
  }
  console.log(errs.length ? '\nERRORS: ' + errs.join('\n        ') : '\nno console errors');
  await browser.close();
  console.log('wrote ' + path.relative(ROOT, OUT));
})().catch(e => { console.error(e); process.exit(1); });
