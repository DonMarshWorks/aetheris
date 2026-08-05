#!/usr/bin/env node
/**
 * Generate a sweep plan.
 *
 *   node tools/gen-plan.js screen  > sweeps/screen.json
 *
 * One-at-a-time sweeps give wrong answers on this system and there is a
 * measured example: ocean nutrient limitation was judged harmful twice in
 * isolation and turned out to be a third of the cure once a fit ceiling and
 * frequency dependence were present with it. So the screen varies every
 * factor at once.
 *
 * The design is a randomised balanced assignment — each factor's levels are
 * dealt out equally across the configurations and then shuffled independently.
 * Main effects come out near-orthogonal, as they would in a fractional
 * factorial, but interactions are covered randomly rather than aliased to a
 * fixed pattern, which matters when nobody knows yet which interactions exist.
 *
 * ecorate is bounded above rather than below. Holding ecology ticks constant
 * makes simulated climate seconds run as 1/ecorate, so raising it buys a
 * calmer planet and every diversity metric improves — the degenerate win this
 * search has to refuse. 24 is 1.5x the default; 32 is measured in confirmation
 * to document the trade, not to win with it.
 */
'use strict';

/* mulberry32 — the plan has to be reproducible from the seed printed with it */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FACTORS = [
  { name: 'ecorate', levels: [{ ecorate: 8 }, { ecorate: 12 }, { ecorate: 16 }, { ecorate: 24 }] },
  { name: 'tries',   levels: [{ tries: 2 }, { tries: 4 }, { tries: 8 }, { tries: 16 }] },
  { name: 'settle',  levels: [{ settle: 1000 }, { settle: 2000 }, { settle: 3500 }] },
  { name: 'minfrag', levels: [{ minfrag: 25 }, { minfrag: 45 }, { minfrag: 65 }] },
  { name: 'spore',   levels: [{ spore: 0.002 }, { spore: 0.006 }, { spore: 0.015 }] },
  /* 0 is uncapped, and is the state the runaway was diagnosed in */
  { name: 'fitcap',  levels: [{ fitcap: 0 }, { fitcap: 1.4 }, { fitcap: 2.0 }, { fitcap: 3.0 }] },
  { name: 'rare',    levels: [{ rare: 0 }, { rare: 0.4 }, { rare: 0.7 }, { rare: 0.9 }] },
  { name: 'marine',  levels: [{ marine: 0 }, { marine: 0.5 }, { marine: 1.0 }] },
  /* 1.0 turns modulation off entirely */
  { name: 'affmod',  levels: [{ affmod: 1.0 }, { affmod: 1.3 }, { affmod: 1.6 }, { affmod: 2.2 }] },
  { name: 'pmut',    levels: [{ pmut: 1.0 }, { pmut: 2.0 }, { pmut: 3.5 }] },
  { name: 'nodemut', levels: [{ nodemut: 0.02 }, { nodemut: 0.07 }, { nodemut: 0.15 }] },
  /* hot only means anything with anneal above zero, so they move as one factor */
  { name: 'anneal',  levels: [{ hot: 1, anneal: 0 },
                              { hot: 4, anneal: 6000 },
                              { hot: 8, anneal: 15000 }] },
];

const N = +(process.argv[3] || 56);
const SEED = +(process.argv[4] || 20260731);
const r = rng(SEED);

const columns = FACTORS.map(f => {
  const col = [];
  for (let i = 0; i < N; i++) col.push(f.levels[i % f.levels.length]);
  for (let i = col.length - 1; i > 0; i--) {          // Fisher-Yates
    const j = (r() * (i + 1)) | 0;
    [col[i], col[j]] = [col[j], col[i]];
  }
  return col;
});

const configs = [{ tag: 'baseline', params: {} }];
for (let i = 0; i < N; i++) {
  const params = {};
  columns.forEach(col => Object.assign(params, col[i]));
  configs.push({ tag: 'r' + String(i).padStart(2, '0'), params });
}

console.log(JSON.stringify({
  note: `randomised balanced screen, N=${N}, seed=${SEED}`,
  ticks: 15000,
  checkpoints: [7500, 15000],
  defaultEcorate: 16,
  seeds: [7, 31337, 424242],
  configs,
}, null, 1));
