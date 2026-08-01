#!/usr/bin/env node
/**
 * Effects from a two-level full factorial.
 *
 *   node tools/factorial.js sweeps/fac1.jsonl [--on even]
 *
 * In a complete 2^k every factor and every combination of factors is
 * orthogonal to all the others, so an effect is just a contrast: the mean of
 * the runs where the sign is + minus the mean where it is -. Nothing is
 * aliased and nothing has to be assumed away, which is the whole reason for
 * paying for the full grid rather than a fraction of it.
 *
 * An effect is reported as the change in the response caused by moving a
 * factor from its low level to its high one. A two-factor effect is how much
 * that change *itself* changes when the second factor moves — so a large one
 * means the two dials cannot be set independently, which is the question this
 * search exists to answer.
 *
 * The noise floor comes from the replicate seeds: the spread between seeds of
 * the same configuration is the only estimate of error that owes nothing to
 * the model. An effect smaller than that is not an effect.
 */
'use strict';
const { scoreRun, load } = require('./score.js');

const onIdx = process.argv.indexOf('--on');
const RESPONSES = onIdx === -1
  ? ['score', 'even', 'dom', 'mixed', 'size', 'fit', 'motion']
  : [process.argv[onIdx + 1]];

const rows = load(process.argv.slice(2).filter(a => !a.startsWith('--')));

/* group the replicate seeds under their configuration */
const byTag = new Map();
for (const r of rows) {
  if (!byTag.has(r.tag)) byTag.set(r.tag, { tag: r.tag, params: r.params, runs: [] });
  byTag.get(r.tag).runs.push(scoreRun(r));
}

const value = (s, resp) => resp === 'score' ? s.score : s.c[resp];

/* which parameters actually vary across this design */
const all = [...byTag.values()];
const FACTORS = Object.keys(all[0].params)
  .filter(k => new Set(all.map(c => c.params[k])).size === 2)
  .sort();
const LO = {}, HI = {};
for (const f of FACTORS) {
  const lv = [...new Set(all.map(c => c.params[f]))].sort((a, b) => a - b);
  LO[f] = lv[0]; HI[f] = lv[1];
}

console.log(`configurations ${all.length}, seeds ${all[0].runs.length}, ` +
            `factors ${FACTORS.length} (${FACTORS.map(f => `${f} ${LO[f]}->${HI[f]}`).join(', ')})`);

/* gate failures are reported, never averaged: a dead planet has no score to
   contribute and letting it contribute a zero would make the contrast a
   measure of mortality wearing the units of diversity */
const dead = all.filter(c => c.runs.some(r => !r.ok));
if (dead.length) {
  console.log(`\n\x1b[31mgate failures\x1b[0m in ${dead.length} configuration(s) — excluded from effects:`);
  for (const c of dead)
    console.log('  ' + c.tag.padEnd(46) +
      c.runs.filter(r => !r.ok).map(r => r.why).join('; '));
}
const live = all.filter(c => c.runs.every(r => r.ok));

for (const resp of RESPONSES) {
  const y = new Map();
  for (const c of live) y.set(c.tag, c.runs.reduce((a, r) => a + value(r, resp), 0) / c.runs.length);

  /* pure error from the replicates, propagated to the scale of a contrast */
  let ss = 0, df = 0;
  for (const c of live) {
    const vs = c.runs.map(r => value(r, resp));
    const m = vs.reduce((a, b) => a + b, 0) / vs.length;
    ss += vs.reduce((a, v) => a + (v - m) ** 2, 0); df += vs.length - 1;
  }
  const sigma = df > 0 ? Math.sqrt(ss / df) : 0;
  const n = live.length;
  /* a contrast averages n/2 configurations each side, each of them a mean of
     `reps` seeds */
  const reps = live[0].runs.length;
  const seContrast = sigma * Math.sqrt(4 / (n * reps));

  const sign = (c, f) => (c.params[f] === HI[f] ? 1 : -1);
  const effects = [];
  for (let i = 0; i < FACTORS.length; i++) {
    let e = 0;
    for (const c of live) e += sign(c, FACTORS[i]) * y.get(c.tag);
    effects.push({ name: FACTORS[i], order: 1, e: 2 * e / n });
    for (let j = i + 1; j < FACTORS.length; j++) {
      let f2 = 0;
      for (const c of live) f2 += sign(c, FACTORS[i]) * sign(c, FACTORS[j]) * y.get(c.tag);
      effects.push({ name: `${FACTORS[i]} x ${FACTORS[j]}`, order: 2, e: 2 * f2 / n });
    }
  }
  effects.sort((a, b) => Math.abs(b.e) - Math.abs(a.e));

  console.log(`\n\x1b[1m${resp.toUpperCase()}\x1b[0m   ` +
    `grand mean ${([...y.values()].reduce((a, b) => a + b, 0) / n).toFixed(3)}   ` +
    `seed sd ${sigma.toFixed(4)}   2 s.e. on an effect ${(2 * seContrast).toFixed(4)}`);
  const shown = effects.filter(x => Math.abs(x.e) > 2 * seContrast);
  for (const x of shown.slice(0, 16)) {
    const bar = Math.min(40, Math.round(Math.abs(x.e) / 0.005));
    console.log('  ' + (x.order === 2 ? '  ' : '\x1b[1m') + x.name.padEnd(30) +
      (x.order === 1 ? '\x1b[0m' : '') +
      (x.e >= 0 ? '+' : '-') + Math.abs(x.e).toFixed(4).padStart(7) + '  ' +
      (x.e >= 0 ? '\x1b[32m' : '\x1b[31m') + '#'.repeat(bar) + '\x1b[0m');
  }
  if (!shown.length) console.log('  (nothing above the noise floor)');
  const nInter = shown.filter(x => x.order === 2).length;
  console.log(`  ${shown.filter(x => x.order === 1).length} of ${FACTORS.length} main effects ` +
              `and ${nInter} of ${FACTORS.length * (FACTORS.length - 1) / 2} interactions clear the noise floor`);
}

/* the grid's own best cells, which need not be any single factor's best level */
console.log('\n\x1b[1mBEST CELLS\x1b[0m');
const ranked = live.map(c => ({
  tag: c.tag,
  score: c.runs.reduce((a, r) => a + r.score, 0) / c.runs.length,
  even: c.runs.reduce((a, r) => a + r.c.even, 0) / c.runs.length,
  size: c.runs.reduce((a, r) => a + r.c.size, 0) / c.runs.length,
  fit: c.runs.reduce((a, r) => a + r.c.fit, 0) / c.runs.length,
  dEven: c.runs.reduce((a, r) => a + (r.trend ? r.trend.dEven : 0), 0) / c.runs.length,
})).sort((a, b) => b.score - a.score);
console.log('  ' + 'cell'.padEnd(46) + ' score   even   size    fit   dEven');
for (const r of ranked.slice(0, 10))
  console.log('  ' + r.tag.padEnd(46) + [r.score, r.even, r.size, r.fit]
    .map(v => v.toFixed(3).padStart(6)).join(' ') + (r.dEven >= 0 ? '  +' : '  ') + r.dEven.toFixed(3));
console.log('  ...');
for (const r of ranked.slice(-3))
  console.log('  ' + r.tag.padEnd(46) + [r.score, r.even, r.size, r.fit]
    .map(v => v.toFixed(3).padStart(6)).join(' ') + (r.dEven >= 0 ? '  +' : '  ') + r.dEven.toFixed(3));
