#!/usr/bin/env node
/**
 * Aetheris — do the four world controls actually do what they claim?
 *
 *   node tools/controls.js --out docs/controls.json [--jobs 6]
 *   node tools/controls.js --phase self          (just the harness self-check)
 *
 * The settings panel offers four physical controls over the world: sea level,
 * temperature and rainfall, which the climate controller steers toward live,
 * and relief, which rebuilds the terrain and so needs a restart. Each one
 * carries a sentence promising the visitor what it will do. Nothing had ever
 * checked that the promise is kept, and CLAUDE.md requires controller bounds to
 * be re-checked at x100 specifically, because time-lapse hands the loop
 * enormous timesteps and the corrections are rate-limited against exactly that.
 *
 * Three things about this harness are not incidental.
 *
 * 1. It proves itself before it measures anything. Four times on this project
 *    the thing reporting the measurement has been wrong rather than the thing
 *    measured, so phase 0 asserts what MUST be true — two identical runs are
 *    identical, the ecology cannot move the climate, holdClimate really holds —
 *    and refuses to run the rest if any of it is false.
 *
 * 2. The frame loop is retired before the page runs a line of its own. Left
 *    running it advances the same world this script is advancing, by a
 *    wall-clock-dependent amount, and two runs are then two accidents. This is
 *    the same stub sweep.js uses and for the same reason.
 *
 * 3. The live arm moves the target on a RUNNING world rather than booting with
 *    it, because that is what dragging the slider does. Booting with the value
 *    is a different question — what a shared link opens on — and is measured
 *    separately.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

const GL_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl',
];

const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i === -1 ? d : process.argv[i + 1];
};

/* A run of this takes tens of minutes and every page load reads index.html off
   disk, so an edit made while it runs silently splits the run between two
   different programs. That has already cost this project a round of
   measurement once. Unless a file is named, the run works from a snapshot
   taken now, and reports which one — so editing while it runs is safe and the
   result says what it measured. */
function freeze() {
  const src = path.join(ROOT, 'index.html');
  const dir = path.join(ROOT, '.measure');
  fs.mkdirSync(dir, { recursive: true });
  const body = fs.readFileSync(src);
  let sum = 5381;
  for (let i = 0; i < body.length; i++) sum = ((sum * 33) ^ body[i]) >>> 0;
  const dst = path.join(dir, 'index-' + sum.toString(16) + '.html');
  if (!fs.existsSync(dst)) fs.writeFileSync(dst, body);
  return dst;
}
const PAGE = arg('page') ? path.resolve(arg('page')) : freeze();

const OUT   = arg('out', path.join(ROOT, 'docs', 'controls.json'));
const JOBS  = +arg('jobs', 6);
const PHASE = arg('phase', 'all');
const SEEDS = arg('seeds', '31337,7,999,424242').split(',').map(s => s.trim());

/* One simulated hour, which is the horizon the homeostasis invariant is
   written against. The tick step is 0.084*mult simulated seconds, exactly as
   the frame loop accrues it, so equal simulated time is a different number of
   ticks at each speed — and simulated time is what the controller works in. */
const HOUR = 3600;
const STEP1 = 0.084;
const SAMPLE = 120;            // simulated seconds between readings

let failures = 0;
const pass = m => console.log('  \x1b[32mok\x1b[0m   ' + m);
const fail = m => { failures++; console.log('  \x1b[31mFAIL\x1b[0m ' + m); };
const check = (c, m) => c ? pass(m) : fail(m);
const section = t => console.log('\n\x1b[1m' + t + '\x1b[0m');
const f3 = v => (v === null || v === undefined) ? '  -  ' : v.toFixed(3);
const pct = v => (100 * v).toFixed(1) + '%';

/* ────────────────────────────────────────────────────────────────────────
   in-page probes
   ──────────────────────────────────────────────────────────────────────── */

/* A reading of the climate: the three dials, where they sit against their
   clamps, and the census the controller itself steers on.

   `oceanCheck` recomputes the ocean share from the raw elevation field using
   this script's own copy of the grid weighting. It exists to prove the copy is
   right: if it does not reproduce the simulation's own census, every terrain
   number below is being measured on a grid this harness has misunderstood. */
const SAMPLE_FN = () => {
  const w = window.__world, S = w.S, F = w.F;
  const GW = 320, GH = 160;
  let area = 0, ocean = 0;
  /* Ice and temperature split by hemisphere. A global ice share cannot tell a
     world with two modest caps from one with a vast winter cap and no summer
     cap at all, and at high tilt that is the entire question. */
  let hemA = [0, 0], hemIce = [0, 0], hemT = [0, 0];
  /* and by latitude band, because at high tilt the sub-solar point sits over a
     POLE — so the lit region is a polar cap and the equator is the far side of
     the terminator. Which way round the cold goes is the whole question, and a
     hemisphere average cannot answer it. */
  const NB = 9, bandA = new Float64Array(NB), bandIce = new Float64Array(NB),
        bandT = new Float64Array(NB);
  for (let j = 0; j < GH; j++) {
    const lat = Math.PI * 0.5 - (j + 0.5) / GH * Math.PI;
    const c = Math.cos(lat), row = j * GW, s = lat >= 0 ? 0 : 1;
    const b = Math.min(NB - 1, Math.floor((lat + Math.PI / 2) / Math.PI * NB));
    area += c * GW; hemA[s] += c * GW; bandA[b] += c * GW;
    for (let i = 0; i < GW; i++) {
      const k = row + i;
      if (F.h[k] < S.seaLevel) ocean += c;
      if (F.snow[k] > 0.45) { hemIce[s] += c; bandIce[b] += c; }
      hemT[s] += F.temp[k] * c; bandT[b] += F.temp[k] * c;
    }
  }
  const st = S.stats;
  return {
    t: +(S.time - S.epoch0).toFixed(3),
    sea: S.seaLevel, temp: S.globalTemp, hum: S.globalHum,
    ocean: st.ocean, ice: st.ice, desert: st.desert, forest: st.forest,
    grass: st.grass, tundra: st.tundra, land: st.land, meanT: st.temp,
    desertOfLand: st.desert / Math.max(1e-6, st.land),
    oceanCheck: ocean / area,
    solarLat: S.solarLat,
    /* each as a share of its OWN hemisphere, so "no northern cap" reads as 0
       and "the whole hemisphere is frozen" reads as 1 */
    iceN: hemIce[0] / hemA[0], iceS: hemIce[1] / hemA[1],
    tempN: hemT[0] / hemA[0], tempS: hemT[1] / hemA[1],
    /* north pole first, equator in the middle, south pole last */
    iceBand: Array.from(bandIce, (v, i) => +(v / bandA[i]).toFixed(3)).reverse(),
    tempBand: Array.from(bandT, (v, i) => +(v / bandA[i]).toFixed(1)).reverse(),
  };
};

/* What the terrain IS, as opposed to how much of each thing is standing on it.
   Relief is the only control that changes this, and its sentence promises
   three separate things — smooth shelves against mountains, simple continents
   against broken archipelagos, and that the sea still finds its own level. So
   all three are counted: the spread of elevation, the number of separate
   landmasses and how much of the land the largest of them holds, and the
   coastline length per unit of land, which is what "broken" means when it is
   made a number. */
const TERRAIN_FN = () => {
  const w = window.__world, S = w.S, F = w.F;
  const GW = 320, GH = 160, GN = GW * GH, h = F.h, sea = S.seaLevel;
  const cos = new Float64Array(GH);
  let area = 0;
  for (let j = 0; j < GH; j++) {
    cos[j] = Math.cos(Math.PI * 0.5 - (j + 0.5) / GH * Math.PI);
    area += cos[j] * GW;
  }

  let m = 0, m2 = 0, lo = Infinity, hi = -Infinity, landA = 0, relief = 0, deep = 0;
  /* How much ocean share one unit of sea level buys, measured where the sea
     actually stands. This is the gain of the sea-level control loop, and it is
     not a constant: a smooth world piles most of its elevation near one value,
     so the same sea-level step sweeps several times as much coastline. */
  const HALF = 0.02;
  let band = 0;
  for (let j = 0; j < GH; j++) {
    const c = cos[j], row = j * GW;
    for (let i = 0; i < GW; i++) {
      const e = h[row + i];
      m += e * c; m2 += e * e * c;
      if (e < lo) lo = e;
      if (e > hi) hi = e;
      if (e >= sea) { landA += c; relief += (e - sea) * c; }
      else deep += (sea - e) * c;
      if (e > sea - HALF && e < sea + HALF) band += c;
    }
  }
  const mean = m / area;
  const slope = (band / area) / (2 * HALF);

  /* coastline, as the weighted count of land/sea edges */
  let coast = 0;
  for (let j = 0; j < GH; j++) {
    const c = cos[j], row = j * GW;
    for (let i = 0; i < GW; i++) {
      const a = h[row + i] >= sea;
      if (a !== (h[row + (i + 1) % GW] >= sea)) coast += c;
      if (j < GH - 1 && a !== (h[row + GW + i] >= sea)) coast += c;
    }
  }

  /* separate landmasses: flood fill, wrapping in longitude. The poles are
     rows, not points, so no special case is needed beyond not stepping off
     the top and bottom. */
  const lab = new Int32Array(GN).fill(-1);
  const stack = new Int32Array(GN);
  const sizes = [];
  for (let k0 = 0; k0 < GN; k0++) {
    if (h[k0] < sea || lab[k0] !== -1) continue;
    const id = sizes.length;
    let sp = 0, a = 0;
    stack[sp++] = k0; lab[k0] = id;
    while (sp > 0) {
      const q = stack[--sp], j = (q / GW) | 0, i = q - j * GW;
      a += cos[j];
      const nb = [j * GW + (i + 1) % GW, j * GW + (i - 1 + GW) % GW];
      if (j > 0) nb.push(q - GW);
      if (j < GH - 1) nb.push(q + GW);
      for (const n of nb) if (h[n] >= sea && lab[n] === -1) { lab[n] = id; stack[sp++] = n; }
    }
    sizes.push(a);
  }
  sizes.sort((x, y) => y - x);
  const landTot = sizes.reduce((x, y) => x + y, 0) || 1e-9;

  return {
    elevMean: +mean.toFixed(4),
    /* ocean share gained per unit of sea level, and what one full correction
       step of the shipped controller therefore costs in share */
    slope: +slope.toFixed(3),
    stepCost: +(0.020 * slope).toFixed(4),
    elevSD: +Math.sqrt(Math.max(0, m2 / area - mean * mean)).toFixed(4),
    elevMin: +lo.toFixed(4), elevMax: +hi.toFixed(4),
    seaLevel: +sea.toFixed(4),
    landShare: +(landA / area).toFixed(4),
    meanHeight: +(relief / Math.max(1e-9, landA)).toFixed(4),   // land, above sea
    meanDepth: +(deep / Math.max(1e-9, area - landA)).toFixed(4),
    coastPerLand: +(coast / Math.max(1e-9, landA)).toFixed(3),
    /* islands smaller than a thousandth of the land are grid speckle and would
       swamp the count; the question is how many landmasses there ARE */
    landmasses: sizes.filter(s => s > landTot * 0.001).length,
    largestLandShare: +(sizes[0] / landTot).toFixed(4),
    biggestFive: sizes.slice(0, 5).map(s => +(s / landTot).toFixed(3)),
  };
};

/* ────────────────────────────────────────────────────────────────────────
   page plumbing
   ──────────────────────────────────────────────────────────────────────── */
async function open(browser, hash) {
  const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
  page.setDefaultTimeout(30 * 60 * 1000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  /* the boot lives inside a requestAnimationFrame callback and schedules the
     frame loop as its last act, so let exactly the first call through */
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    let n = 0;
    window.requestAnimationFrame = cb => (n++ === 0 ? raf(cb) : 0);
  });
  await page.goto('file://' + PAGE + hash);
  await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
    { timeout: 180000 });
  page.__errs = errs;
  return page;
}

/* Advance by simulated seconds at a given time-lapse multiplier, in chunks, so
   a slow configuration cannot outlive one evaluate(). The ecology is paid its
   ECORATE steps per climate tick exactly as the frame loop pays it — passing 0
   would be silently read as the default, so it is left to default and the
   ecology is turned off by parameter instead where it is not wanted. */
async function run(page, seconds, mult) {
  const ticks = Math.round(seconds / (STEP1 * mult));
  let left = ticks;
  while (left > 0) {
    const chunk = Math.min(left, 2000);
    await page.evaluate(([n, m]) => window.__world.runWorld(n, m), [chunk, mult]);
    left -= chunk;
  }
  return ticks;
}

const hashOf = (params, seed) =>
  '#seed=' + seed + Object.entries(params).map(([k, v]) => `&${k}=${v}`).join('');

/* ────────────────────────────────────────────────────────────────────────
   phase 0 — the harness proves itself
   ──────────────────────────────────────────────────────────────────────── */
async function selfCheck(browser) {
  section('Phase 0 — assertions that must hold before any number is believed');

  /* (a) two identical runs are identical. The one counter that has caught this
     project's harness bugs is the one asserting a thing that cannot be false. */
  const reads = [];
  for (let r = 0; r < 2; r++) {
    const p = await open(browser, hashOf({ plants: 0 }, 31337));
    await run(p, 600, 100);
    reads.push(await p.evaluate(SAMPLE_FN));
    await p.close();
  }
  const same = JSON.stringify(reads[0]) === JSON.stringify(reads[1]);
  check(same, 'two identical runs are identical' +
    (same ? '' : `\n         A ${JSON.stringify(reads[0])}\n         B ${JSON.stringify(reads[1])}`));

  /* (b) the ecology cannot move the climate. Plants never write to the climate
     fields — only stepFields and the boot do — so every climate measurement
     below can be taken with the ecology switched off and run sixteen times
     faster. That is worth a great deal at x1, where a simulated hour is 42,857
     ticks; but it is only worth anything if it is true, so it is asserted
     rather than read off the source. */
  const withP = await open(browser, hashOf({}, 31337));
  await run(withP, 600, 100);
  const a = await withP.evaluate(SAMPLE_FN);
  await withP.close();
  const noP = await open(browser, hashOf({ plants: 0 }, 31337));
  await run(noP, 600, 100);
  const b = await noP.evaluate(SAMPLE_FN);
  await noP.close();
  const indep = JSON.stringify(a) === JSON.stringify(b);
  check(indep, 'the ecology cannot move the climate (plants=0 is the same world)' +
    (indep ? '' : `\n         with ${JSON.stringify(a)}\n         without ${JSON.stringify(b)}`));

  /* (c) holdClimate really does hold. Reachability is asked through it, so a
     hold that leaked would be answering a different question. */
  const still = await open(browser, hashOf({ plants: 0, churn: 0 }, 31337));
  await run(still, 600, 100);
  const before = await still.evaluate(() => window.__world.holdClimate(true));
  await run(still, 900, 100);
  const after = await still.evaluate(SAMPLE_FN);
  const held = before.sea === after.sea && before.temp === after.temp && before.hum === after.hum;
  check(held, 'holdClimate pins all three dials' +
    (held ? '' : ` (${before.sea}→${after.sea}, ${before.temp}→${after.temp}, ${before.hum}→${after.hum})`));

  /* (d) this script's copy of the grid weighting reproduces the simulation's
     own census. If it does not, every terrain number below is measured on a
     grid this harness has misunderstood.

     It has to be asked of a world that is standing still in two separate
     senses, and the first attempt got the second one wrong. churn=0 stops the
     elevation field drifting between the census and the reading, which is
     necessary and is not sufficient: the controller takes its census and THEN
     moves the sea level, so on a running world the recorded share belongs to
     the sea level of a moment ago. That is a one-step lag and not a grid
     error, but it reads as 3.5e-5 of disagreement and would have been debugged
     as one. With the dials pinned there is no lag left and the two must agree
     to the last bits of float32 — which is the difference between an assertion
     and an approximation. */
  const s = await still.evaluate(SAMPLE_FN);
  const gridErr = Math.abs(s.oceanCheck - s.ocean);
  check(gridErr < 1e-6,
    `harness grid weighting reproduces the simulation's census (${gridErr.toExponential(1)})`);
  await still.close();

  return failures === 0;
}

/* ────────────────────────────────────────────────────────────────────────
   phase 1 — reach and hold
   ────────────────────────────────────────────────────────────────────────
   The three live controls, at both ends of the slider the panel offers, at x1
   and at x100. The world boots at the defaults and the target is then moved on
   the running world, which is precisely what dragging the slider does.

   Tolerances are the simulation's own: seedWorld decides a world has settled
   when ocean is within 0.020, ice within 0.030 and desert-of-land within
   0.105 of target, so those are what "reached it" means here too rather than
   a number invented for the occasion.
   ──────────────────────────────────────────────────────────────────────── */
/* `ends` is left blank on purpose and filled in from the running page — the
   thing under test is the slider the visitor is given, and a second copy of its
   range in this file would drift away from it the first time one moved. It did:
   the rainfall end was bounded to what the world will honour and a hardcoded
   test went on measuring the old one. Tolerances are the simulation's own,
   taken from what seedWorld calls settled. */
const CONTROLS = {
  tgtocean:  { name: 'Sea level',   read: r => r.ocean,        tol: 0.020,
               dial: r => r.sea,  clamp: [-0.50, 0.50], ends: null },
  tgtice:    { name: 'Temperature', read: r => r.ice,          tol: 0.030,
               dial: r => r.temp, clamp: [-14, 14],     ends: null },
  tgtdesert: { name: 'Rainfall',    read: r => r.desertOfLand, tol: 0.105,
               dial: r => r.hum,  clamp: [-0.56, 0.52], ends: null },
};

async function readSliderEnds(browser) {
  const page = await open(browser, '#seed=31337&plants=0');
  const list = await page.evaluate(() => window.__world.settings());
  await page.close();
  const by = Object.fromEntries(list.map(s => [s.key, s]));
  for (const k of Object.keys(CONTROLS)) {
    const s = by[k];
    if (!s) throw new Error(`the panel no longer offers ${k}`);
    CONTROLS[k].ends = [s.min, s.max];
    CONTROLS[k].panelName = s.name;
  }
  return by;
}

async function reachJob(browser, job) {
  const c = CONTROLS[job.key];
  const out = { ...job, samples: [] };
  const page = await open(browser, hashOf({ plants: 0, ...(job.extra || {}) }, job.seed));
  try {
    out.boot = await page.evaluate(SAMPLE_FN);
    if (job.live) {
      /* exactly what the slider's input handler does: assign into PARAMS */
      await page.evaluate(([k, v]) => { window.__world.params()[k] = v; }, [job.key, job.value]);
    }
    for (let t = SAMPLE; t <= HOUR; t += SAMPLE) {
      await run(page, SAMPLE, job.mult);
      out.samples.push(await page.evaluate(SAMPLE_FN));
    }
    out.terrain = await page.evaluate(TERRAIN_FN);
  } catch (e) {
    out.error = String(e.message || e).slice(0, 300);
  }
  if (page.__errs.length) out.pageErrors = page.__errs.slice(0, 3);
  await page.close().catch(() => {});
  return out;
}

/* Everything a reach run has to say, reduced to the four questions worth
   asking of it: did it get there, how long did it take, does it stay, and did
   the dial run out of room. */
function summarise(r) {
  const c = CONTROLS[r.key];
  const err = s => Math.abs(c.read(s) - r.value);
  const reachedAt = r.samples.findIndex(s => err(s) <= c.tol);
  /* the last third of the hour: seasons turn four times in an hour, so the
     spread here is mostly the year and only its excess is instability */
  const tail = r.samples.slice(Math.floor(r.samples.length * 2 / 3));
  const vals = tail.map(c.read);
  const dials = r.samples.map(c.dial);
  const last = r.samples[r.samples.length - 1];
  const eps = (c.clamp[1] - c.clamp[0]) * 1e-6;
  return {
    ...r, samples: undefined, trace: r.samples,
    finalErr: +err(last).toFixed(4),
    reached: reachedAt !== -1,
    reachedMin: reachedAt === -1 ? null : +((reachedAt + 1) * SAMPLE / 60).toFixed(1),
    tailMin: +Math.min(...vals).toFixed(4),
    tailMax: +Math.max(...vals).toFixed(4),
    tailSwing: +(Math.max(...vals) - Math.min(...vals)).toFixed(4),
    tailMeanErr: +(vals.reduce((a, v) => a + Math.abs(v - r.value), 0) / vals.length).toFixed(4),
    dialFinal: +c.dial(last).toFixed(4),
    dialPinnedLo: dials.every(d => d <= c.clamp[0] + eps),
    dialPinnedHi: dials.every(d => d >= c.clamp[1] - eps),
    dialAtClampFinal: c.dial(last) <= c.clamp[0] + eps || c.dial(last) >= c.clamp[1] - eps,
    /* what the rest of the world did while this one control was driven to an
       extreme, because the three dials are coupled through land area, snow
       cover and vegetation, and the panel promises nothing about that */
    otherEnv: { ocean: +last.ocean.toFixed(3), ice: +last.ice.toFixed(3),
                desert: +last.desert.toFixed(3), grass: +last.grass.toFixed(3),
                forest: +last.forest.toFixed(3), tundra: +last.tundra.toFixed(3),
                meanT: +last.meanT.toFixed(1) },
  };
}

/* ────────────────────────────────────────────────────────────────────────
   phase 2 — relief
   ──────────────────────────────────────────────────────────────────────── */
async function reliefJob(browser, job) {
  const out = { ...job, trace: [] };
  const page = await open(browser, hashOf({ plants: 0, relief: job.relief }, job.seed));
  try {
    out.boot = await page.evaluate(SAMPLE_FN);
    out.bootTerrain = await page.evaluate(TERRAIN_FN);
    /* sampled rather than only ended, because a controller that misses its
       target and a controller that is hunting around it look identical from
       one reading and want opposite fixes */
    for (let t = SAMPLE; t <= HOUR; t += SAMPLE) {
      await run(page, SAMPLE, job.mult);
      out.trace.push(await page.evaluate(SAMPLE_FN));
    }
    out.end = out.trace[out.trace.length - 1];
    out.terrain = await page.evaluate(TERRAIN_FN);
    const tail = out.trace.slice(Math.floor(out.trace.length * 2 / 3)).map(s => s.ocean);
    out.tailSwing = +(Math.max(...tail) - Math.min(...tail)).toFixed(4);
    out.oceanSwing = +(Math.max(...out.trace.map(s => s.ocean)) -
                       Math.min(...out.trace.map(s => s.ocean))).toFixed(4);
    out.seaSwing = +(Math.max(...out.trace.map(s => s.sea)) -
                     Math.min(...out.trace.map(s => s.sea))).toFixed(4);
  } catch (e) {
    out.error = String(e.message || e).slice(0, 300);
  }
  if (page.__errs.length) out.pageErrors = page.__errs.slice(0, 3);
  await page.close().catch(() => {});
  return out;
}

/* ────────────────────────────────────────────────────────────────────────
   phase 3 — the envelope: what can each dial actually deliver?
   ────────────────────────────────────────────────────────────────────────
   A slider is a promise, and the only honest place to put its ends is where
   the world stops answering. That cannot be read off a controller steering
   toward a target — it will report the target back — so the dial is pinned at
   its clamp with holdClimate and the world asked where it settles. This is the
   one question the hook exists for.

   churn=0, so the terrain cannot drift while the answer is being taken: with
   the dials pinned there is nothing left to correct for a moving coastline,
   and the reading would otherwise be a report on which way the noise happened
   to turn.
   ──────────────────────────────────────────────────────────────────────── */
async function envelopeJob(browser, job) {
  const out = { ...job };
  const page = await open(browser, hashOf({ plants: 0, churn: 0, ...(job.extra || {}) }, job.seed));
  try {
    /* let the controller settle the two dials that are not under test first,
       so the answer is about this dial and not about a world still arriving */
    await run(page, 1800, 100);
    out.settled = await page.evaluate(SAMPLE_FN);
    await page.evaluate(([s, t, h]) => window.__world.holdClimate(true, s, t, h),
      [job.sea, job.temp, job.hum]);
    await run(page, job.seconds || 7200, 100);
    out.end = await page.evaluate(SAMPLE_FN);
  } catch (e) {
    out.error = String(e.message || e).slice(0, 300);
  }
  if (page.__errs.length) out.pageErrors = page.__errs.slice(0, 3);
  await page.close().catch(() => {});
  return out;
}

/* ────────────────────────────────────────────────────────────────────────
   phase 4 — axial tilt: does homeostasis survive it?
   ────────────────────────────────────────────────────────────────────────
   The climate model is zonal, so an arbitrary sub-solar latitude costs it
   nothing structurally. The question is whether the controller can still hold
   every environment in the picture when the seasonal swing goes from none at
   all to a pole in permanent daylight — which is invariant 2, the entire point
   of the piece, so it is checked against verify.js's own bounds rather than a
   softer set invented here.

   Read at four points across the year as well as at the end, because a tilted
   world that averages correctly can still spend half of each year with an
   environment missing, and an annual mean would hide exactly that.
   ──────────────────────────────────────────────────────────────────────── */
const BOUNDS = {                    // the same numbers verify.js gates on
  ocean:  [0.60, 0.67], ice: [0.04, 0.15],
  forest: [0.02, 0.30], grass: [0.02, 0.30], desert: [0.01, 0.25],
};
const YEAR = 900;                   // simulated seconds per orbit
const outOfBounds = s => Object.entries(BOUNDS)
  .filter(([k, [lo, hi]]) => !(s[k] >= lo && s[k] <= hi))
  .map(([k]) => `${k} ${pct(s[k])}`);

async function tiltJob(browser, job) {
  const out = { ...job, season: [] };
  const page = await open(browser, hashOf({ plants: 0, tilt: job.tilt }, job.seed));
  try {
    out.boot = await page.evaluate(SAMPLE_FN);
    await run(page, HOUR, 100);          // settle for a simulated hour first
    out.settled = await page.evaluate(SAMPLE_FN);
    /* then a whole further year, sampled eight times, so both solstices and
       both equinoxes are looked at rather than whichever one the hour ended on */
    for (let k = 0; k < 8; k++) {
      await run(page, YEAR / 8, 100);
      out.season.push(await page.evaluate(SAMPLE_FN));
    }
    out.end = out.season[out.season.length - 1];
    const worst = {};
    for (const k of Object.keys(BOUNDS)) {
      worst[k + 'Min'] = +Math.min(...out.season.map(s => s[k])).toFixed(4);
      worst[k + 'Max'] = +Math.max(...out.season.map(s => s[k])).toFixed(4);
    }
    out.worst = worst;
    out.breaches = [...new Set(out.season.flatMap(outOfBounds).map(t => t.split(' ')[0]))];
    out.solarLatDeg = +(Math.max(...out.season.map(s => Math.abs(s.solarLat)))
                        * 180 / Math.PI).toFixed(1);
  } catch (e) {
    out.error = String(e.message || e).slice(0, 300);
  }
  if (page.__errs.length) out.pageErrors = page.__errs.slice(0, 3);
  await page.close().catch(() => {});
  return out;
}

/* ────────────────────────────────────────────────────────────────────────
   phase 5 — a year at one tilt, hemisphere by hemisphere, controller on and off
   ────────────────────────────────────────────────────────────────────────
   Phase 4 reported which tilts leave verify.js's bands and called that
   breaking. Don's objection is that a 90-degree world is SUPPOSED to leave
   them — one hemisphere in permanent daylight and the other in permanent
   night should give a vast winter cap and no summer cap at all, and a band
   written for the default world has nothing to say about it.

   So the two are separated. The held arm pins the three dials and lets the
   physics alone decide, which is what the expectation is about. The live arm
   leaves the controller steering, which is the only thing that can be said to
   fail. Whatever the difference between them is, is the controller's doing.
   ──────────────────────────────────────────────────────────────────────── */
async function seasonJob(browser, job) {
  const out = { ...job, year: [] };
  const page = await open(browser, hashOf({ plants: 0, tilt: job.tilt }, job.seed));
  try {
    await run(page, HOUR, 100);                    // settle
    if (job.held) await page.evaluate(() => window.__world.holdClimate(true));
    out.start = await page.evaluate(SAMPLE_FN);
    /* sixteen readings through one orbit, so both solstices are seen rather
       than straddled */
    for (let k = 0; k < 16; k++) {
      await run(page, YEAR / 16, 100);
      out.year.push(await page.evaluate(SAMPLE_FN));
    }
  } catch (e) {
    out.error = String(e.message || e).slice(0, 300);
  }
  if (page.__errs.length) out.pageErrors = page.__errs.slice(0, 3);
  await page.close().catch(() => {});
  return out;
}

/* ────────────────────────────────────────────────────────────────────────
   pool
   ──────────────────────────────────────────────────────────────────────── */
async function pool(jobs, fn) {
  const n = Math.min(JOBS, jobs.length);
  const results = new Array(jobs.length);
  let next = 0, done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: n }, async () => {
    const browser = await chromium.launch({ args: GL_ARGS });
    try {
      for (;;) {
        const i = next++;
        if (i >= jobs.length) break;
        results[i] = await fn(browser, jobs[i]);
        done++;
        const el = (Date.now() - t0) / 1000;
        console.log(`  [${done}/${jobs.length}] ${jobs[i].tag}  ` +
          (results[i].error ? 'ERROR ' + results[i].error : 'done') +
          `  ${el.toFixed(0)}s, eta ${(el / done * (jobs.length - done)).toFixed(0)}s`);
      }
    } finally { await browser.close().catch(() => {}); }
  }));
  return results;
}

/* ──────────────────────────────────────────────────────────────────────── */
(async () => {
  const report = { when: new Date().toISOString(), hour: HOUR, sample: SAMPLE,
                   page: path.relative(ROOT, PAGE) };
  console.log('measuring ' + path.relative(ROOT, PAGE));

  if (PHASE === 'self' || PHASE === 'all') {
    const browser = await chromium.launch({ args: GL_ARGS });
    let ok = false;
    try { ok = await selfCheck(browser); } finally { await browser.close().catch(() => {}); }
    if (!ok) {
      console.log('\n\x1b[31mThe harness does not trust itself. Nothing below would mean anything.\x1b[0m');
      process.exit(1);
    }
    if (PHASE === 'self') process.exit(0);
  }

  /* ---- phase 1 ---- */
  if (PHASE === 'all' || PHASE === 'reach') {
    section('Phase 1 — reach and hold (one simulated hour, target moved live)');
    const panel = await (async () => {
      const b = await chromium.launch({ args: GL_ARGS });
      try { return await readSliderEnds(b); } finally { await b.close().catch(() => {}); }
    })();
    report.panel = panel;
    for (const k of Object.keys(CONTROLS))
      console.log(`  the panel offers ${CONTROLS[k].panelName}: ` +
        `${CONTROLS[k].ends[0]} to ${CONTROLS[k].ends[1]}`);
    console.log(`  relief: ${panel.relief.min} to ${panel.relief.max}\n`);
    const jobs = [];
    for (const key of Object.keys(CONTROLS))
      for (const value of CONTROLS[key].ends) {
        /* every seed at time-lapse, where the runs are seconds; two at x1,
           where a simulated hour is 42,857 ticks */
        for (const seed of SEEDS)
          jobs.push({ tag: `${key}=${value} x100 s${seed}`, key, value, mult: 100,
                      seed, live: true });
        for (const seed of SEEDS.slice(0, 2))
          jobs.push({ tag: `${key}=${value} x1 s${seed}`, key, value, mult: 1,
                      seed, live: true });
      }
    /* the control arm: the defaults, so a swing at an extreme can be read
       against what this world does when nothing has been asked of it */
    for (const mult of [1, 100])
      for (const seed of SEEDS.slice(0, 2)) {
        jobs.push({ tag: `default-ocean x${mult} s${seed}`, key: 'tgtocean', value: 0.635,
                    mult, seed, live: false });
        jobs.push({ tag: `default-ice x${mult} s${seed}`, key: 'tgtice', value: 0.090,
                    mult, seed, live: false });
        jobs.push({ tag: `default-desert x${mult} s${seed}`, key: 'tgtdesert', value: 0.225,
                    mult, seed, live: false });
      }
    /* and the shared-link arm: booting straight into the extreme, which is
       what a link carrying the setting has to survive */
    for (const key of Object.keys(CONTROLS))
      for (const value of CONTROLS[key].ends)
        jobs.push({ tag: `boot ${key}=${value} x100`, key, value, mult: 100,
                    seed: SEEDS[0], live: false, extra: { [key]: value } });

    const raw = await pool(jobs, reachJob);
    report.reach = raw.map(r => r.error ? r : summarise(r));

    section('Phase 1 results');
    console.log('  control          target   x   seed   reached  at(min)  finalErr  tail swing  tail|err|  dial      pinned');
    for (const r of report.reach) {
      if (r.error) { fail(`${r.tag}: ${r.error}`); continue; }
      const c = CONTROLS[r.key];
      const pin = r.dialPinnedLo ? 'LOW' : r.dialPinnedHi ? 'HIGH' : (r.dialAtClampFinal ? 'end' : '');
      console.log(
        `  ${c.name.padEnd(12)} ${String(r.value).padStart(8)}  ${String(r.mult).padStart(3)}` +
        ` ${String(r.seed).padStart(6)}   ${(r.reached ? 'yes' : 'NO ').padStart(6)}` +
        `  ${String(r.reachedMin === null ? '-' : r.reachedMin).padStart(6)}` +
        `   ${f3(r.finalErr).padStart(7)}    ${f3(r.tailSwing).padStart(7)}` +
        `   ${f3(r.tailMeanErr).padStart(7)}   ${f3(r.dialFinal).padStart(8)}  ${pin}`);
      if (r.pageErrors) fail(`${r.tag} console: ${r.pageErrors[0]}`);
    }
    for (const r of report.reach) {
      if (r.error) continue;
      check(r.reached, `${r.tag} — reaches its target within ${CONTROLS[r.key].tol}` +
        (r.reached ? ` (${r.reachedMin} min, final error ${f3(r.finalErr)})`
                   : ` — final error ${f3(r.finalErr)}, dial ${f3(r.dialFinal)}` +
                     (r.dialAtClampFinal ? ' AT ITS CLAMP' : '')));
    }
  }

  /* ---- phase 2 ---- */
  if (PHASE === 'all' || PHASE === 'relief') {
    section('Phase 2 — relief: does it change the terrain, and does the sea still find its level');
    const jobs = [];
    const rl = report.panel ? report.panel.relief : { min: 0.3, max: 2.0 };
    for (const relief of [rl.min, 0.65, 1.0, 1.5, rl.max])
      for (const seed of SEEDS)
        for (const mult of [100])
          jobs.push({ tag: `relief=${relief} s${seed} x${mult}`, relief, seed, mult });
    /* one pair at x1 as well, because the controller has to find a sea level
       against a terrain it has never seen and that is the slow arm */
    for (const relief of [rl.min, rl.max])
      jobs.push({ tag: `relief=${relief} s${SEEDS[0]} x1`, relief, seed: SEEDS[0], mult: 1 });

    report.relief = await pool(jobs, reliefJob);

    section('Phase 2 results');
    console.log('  relief seed   x   ocean   err    slope  stepCost   elevSD  meanHt  meanDep  coast/land  masses  largest');
    for (const r of report.relief) {
      if (r.error) { fail(`${r.tag}: ${r.error}`); continue; }
      const t = r.terrain, e = r.end;
      console.log(
        `  ${String(r.relief).padStart(5)} ${String(r.seed).padStart(6)} ${String(r.mult).padStart(3)}` +
        `  ${pct(e.ocean).padStart(6)} ${f3(Math.abs(e.ocean - 0.635)).padStart(6)}` +
        ` ${f3(t.slope).padStart(6)} ${f3(t.stepCost).padStart(9)}` +
        `   ${f3(t.elevSD).padStart(7)} ${f3(t.meanHeight).padStart(7)}` +
        ` ${f3(t.meanDepth).padStart(8)}  ${f3(t.coastPerLand).padStart(10)}` +
        `  ${String(t.landmasses).padStart(6)}  ${f3(t.largestLandShare)}`);
      if (r.pageErrors) fail(`${r.tag} console: ${r.pageErrors[0]}`);
    }
    for (const r of report.relief) {
      if (r.error) continue;
      check(Math.abs(r.end.ocean - 0.635) <= 0.020,
        `${r.tag} — the sea still finds its level (ocean ${pct(r.end.ocean)})`);
    }
  }

  /* ---- phase 3 ---- */
  if (PHASE === 'all' || PHASE === 'envelope') {
    section('Phase 3 — the envelope each dial can actually deliver');
    const jobs = [];
    for (const seed of SEEDS) {
      /* sea level at both stops: the PARAMS note claims ocean is reachable
         across 0 to 0.96, which is the widest claim any of these makes */
      jobs.push({ tag: `sea=-0.50 s${seed}`, seed, sea: -0.50, dial: 'sea', reads: 'ocean' });
      jobs.push({ tag: `sea=+0.50 s${seed}`, seed, sea: 0.50, dial: 'sea', reads: 'ocean' });
      /* temperature at both stops -> how much ice this world can hold */
      jobs.push({ tag: `temp=-14 s${seed}`, seed, temp: -14, dial: 'temp', reads: 'ice' });
      jobs.push({ tag: `temp=+14 s${seed}`, seed, temp: 14, dial: 'temp', reads: 'ice' });
      /* humidity at both stops -> how much of the land can be desert */
      jobs.push({ tag: `hum=-0.56 s${seed}`, seed, hum: -0.56, dial: 'hum', reads: 'desertOfLand' });
      jobs.push({ tag: `hum=+0.52 s${seed}`, seed, hum: 0.52, dial: 'hum', reads: 'desertOfLand' });
    }
    report.envelope = await pool(jobs, envelopeJob);

    section('Phase 3 results — where the world stops answering');
    console.log('  dial pinned at   seed    reads              settled     at the stop');
    const reach = {};
    for (const r of report.envelope) {
      if (r.error) { fail(`${r.tag}: ${r.error}`); continue; }
      const v = r.end[r.reads], was = r.settled[r.reads];
      (reach[r.tag.split(' ')[0]] = reach[r.tag.split(' ')[0]] || []).push(v);
      console.log(`  ${r.tag.split(' ')[0].padEnd(12)} ${String(r.seed).padStart(7)}` +
        `   ${r.reads.padEnd(14)} ${pct(was).padStart(8)}  ${pct(v).padStart(14)}`);
    }
    console.log('\n  the slider ends the world can honour:');
    for (const k of Object.keys(reach)) {
      const v = reach[k];
      console.log(`    ${k.padEnd(12)} ${pct(Math.min(...v))} .. ${pct(Math.max(...v))}` +
        `   (mean ${pct(v.reduce((a, b) => a + b, 0) / v.length)} over ${v.length} seeds)`);
    }
  }

  /* ---- phase 4 ---- */
  if (PHASE === 'all' || PHASE === 'tilt') {
    section('Phase 4 — axial tilt: can the controller still hold every environment?');
    const jobs = [];
    for (const tilt of [0, 12, 24, 40, 55, 70, 90])
      for (const seed of SEEDS)
        jobs.push({ tag: `tilt=${tilt} s${seed}`, tilt, seed });
    report.tilt = await pool(jobs, tiltJob);

    section('Phase 4 results — across one further year, sampled eight times');
    console.log('  tilt seed    sun±   ocean          ice            forest         grass          desert         verdict');
    for (const r of report.tilt) {
      if (r.error) { fail(`${r.tag}: ${r.error}`); continue; }
      const w = r.worst;
      const span = k => `${pct(w[k + 'Min'])}-${pct(w[k + 'Max'])}`.padEnd(14);
      console.log(`  ${String(r.tilt).padStart(4)} ${String(r.seed).padStart(6)}` +
        ` ${String(r.solarLatDeg).padStart(5)}   ${span('ocean')} ${span('ice')} ` +
        `${span('forest')} ${span('grass')} ${span('desert')} ` +
        (r.breaches.length ? '\x1b[31m' + r.breaches.join(',') + '\x1b[0m' : 'holds'));
      if (r.pageErrors) fail(`${r.tag} console: ${r.pageErrors[0]}`);
    }
    /* Reported per tilt rather than per run, because the question is which
       tilts are safe to offer, and one seed failing is enough to say a tilt is
       not — a visitor does not get to pick the seed that works. */
    const byTilt = {};
    for (const r of report.tilt)
      if (!r.error) (byTilt[r.tilt] = byTilt[r.tilt] || []).push(r);
    console.log('\n  which tilts every seed survives:');
    for (const t of Object.keys(byTilt).sort((a, b) => a - b)) {
      const bad = byTilt[t].filter(r => r.breaches.length);
      console.log(`    ${String(t).padStart(3)}°  ` +
        (bad.length ? `\x1b[31m${bad.length}/${byTilt[t].length} seeds break: ` +
                      `${[...new Set(bad.flatMap(r => r.breaches))].join(', ')}\x1b[0m`
                    : `\x1b[32mall ${byTilt[t].length} seeds hold\x1b[0m`));
    }
  }

  /* ---- phase 5 ---- */
  if (PHASE === 'all' || PHASE === 'season') {
    section('Phase 5 — one year at high tilt, hemisphere by hemisphere');
    const tilts = (arg('tilts', '90,24')).split(',').map(Number);
    const jobs = [];
    for (const tilt of tilts)
      for (const held of [true, false])
        jobs.push({ tag: `tilt=${tilt} ${held ? 'dials held' : 'controller live'}`,
                    tilt, held, seed: SEEDS[0] });
    report.season = await pool(jobs, seasonJob);

    for (const r of report.season) {
      if (r.error) { fail(`${r.tag}: ${r.error}`); continue; }
      console.log(`\n  \x1b[1m${r.tag}\x1b[0m`);
      console.log('    sun    north ice  south ice   north °C  south °C   global dial   forest  desert');
      for (const s of r.year) {
        const sun = (s.solarLat * 180 / Math.PI);
        console.log(
          `    ${(sun >= 0 ? '+' : '') + sun.toFixed(0).padStart(3)}°` +
          `   ${pct(s.iceN).padStart(8)}   ${pct(s.iceS).padStart(8)}` +
          `   ${s.tempN.toFixed(1).padStart(7)}  ${s.tempS.toFixed(1).padStart(7)}` +
          `   ${s.temp.toFixed(2).padStart(10)}` +
          `   ${pct(s.forest).padStart(6)}  ${pct(s.desert).padStart(6)}`);
      }
      const sw = k => (Math.max(...r.year.map(s => s[k])) - Math.min(...r.year.map(s => s[k])));
      console.log(`    over the year: north ice swings ${pct(sw('iceN'))}, ` +
        `south ${pct(sw('iceS'))}, the global temperature dial ${sw('temp').toFixed(2)}`);
      /* the profile at the northern solstice, which is where the intuition
         about "no northern cap" is actually tested */
      const sol = r.year.reduce((a, b) => b.solarLat > a.solarLat ? b : a);
      const lab = ['90..70N','70..50N','50..30N','30..10N','10N..10S',
                   '10..30S','30..50S','50..70S','70..90S'];
      console.log(`    at the northern solstice (sun +${(sol.solarLat*180/Math.PI).toFixed(0)}°):`);
      console.log('      band      ' + lab.map(s => s.padStart(9)).join(''));
      console.log('      ice       ' + sol.iceBand.map(v => pct(v).padStart(9)).join(''));
      console.log('      mean °C   ' + sol.tempBand.map(v => v.toFixed(0).padStart(9)).join(''));
    }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  console.log(`\nwrote ${path.relative(ROOT, OUT)}`);
  if (failures) { console.log(`\x1b[31m${failures} check(s) failed\x1b[0m`); process.exit(1); }
  console.log('\x1b[32mAll checks passed\x1b[0m');
})().catch(e => { console.error(e); process.exit(1); });
