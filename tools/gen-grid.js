#!/usr/bin/env node
/**
 * Build a full-factorial plan over a handful of factors, holding the rest
 * fixed.
 *
 *   node tools/gen-grid.js '{"base":{...},"grid":{"marine":[0,1],"fitcap":[0,2]},
 *                            "ticks":20000,"seeds":[7,31337,424242]}' > plan.json
 *
 * The screen nominates interactions; this measures them. A marginal mean over
 * a randomised design says what a factor does averaged over the rest of the
 * space, which is the reading that hides an effect only present in company —
 * and company is the whole question here, since three mechanisms that each did
 * nothing alone turned out to be the entire cure together.
 */
'use strict';

const spec = JSON.parse(process.argv[2]);
const base = spec.base || {};
const keys = Object.keys(spec.grid);

/* cartesian product, in a stable order so tags mean the same thing twice */
let combos = [{}];
for (const k of keys) {
  const next = [];
  for (const c of combos) for (const v of spec.grid[k]) next.push({ ...c, [k]: v });
  combos = next;
}

const short = k => k.slice(0, 4);
const configs = combos.map(c => ({
  tag: keys.map(k => short(k) + String(c[k]).replace('0.', '.')).join('_'),
  params: { ...base, ...c },
}));

if (spec.extra) configs.push(...spec.extra);

console.log(JSON.stringify({
  note: spec.note || `full factorial over ${keys.join(' x ')}, ${configs.length} configs`,
  ticks: spec.ticks || 20000,
  checkpoints: spec.checkpoints || [spec.ticks / 2, spec.ticks],
  defaultEcorate: 16,
  seeds: spec.seeds || [7, 31337, 424242],
  configs,
}, null, 1));
