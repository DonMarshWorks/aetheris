#!/usr/bin/env node
/**
 * What would moving plants cost?
 *
 *   node tools/motioncost.js [--ticks 20000]
 *
 * Nodes are static today, so collision is tested only where a bud is placed:
 * a handful of candidates per plant per turn, each about nine bins. If nodes
 * move, every node has to be re-binned and re-tested against its neighbours
 * every turn, and the work stops scaling with the number of plants and starts
 * scaling with the number of nodes.
 *
 * That is a factor nobody should estimate. `overlapScan()` already does exactly
 * the pass in question — every seventh living node, the full 27-bin
 * neighbourhood, real distance tests — so timing it and multiplying by seven
 * gives the cost of one full collision pass over the living population, on this
 * machine, at a realistic population. Against the ecology's actual rate that is
 * the answer.
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
const TICKS = +arg('ticks', 20000);

(async () => {
  const browser = await chromium.launch({ args: GL_ARGS });
  const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
  page.setDefaultTimeout(30 * 60 * 1000);
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    let n = 0;
    window.requestAnimationFrame = cb => (n++ === 0 ? raf(cb) : 0);
  });
  await page.goto('file://' + PAGE + '#seed=31337');
  await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
    { timeout: 180000 });

  const eco = await page.evaluate(() => window.__world.params().ecorate);
  let left = Math.round(TICKS / eco);
  while (left > 0) {
    const chunk = Math.min(left, 400);
    await page.evaluate(([n, e]) => window.__world.runWorld(n, 100, e), [chunk, eco]);
    left -= chunk;
  }

  const r = await page.evaluate(() => {
    const w = window.__world;
    /* one warm pass so the timing is not measuring the first touch of the bins */
    w.overlapScan();
    const t0 = performance.now();
    const reps = 5;
    let sampled = 0, live = 0;
    for (let i = 0; i < reps; i++) { const s = w.overlapScan(); sampled = s.sampled; live = s.live; }
    const per = (performance.now() - t0) / reps;
    const p = w.plants();
    return { per, sampled, live, bodies: p.bodies, ecorate: w.params().ecorate };
  });

  /* overlapScan tests every seventh node; a move pass would test all of them,
     and would also have to re-bin each one — a store plus a remove, cheap
     against the neighbourhood walk but not free, so this is a floor. */
  const full = r.per * (r.live / r.sampled);
  /* the frame loop accrues ECORATE ecology steps per climate tick and steps the
     climate about twelve times a second */
  const perSecond = full * r.ecorate * 12;

  console.log(`\npopulation ${r.live.toLocaleString()} living nodes in ${r.bodies.toLocaleString()} bodies`);
  console.log(`one 27-bin neighbourhood pass over 1/7 of them: ${r.per.toFixed(1)} ms`);
  console.log(`extrapolated to every living node:               ${full.toFixed(0)} ms`);
  console.log(`\nthe ecology runs ${r.ecorate} steps per climate tick and the climate steps ~12x/s,`);
  console.log(`so moving every node every step would cost ${(perSecond / 1000).toFixed(1)} s of CPU per second.`);
  console.log(`That is ${(perSecond / 1000).toFixed(0)}x the entire machine, before anything is drawn.`);
  const budget = await page.evaluate(() => window.__world.params().ecoshare*1000/60);
  console.log(`\nThe ecology's whole per-frame budget is ${budget} ms. One full pass is ` +
    `${(full / budget).toFixed(0)}x that.`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
