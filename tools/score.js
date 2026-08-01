#!/usr/bin/env node
/**
 * Score and tabulate sweep results.
 *
 *   node tools/score.js results.jsonl [more.jsonl ...] [--sort key] [--full]
 *
 * Kept separate from tools/sweep.js on purpose: the weighting below is a
 * judgement and will be argued with, and re-arguing it must not mean
 * re-running anything.
 *
 * Gates first, and they are hard. A composite score is a single number laid
 * over a planet, and a single number cannot see that the planet is dead — so
 * anything that has emptied, shattered, collapsed to a handful of strategies
 * or produced a non-finite formula result is out before the score is computed
 * rather than being allowed to trade its corpse against a good evenness.
 */
'use strict';
const fs = require('fs');

const GATES = { live: 60000, bodies: 300, strategies: 12 };

/* Every component is mapped into [0,1] so the weights mean what they look
   like. The two saturating maps have a scale in them, and both were chosen
   against the default configuration measured at 12,000 ticks rather than
   picked to be round: they put the default near the middle of its range,
   where a weight can move it either way. */
const SIZE_HALF = 40;    // mean nodes per plant scoring 0.5
const FIT_FULL  = 3.0;   // mean fit scoring 1.0
const MOTION_FULL = 0.25; // strategy turnover between readings scoring 1.0

/* What `motion` is and is not. It is the share of the population that changed
   strategy between the last two readings, and it catches the frozen mosaic —
   one of the two ways this genre of simulation dies. It does NOT catch a world
   frozen against its *climate*, which was the reason for putting it in: at
   equal ecology ticks, ecorate 32 measured HIGHER turnover than ecorate 8,
   because a config that sees less weather also keeps its lineages fitter and
   evolving faster. The freeze this search has to guard against is arithmetic,
   not statistical — runWorld pays `ecorate` ecology steps per climate update,
   so holding ecology ticks constant means simulated climate seconds run as
   1/ecorate, and raising ecorate is exactly buying a calmer planet. That is
   reported as `climate` below and bounded by the search, not scored. */
const CLIMATE_PER_TICK = 8.4;  // simulated seconds per climate update at x100

const WEIGHTS = {
  even:   0.22,  // niche evenness — no environment may own the planet
  dom:    0.18,  // 1 - largest lineage share
  mixed:  0.15,  // share of plants holding more than one kind of node
  size:   0.15,  // mean plant size
  fit:    0.10,  // mean fit over the final interval
  motion: 0.20,  // still moving: how much of the population changed strategy
};

const evennessOf = niche => {
  const v = Object.values(niche), t = v.reduce((a, b) => a + b, 0);
  if (!t) return 0;
  let h = 0;
  for (const x of v) if (x > 0) { const p = x / t; h -= p * Math.log(p); }
  return h / Math.log(5);
};

/* total variation distance between two count vectors, read as shares. 0 = the
   same population doing the same things, 1 = nothing in common. */
function turnover(a, b) {
  const ta = a.reduce((x, y) => x + y, 0), tb = b.reduce((x, y) => x + y, 0);
  if (!ta || !tb) return 0;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] / ta - b[i] / tb);
  return d / 2;
}

function scoreRun(r) {
  const cps = r.checkpoints || [];
  if (!cps.length) return { ok: false, why: r.error || 'no checkpoints' };
  const end = cps[cps.length - 1];
  const mid = cps.length >= 2 ? cps[cps.length - 2] : null;

  const fails = [];
  if (end.live < GATES.live) fails.push(`live ${end.live}`);
  if (end.bodies < GATES.bodies) fails.push(`bodies ${end.bodies}`);
  if (end.strategies < GATES.strategies) fails.push(`strategies ${end.strategies}`);
  if (end.nonFinite > 0) fails.push(`nonFinite ${end.nonFinite}`);

  /* mean fit over the last interval only. The counter behind meanFit is never
     reset, so its own value is the average since boot and a collapse in the
     final third barely shows in it. */
  const fitInt = mid && end.fitN > mid.fitN
    ? (end.fitSum - mid.fitSum) / (end.fitN - mid.fitN)
    : end.meanFit;
  const censusTurn = mid && end.census && mid.census ? turnover(end.census, mid.census) : 0;
  const nicheTurn = mid
    ? turnover(Object.values(end.niche), Object.values(mid.niche)) : 0;

  const c = {
    even:   evennessOf(end.niche),
    dom:    1 - end.topStrategy,
    mixed:  end.mixedCapBodies,
    size:   end.meanBody / (end.meanBody + SIZE_HALF),
    fit:    Math.min(1, Math.max(0, fitInt / FIT_FULL)),
    motion: Math.min(1, censusTurn / MOTION_FULL),
  };
  let score = 0;
  for (const k in WEIGHTS) score += WEIGHTS[k] * c[k];

  /* Direction, not just level. Affinity modulation read as a triumph at nine
     thousand ticks and was eating the planet at forty-four thousand, and the
     reading that would have caught it is whether the numbers were still
     falling at the end. A configuration that is merely settling and one that
     is on its way down look identical in a single snapshot. */
  const trend = mid ? {
    dEven: c.even - evennessOf(mid.niche),
    dTop: end.topStrategy - mid.topStrategy,
    dBody: end.meanBody - mid.meanBody,
    dLive: end.live - mid.live,
    dStrat: end.strategies - mid.strategies,
  } : null;

  return {
    ok: fails.length === 0, why: fails.join(', '),
    score, c, fitInt, censusTurn, nicheTurn, trend,
    live: end.live, bodies: end.bodies, meanBody: end.meanBody,
    largestBody: end.largestBody, strategies: end.strategies,
    spec: end.specialisation, twoTerr: end.twoTerrainBodies,
    eco: end.eco, wood: end.wood, budShare: end.budShare,
    /* how much weather this population actually lived through, per the note on
       CLIMATE_PER_TICK. Two configs at the same ecology ticks and different
       ecorate are not the same experiment, and this is the column that says so. */
    climate: CLIMATE_PER_TICK * end.eco / (r.params.ecorate || 16) / 3600,
  };
}

/* average across seeds; a single seed varies more than the effects worth
   chasing, and a configuration that wins on one and fails the gates on
   another has not won */
function aggregate(rows) {
  const by = new Map();
  for (const r of rows) {
    const s = scoreRun(r);
    if (!by.has(r.tag)) by.set(r.tag, { tag: r.tag, params: r.params, runs: [] });
    by.get(r.tag).runs.push({ seed: r.seed, ...s });
  }
  const out = [];
  for (const g of by.values()) {
    const ok = g.runs.filter(r => r.ok);
    const mean = k => {
      const get = typeof k === 'function' ? k : r => r[k];
      return ok.length ? ok.reduce((a, r) => a + (get(r) ?? 0), 0) / ok.length : 0;
    };
    const meanC = k => ok.length ? ok.reduce((a, r) => a + r.c[k], 0) / ok.length : 0;
    const sd = k => {
      if (ok.length < 2) return 0;
      const m = mean(k);
      return Math.sqrt(ok.reduce((a, r) => a + ((r[k] ?? 0) - m) ** 2, 0) / (ok.length - 1));
    };
    out.push({
      tag: g.tag, params: g.params,
      n: g.runs.length, passed: ok.length,
      failed: g.runs.filter(r => !r.ok).map(r => `${r.seed}:${r.why}`),
      /* a configuration is only as good as its worst seed: gate failures make
         the mean meaningless, so they are carried rather than averaged away */
      score: ok.length === g.runs.length ? mean('score') : 0,
      rawScore: mean('score'), scoreSD: sd('score'),
      even: meanC('even'), dom: meanC('dom'), mixed: meanC('mixed'),
      size: meanC('size'), fitc: meanC('fit'), motion: meanC('motion'),
      fitInt: mean('fitInt'), turn: mean('censusTurn'), nicheTurn: mean('nicheTurn'),
      live: mean('live'), bodies: mean('bodies'), meanBody: mean('meanBody'),
      largest: mean('largestBody'), strategies: mean('strategies'),
      spec: mean('spec'), twoTerr: mean('twoTerr'), wood: mean('wood'),
      climate: mean('climate'),
      dEven: mean(r => r.trend ? r.trend.dEven : 0),
      dTop: mean(r => r.trend ? r.trend.dTop : 0),
      dBody: mean(r => r.trend ? r.trend.dBody : 0),
      dLive: mean(r => r.trend ? r.trend.dLive : 0),
    });
  }
  return out;
}

function load(files) {
  const rows = [];
  for (const f of files)
    for (const l of fs.readFileSync(f, 'utf8').trim().split('\n'))
      if (l.trim()) rows.push(JSON.parse(l));
  return rows;
}

module.exports = { scoreRun, aggregate, load, evennessOf, turnover, WEIGHTS, GATES };
if (require.main !== module) return;

const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const rows = load(files);

const sortKey = (() => {
  const i = process.argv.indexOf('--sort');
  return i === -1 ? 'score' : process.argv[i + 1];
})();
const table = aggregate(rows).sort((a, b) => b[sortKey] - a[sortKey]);

const f = (v, d = 3) => (v ?? 0).toFixed(d);
console.log(
  'tag'.padEnd(22) + 'score  ±sd   | even   dom  mixed  size   fit motion |' +
  '  live  bodies mBody largest strat  fit  turn  spec');
console.log('-'.repeat(126));
for (const r of table) {
  console.log(
    r.tag.padEnd(22) +
    f(r.score).padStart(5) + ' ' + f(r.scoreSD, 3).padStart(5) + '  | ' +
    [r.even, r.dom, r.mixed, r.size, r.fitc, r.motion].map(v => f(v).padStart(5)).join(' ') + ' |' +
    String(Math.round(r.live)).padStart(7) +
    String(Math.round(r.bodies)).padStart(8) +
    f(r.meanBody, 1).padStart(6) +
    String(Math.round(r.largest)).padStart(8) +
    f(r.strategies, 1).padStart(6) +
    f(r.fitInt, 2).padStart(6) +
    f(r.turn, 3).padStart(6) +
    f(r.spec, 3).padStart(6) +
    (r.passed < r.n ? `  GATE ${r.failed.slice(0, 2).join(' ')}` : ''));
}
/* Level says where a world got to; direction says where it was going. A
   configuration still losing evenness at the final reading has not settled,
   it is on its way somewhere, and the run simply stopped before it arrived. */
if (process.argv.includes('--trend')) {
  console.log('\ntrajectory over the final interval (negative dEven / positive dTop = going wrong way)');
  console.log('tag'.padEnd(22) + '  dEven    dTop   dBody     dLive  climate(h)');
  for (const r of table)
    console.log(r.tag.padEnd(22) +
      (r.dEven >= 0 ? '+' : '') + f(r.dEven).padStart(6) +
      (r.dTop >= 0 ? '  +' : '  ') + f(r.dTop).padStart(6) +
      f(r.dBody, 1).padStart(8) +
      String(Math.round(r.dLive)).padStart(10) +
      f(r.climate, 2).padStart(10));
}
if (process.argv.includes('--full')) {
  console.log('\nparameters:');
  for (const r of table) console.log('  ' + r.tag.padEnd(22) + JSON.stringify(r.params));
}
console.log(`\nweights ${JSON.stringify(WEIGHTS)}`);
console.log(`gates live>=${GATES.live} bodies>=${GATES.bodies} strategies>=${GATES.strategies} nonFinite==0`);
console.log(`maps: size x/(x+${SIZE_HALF})  fit min(1,x/${FIT_FULL})  motion min(1,turn/${MOTION_FULL})`);
