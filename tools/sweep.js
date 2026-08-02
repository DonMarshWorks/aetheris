#!/usr/bin/env node
/**
 * Aetheris headless parameter sweep.
 *
 *   node tools/sweep.js --plan plan.json --out results.jsonl [--jobs 12]
 *
 * A plan is { ticks, checkpoints, seeds, configs:[{tag, params:{...}}] }.
 * Every (config, seed) pair is one job; jobs run across a pool of browsers.
 *
 * Three things here are not incidental, and getting any of them wrong has
 * already voided a round of measurement on this project:
 *
 * 1. `ticks` counts ECOLOGY steps, not climate updates. runWorld(n, mult, eco)
 *    pays `eco` ecology steps per climate update, so a config with a different
 *    ecorate needs a different number of climate updates to reach the same
 *    number of generations. Comparing configs at equal *climate* updates
 *    compares populations that have lived different lengths of time.
 *
 * 2. The frame loop is stopped before anything is measured. Left running it
 *    advances the same world this script is trying to advance by a controlled
 *    amount, and it does so between evaluate() calls, so the tick count a
 *    result is labelled with is not the one it got.
 *
 * 3. Readings are taken at intervals and the cumulative counters differenced.
 *    meanFit in particular is a lifetime average, so a single reading at the
 *    end of a long run is mostly a report on the beginning of it.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'index.html');

const GL_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl',
];

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? dflt : process.argv[i + 1];
}

const hashOf = (params, seed) =>
  '#seed=' + seed + Object.entries(params).map(([k, v]) => `&${k}=${v}`).join('');

/* Everything worth keeping from one plants() reading. The full object carries
   input/output histograms that are large and mostly constant across a sweep;
   what is kept is what any score might want to ask about later. */
function distil(p) {
  return {
    tick: p.tick, live: p.live, wood: p.wood, bodies: p.bodies,
    meanBody: p.meanBody, largestBody: p.largestBody, frontier: p.frontier,
    deaths: p.deaths, ageDeaths: p.ageDeaths,
    nonFinite: p.nonFinite, badGenes: p.badGenes, badKonst: p.badKonst,
    nanFits: p.nanFits,
    strategies: p.strategies, topStrategy: p.topStrategy,
    specialisation: p.specialisation, niche: p.niche,
    meanFit: p.meanFit, fitSum: p.fitSum, fitN: p.fitN,
    meanLifeSet: p.meanLifeSet, hitFloor: p.hitFloor,
    births: p.births,
    census: p.census,
    mixedCapBodies: p.body.mixedCapBodies, bodies8: p.body.bodies8,
    twoTerrainBodies: p.body.twoTerrainBodies,
    terrainsPerBody: p.body.terrainsPerBody,
    leanGain: p.body.leanGain,
    paceWithinShare: p.body.paceWithinShare, capWithinShare: p.body.capWithinShare,
    meanPace: p.body.meanPace, meanCap: p.body.meanCap,
    fanSD: p.body.fanSD, stepSD: p.body.stepSD,
    activeMean: p.active.mean,
    geoDiff:  p.geo ? p.geo.differentiation : null,
    geoEven:  p.geo ? p.geo.withinEven : null,
    geoBoxes: p.geo ? p.geo.provinces : null,
    sigListens: p.signal ? p.signal.listens : null,
    sigSpeaks:  p.signal ? p.signal.speaks  : null,
    sigBoth:    p.signal ? p.signal.both    : null,
    sigLevel:   p.signal ? p.signal.level   : null,
    budShare: p.draws.budShare, eligibleShare: p.draws.eligibleShare,
    transferTook: p.transfer.tookShare,
    angleSpread: p.outputs.angle.spreadWithinNode,
  };
}

async function runJob(browser, job, plan) {
  const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
  page.setDefaultTimeout(30 * 60 * 1000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });

  const out = { tag: job.tag, params: job.params, seed: job.seed, checkpoints: [] };
  out.mult = job.mult !== undefined ? job.mult
           : (plan.mult !== undefined ? plan.mult : 100);
  try {
    await page.goto('file://' + PAGE + hashOf(job.params, job.seed));
    await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
      { timeout: 180000 });
    /* Stop the frame loop. It re-registers itself every call, so replacing the
       scheduler retires it after the frame in flight; nothing this script does
       needs a rendered pixel, and a running loop would advance the world by an
       amount no result records. */
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await page.waitForTimeout(60);

    const eco = job.params.ecorate !== undefined
      ? job.params.ecorate : plan.defaultEcorate;
    /* How fast the climate runs against the ecology. 100 is the time-lapse the
       piece offers and what every sweep here uses; a value near zero freezes
       the planet, which is the control arm for whether a wandering climate
       helps diversity or costs it. Note runWorld reads `mult || 1`, so a
       literal 0 would silently become 1 — hence a small positive number. */
    const mult = job.mult !== undefined ? job.mult : (plan.mult !== undefined ? plan.mult : 100);
    let done = 0;
    for (const mark of plan.checkpoints) {
      /* climate updates that owe exactly the ecology steps still wanted */
      const want = Math.round((mark - done) / eco);
      /* long stretches are split so a single evaluate() cannot outlive its
         timeout on a slow config */
      let left = want;
      while (left > 0) {
        const chunk = Math.min(left, 400);
        await page.evaluate(([n, m, e]) => window.__world.runWorld(n, m, e), [chunk, mult, eco]);
        left -= chunk;
      }
      done += want * eco;
      const p = await page.evaluate(() => {
        const s = window.__world.plants();
        /* the strategy census, which topStrategy summarises to one number and
           which a turnover measure needs in full */
        return s;
      });
      out.checkpoints.push({ want: mark, eco: done, ...distil(p) });
    }
  } catch (e) {
    out.error = String(e.message || e).slice(0, 300);
  }
  if (errs.length) out.pageErrors = errs.slice(0, 3);
  await page.close().catch(() => {});
  return out;
}

(async () => {
  const plan = JSON.parse(fs.readFileSync(arg('plan'), 'utf8'));
  const outPath = arg('out');
  const jobs = [];
  for (const c of plan.configs)
    for (const seed of plan.seeds)
      jobs.push({ tag: c.tag, params: c.params, seed, mult: c.mult });

  const nJobs = Math.min(+arg('jobs', 12), jobs.length);
  const stream = fs.createWriteStream(outPath, { flags: 'a' });
  const t0 = Date.now();
  let next = 0, done = 0;

  const workers = Array.from({ length: nJobs }, async () => {
    const browser = await chromium.launch({ args: GL_ARGS });
    try {
      for (;;) {
        const i = next++;
        if (i >= jobs.length) break;
        const r = await runJob(browser, jobs[i], plan);
        stream.write(JSON.stringify(r) + '\n');
        done++;
        const el = (Date.now() - t0) / 1000;
        const eta = el / done * (jobs.length - done);
        const last = r.checkpoints[r.checkpoints.length - 1];
        console.log(
          `[${done}/${jobs.length}] ${r.tag} seed=${r.seed} ` +
          (r.error ? 'ERROR ' + r.error
                   : `live=${last ? last.live : '?'} bodies=${last ? last.bodies : '?'}`) +
          `  ${el.toFixed(0)}s elapsed, eta ${eta.toFixed(0)}s`);
      }
    } finally {
      await browser.close().catch(() => {});
    }
  });

  await Promise.all(workers);
  stream.end();
  console.log(`\ndone: ${jobs.length} runs in ${((Date.now() - t0) / 60000).toFixed(1)} min -> ${outPath}`);
})().catch(e => { console.error(e); process.exit(1); });
