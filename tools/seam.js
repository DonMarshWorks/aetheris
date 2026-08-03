#!/usr/bin/env node
/**
 * Does a plant change appearance on the frame it dies?
 *
 *   node tools/seam.js [--ticks 20000] [--steps 40]
 *
 * Three separate flashes shipped before anyone measured this — the lift young
 * tips are given, the heartwood drain, the selection red — each found by eye,
 * days apart, and each the same mistake: the dying path recomputing a node's
 * appearance instead of continuing it. `nodePaint()` now exists so there is
 * only one definition, and this asserts that the seam is actually closed
 * rather than trusting that it is.
 *
 * For every node that dies in an ecology step, the last thing it was drawn as
 * is compared against the first thing its ghost is drawn as. Leaf and stem
 * separately, because a stem is drawn by the child in the child's colour and
 * has its own ways of going wrong — including simply not being carried over,
 * which no colour comparison can see.
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
const STEPS = +arg('steps', 40);

let failures = 0;
const pass = m => console.log('  \x1b[32mok\x1b[0m   ' + m);
const fail = m => { failures++; console.log('  \x1b[31mFAIL\x1b[0m ' + m); };

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
    { timeout: 240000 });

  const eco = await page.evaluate(() => window.__world.params().ecorate);
  let left = Math.round(TICKS / eco);
  while (left > 0) {
    const chunk = Math.min(left, 400);
    await page.evaluate(([n, e]) => window.__world.runWorld(n, 100, e), [chunk, eco]);
    left -= chunk;
  }

  const tot = await page.evaluate(n => {
    const out = { deaths: 0, worstLeaf: 0, worstStem: 0, dropped: 0, leafAt: '', stemAt: '', why: {}, reused: 0 };
    for (let k = 0; k < n; k++) {
      const r = window.__world.seam();
      out.deaths += r.deathsChecked;
      out.dropped += r.stemsDropped;
      out.reused += r.slotReused;
      for(const k2 in r.dropWhy){ out.why[k2]=(out.why[k2]||0)+r.dropWhy[k2]; }
      if (r.worstLeaf > out.worstLeaf) { out.worstLeaf = r.worstLeaf; out.leafAt = r.leafAt; }
      if (r.worstStem > out.worstStem) { out.worstStem = r.worstStem; out.stemAt = r.stemAt; }
    }
    return out;
  }, STEPS);

  console.log(`\n${tot.deaths.toLocaleString()} deaths checked over ${STEPS} ecology steps\n`);
  /* One ecology tick separates the two readings, so every ramp legitimately
     moves by one tick's worth between them and the tolerance has to allow it.
     The fastest is the rot fade at 2/FADE of full cover per tick — about 0.031
     on a 0..1 channel. Anything past that is a step rather than a slope, which
     is the thing being looked for. */
  const TOL = 0.035;
  if (tot.worstLeaf <= TOL) pass(`leaf is continuous through death (worst ${tot.worstLeaf})`);
  else fail(`leaf jumps on death by ${tot.worstLeaf} — ${tot.leafAt}`);
  if (tot.worstStem <= TOL) pass(`stem is continuous through death (worst ${tot.worstStem})`);
  else fail(`stem jumps on death by ${tot.worstStem} — ${tot.stemAt}`);
  if (tot.dropped === 0) pass('every stem that existed alive is carried into the ghost');
  else fail(`${tot.dropped} of ${tot.deaths} deaths lost their stem outright — ` +
            `it vanishes in one frame while the leaf fades — ${JSON.stringify(tot.why)}`);

  await browser.close();
  console.log();
  if (failures) { console.log(`\x1b[31m${failures} check(s) failed\x1b[0m`); process.exit(1); }
  console.log('\x1b[32mThe seam is closed\x1b[0m');
})().catch(e => { console.error(e); process.exit(1); });
