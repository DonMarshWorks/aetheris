#!/usr/bin/env node
/**
 * Would an energy budget compound?
 *
 *   node tools/income.js [--ticks 45000] [--seeds 7,31337,424242,999]
 *
 * Growth attempts are drawn today by sampling the frontier, so a body's growth
 * goes as its number of tips. For a compact body that is a perimeter — it grows
 * as r while the area grows as r squared — so growth per unit area falls as 1/r
 * and the rule is self-limiting. That is not an accident: `plants-design.md`
 * records a global-frontier allocation that made a lineage's growth compound on
 * whatever it already held, and 0.85 sr of perfectly good shelf sat 93% empty
 * because the opening lottery had decided the shares.
 *
 * An energy budget fed by leaves would instead make growth go as the LEAVES.
 * Whether that is the same rule wearing different clothes or the compounding
 * one all over again depends on how a body's living node count scales against
 * its frontier — and since dead wood does not photosynthesise and a body
 * hollows out from the centre, the living part may already be an annulus. This
 * measures it instead of assuming it.
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
const TICKS = +arg('ticks', 45000);
const SEEDS = arg('seeds', '7,31337,424242,999').split(',');

(async () => {
  const browser = await chromium.launch({ args: GL_ARGS });
  const acc = new Map();
  for (const seed of SEEDS) {
    const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
    page.setDefaultTimeout(30 * 60 * 1000);
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      let n = 0;
      window.requestAnimationFrame = cb => (n++ === 0 ? raf(cb) : 0);
    });
    await page.goto('file://' + PAGE + '#seed=' + seed);
    await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
      { timeout: 240000 });
    const eco = await page.evaluate(() => window.__world.params().ecorate);
    let left = Math.round(TICKS / eco);
    while (left > 0) {
      const chunk = Math.min(left, 400);
      await page.evaluate(([n, e]) => window.__world.runWorld(n, 100, e), [chunk, eco]);
      left -= chunk;
    }
    const r = await page.evaluate(() => window.__world.bodyIncome(8));
    for (const b of r.bands) {
      const a = acc.get(b.band) || { band: b.band, bodies: 0, live: 0, front: 0, wood: 0, n: 0 };
      a.bodies += b.bodies; a.live += b.meanLive; a.front += b.meanFront;
      a.wood += b.meanWood; a.n++;
      acc.set(b.band, a);
    }
    console.log(`seed ${seed}: ${r.bodies} bodies of 8 or more`);
    await page.close();
  }
  await browser.close();

  console.log('\n  body size    bodies   living   frontier   wood   frontier/living');
  const rows = [...acc.values()];
  for (const a of rows)
    console.log(`  ${a.band.padStart(9)} ${String(a.bodies).padStart(9)} ` +
      `${(a.live / a.n).toFixed(1).padStart(8)} ${(a.front / a.n).toFixed(1).padStart(10)} ` +
      `${(a.wood / a.n).toFixed(1).padStart(6)} ${(a.front / a.live).toFixed(3).padStart(17)}`);

  /* If frontier/living is flat across the bands, an income proportional to
     living nodes IS today's rule up to a constant and energy budgeting changes
     nothing about who wins. If it falls with size, income from leaves gives big
     bodies proportionally more than the frontier rule does, and the difference
     between the smallest and largest band is the size of the compounding. */
  const first = rows[0], last = rows[rows.length - 1];
  const r0 = first.front / first.live, r1 = last.front / last.live;
  console.log(`\n  frontier/living ${r0.toFixed(3)} at ${first.band} nodes, ` +
    `${r1.toFixed(3)} at ${last.band} nodes  —  ratio ${(r0 / r1).toFixed(2)}x`);
  console.log(r0 / r1 < 1.5
    ? '  Flat enough: income from living nodes is close to the frontier rule, and\n' +
      '  an energy budget would not compound much harder than what runs today.'
    : `  Income from leaves would favour the largest bodies by about ${(r0 / r1).toFixed(1)}x\n` +
      '  against the frontier rule. That is the compounding the frontier rule avoids.');
})().catch(e => { console.error(e); process.exit(1); });
