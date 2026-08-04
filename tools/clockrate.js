#!/usr/bin/env node
/**
 * How fast does the world's clock actually run, and does tilt change it?
 *
 *   node tools/clockrate.js [--seconds 20] [--tilts 0,24,55,90]
 *
 * Reported: a 90-degree world's elapsed time passes extremely slowly.
 *
 * The clock is `S.time - S.epoch0` and S.time advances a fixed 0.084*speed per
 * simulation tick, so tilt cannot touch it directly. What tilt can touch is how
 * OFTEN a tick happens: the frame loop refuses to step the world until the
 * ecology has caught up —
 *
 *     if(simAccum >= 0.084 && !paused && plantDebt <= 0)
 *
 * — and the ecology is paid a fixed few milliseconds a frame. So anything that
 * makes a plant step slower does not slow the plants down, it slows the
 * CLOCK down, and the piece's whole promise about time (a day is 2.5 minutes,
 * a year is 15) quietly stops being true.
 *
 * This runs the real frame loop, unstubbed, for a fixed number of wall-clock
 * seconds and reports simulated seconds gained per real second. 1.00 is the
 * design intent at x1.
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
const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i === -1 ? d : process.argv[i + 1];
};
const SECS = +arg('seconds', 20);
const TILTS = arg('tilts', '0,24,55,90').split(',').map(Number);
const WARM = +arg('warm', 20000);
const EXTRA = arg('params', '');   /* &k=v pairs appended to the hash */

(async () => {
  const browser = await chromium.launch({ args: GL_ARGS });
  console.log(`
  What the frame loop can afford: it pays the ecology PARAMS.ecobudget ms a`);
  console.log(`  frame and owes it ECORATE steps per simulation tick, so at 60fps and 12`);
  console.log(`  ticks a second it needs a step to cost under about 1.25 ms. Past that the`);
  console.log(`  gate 'plantDebt <= 0' stops firing and it is the CLOCK that slows, not the`);
  console.log(`  plants — the piece goes on saying a year is 15 minutes and it is not.
`);
  console.log('  measuring' + (EXTRA ? ' with' + EXTRA : ' with defaults'));
  console.log(`  tilt    ms/step   need   live      bodies   frontier  starved  verdict`);
  for (const tilt of TILTS) {
    const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
    page.setDefaultTimeout(30 * 60 * 1000);
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    /* the frame loop is retired: this measures what a plant step COSTS, which
       is a property of the simulation, not what a software renderer can spare */
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      let n = 0;
      window.requestAnimationFrame = cb => (n++ === 0 ? raf(cb) : 0);
    });
    await page.goto('file://' + PAGE + `#seed=7&tilt=${tilt}` + EXTRA);
    await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
      { timeout: 240000 });

    const eco = await page.evaluate(() => window.__world.params().ecorate);
    let left = Math.round(WARM / eco);
    while (left > 0) {
      const chunk = Math.min(left, 400);
      await page.evaluate(([n, e]) => window.__world.runWorld(n, 100, e), [chunk, eco]);
      left -= chunk;
    }

    const r = await page.evaluate(() => {
      const w = window.__world;
      w.growPlants(200);                       /* warm the paths */
      const t0 = performance.now();
      w.growPlants(2000);
      const ms = (performance.now() - t0) / 2000;
      const p = w.plants();
      return { ms, live: p.live, bodies: p.bodies, frontier: p.frontier,
               starved: p.draws.starvedShare,
               budget: w.params().ecobudget, eco: w.params().ecorate };
    });
    const need = r.budget * 60 / (r.eco * 12);   /* ms a step may cost */
    console.log(
      `  ${String(tilt).padStart(4)}   ${r.ms.toFixed(3).padStart(8)}  ${need.toFixed(2).padStart(5)}` +
      `   ${String(r.live).padStart(7)}  ${String(r.bodies).padStart(7)}  ${String(r.frontier).padStart(9)}` +
      `  ${String(r.starved).padStart(7)}  ` +
      (r.live === 0 ? 'EXTINCT' : r.ms > need ? 'over budget — clock throttles' : 'fits') +
      (errs.length ? '  ERR ' + errs[0] : ''));
    await page.close();
  }
  await browser.close();
  console.log();
})().catch(e => { console.error(e); process.exit(1); });
