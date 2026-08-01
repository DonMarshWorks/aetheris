#!/usr/bin/env node
/**
 * Pull main effects and candidate interactions out of a screening sweep.
 *
 *   node tools/analyse.js sweeps/screen.jsonl
 *
 * Two tables, and the second is the point of the exercise.
 *
 * Main effects are marginal means: because every factor's levels are dealt out
 * equally and shuffled independently, averaging the score over one factor's
 * level averages every other factor out with it. That is a fair reading of
 * what a factor does *on average over the rest of the space* — which is
 * exactly the reading that a one-at-a-time sweep cannot give, and also exactly
 * the reading that hides an effect which only exists in company.
 *
 * So the second table looks for the company. After removing both main effects
 * from a pair of factors, whatever structure is left in their joint cells is
 * interaction. This nominates pairs; it does not measure them — with 56
 * configurations a 4x4 cell holds three or four points and the estimate is
 * noisy. Confirmation is a real factorial over the shortlist.
 *
 * Gate failures are reported as a rate rather than folded into the mean. A
 * level that drives a third of its worlds extinct and leaves brilliant numbers
 * on the rest has not done well, and averaging a corpse as a zero would say
 * something equally untrue in the other direction.
 */
'use strict';
const { scoreRun, load } = require('./score.js');

const rows = load(process.argv.slice(2).filter(a => !a.startsWith('--')));

/* one point per configuration: the mean over its seeds */
const byTag = new Map();
for (const r of rows) {
  const s = scoreRun(r);
  if (!byTag.has(r.tag)) byTag.set(r.tag, { tag: r.tag, params: r.params, runs: [] });
  byTag.get(r.tag).runs.push(s);
}
const configs = [];
for (const g of byTag.values()) {
  const ok = g.runs.filter(r => r.ok);
  const mean = f => ok.length ? ok.reduce((a, r) => a + f(r), 0) / ok.length : 0;
  configs.push({
    tag: g.tag, params: g.params,
    allPassed: ok.length === g.runs.length && g.runs.length > 0,
    passRate: g.runs.length ? ok.length / g.runs.length : 0,
    score: mean(r => r.score),
    even: mean(r => r.c.even), dom: mean(r => r.c.dom), mixed: mean(r => r.c.mixed),
    size: mean(r => r.c.size), fit: mean(r => r.c.fit), motion: mean(r => r.c.motion),
    meanBody: mean(r => r.meanBody), spec: mean(r => r.spec),
  });
}

/* the baseline carries no explicit parameters, so it cannot sit in any cell */
const design = configs.filter(c => c.tag !== 'baseline' && Object.keys(c.params).length);
const passing = design.filter(c => c.allPassed);

const FACTORS = ['ecorate', 'tries', 'settle', 'minfrag', 'spore', 'fitcap',
                 'rare', 'marine', 'affmod', 'pmut', 'nodemut', 'hot'];
const LABEL = { hot: 'hot/anneal' };

const fmt = (v, d = 3) => (v ?? 0).toFixed(d);
const levelsOf = f => [...new Set(design.map(c => c.params[f]))].sort((a, b) => a - b);

console.log(`configurations ${design.length}, all-seeds-passing ${passing.length}, ` +
            `runs ${rows.length}\n`);

console.log('\x1b[1mMAIN EFFECTS\x1b[0m  (mean over passing configs; pass = all seeds cleared the gates)');
console.log('factor        level     n  pass   score |  even   dom mixed  size   fit motion | mBody  spec');
console.log('-'.repeat(104));
for (const f of FACTORS) {
  for (const lv of levelsOf(f)) {
    const all = design.filter(c => c.params[f] === lv);
    const ok = all.filter(c => c.allPassed);
    const m = k => ok.length ? ok.reduce((a, c) => a + c[k], 0) / ok.length : 0;
    console.log(
      (LABEL[f] || f).padEnd(13) + String(lv).padEnd(8) +
      String(all.length).padStart(3) +
      (100 * all.filter(c => c.allPassed).length / all.length).toFixed(0).padStart(5) + '%' +
      fmt(m('score')).padStart(8) + '  |' +
      [m('even'), m('dom'), m('mixed'), m('size'), m('fit'), m('motion')]
        .map(v => fmt(v).padStart(6)).join('') + ' |' +
      fmt(m('meanBody'), 1).padStart(6) + fmt(m('spec')).padStart(6));
  }
  console.log('-'.repeat(104));
}

/* ── interactions ──────────────────────────────────────────────────────────
   Remove the grand mean and both main effects, then ask how much structure
   survives in the joint cells. Scaled against the residual noise of the
   design so the number is a signal-to-noise ratio rather than a variance in
   arbitrary units. */
function interaction(A, B, key) {
  const y = c => c[key];
  const pts = passing.filter(c => c.params[A] !== undefined && c.params[B] !== undefined);
  if (pts.length < 12) return null;
  const grand = pts.reduce((a, c) => a + y(c), 0) / pts.length;
  const eff = (f) => {
    const m = new Map();
    for (const lv of [...new Set(pts.map(c => c.params[f]))]) {
      const s = pts.filter(c => c.params[f] === lv);
      m.set(lv, s.reduce((a, c) => a + y(c), 0) / s.length - grand);
    }
    return m;
  };
  const ea = eff(A), eb = eff(B);
  /* residual after the additive model, per point */
  const resid = pts.map(c => y(c) - grand - ea.get(c.params[A]) - eb.get(c.params[B]));
  const noise = Math.sqrt(resid.reduce((a, v) => a + v * v, 0) / Math.max(1, resid.length));

  let ss = 0, n = 0, cells = [];
  for (const la of [...new Set(pts.map(c => c.params[A]))])
    for (const lb of [...new Set(pts.map(c => c.params[B]))]) {
      const s = pts.filter(c => c.params[A] === la && c.params[B] === lb);
      if (s.length < 2) continue;
      const r = s.reduce((a, c, i) => a + resid[pts.indexOf(c)], 0) / s.length;
      ss += s.length * r * r; n += s.length;
      cells.push({ la, lb, n: s.length, r, mean: s.reduce((a, c) => a + y(c), 0) / s.length });
    }
  if (n < 12 || noise === 0) return null;
  /* mean-square of the cell effects against the per-point noise: how much
     bigger the joint structure is than what averaging that many points would
     produce by chance */
  const ms = Math.sqrt(ss / n);
  const perCell = n / Math.max(1, cells.length);
  return { A, B, strength: ms / (noise / Math.sqrt(perCell)), ms, cells, noise };
}

/* Scanned on the components as well as the composite. A pair can trade one
   component against another so exactly that the composite barely moves — two
   dials pulling evenness up and body size down together would cancel in the
   score and look like nothing at all, when what is actually there is the
   trade this whole search is about. */
for (const key of ['score', 'even', 'size', 'fit']) {
  const found = [];
  for (let i = 0; i < FACTORS.length; i++)
    for (let j = i + 1; j < FACTORS.length; j++) {
      const r = interaction(FACTORS[i], FACTORS[j], key);
      if (r) found.push(r);
    }
  found.sort((a, b) => b.strength - a.strength);
  console.log(`\n\x1b[1mCANDIDATE INTERACTIONS on ${key}\x1b[0m  ` +
              `(joint structure left after both main effects, over design noise)`);
  console.log('  pair                        strength   cell effect (sd of score)');
  for (const r of found.slice(0, 14))
    console.log('  ' + `${LABEL[r.A] || r.A} x ${LABEL[r.B] || r.B}`.padEnd(28) +
                fmt(r.strength, 2).padStart(6) + '      ' + fmt(r.ms, 4));

  if (key !== 'score') continue;
  console.log('\n  cell means for the top four pairs:');
  for (const r of found.slice(0, 4)) {
    console.log(`\n  ${LABEL[r.A] || r.A} x ${LABEL[r.B] || r.B}`);
    const las = [...new Set(r.cells.map(c => c.la))].sort((a, b) => a - b);
    const lbs = [...new Set(r.cells.map(c => c.lb))].sort((a, b) => a - b);
    console.log('    ' + (LABEL[r.A] || r.A).padEnd(9) +
                lbs.map(l => String(l).padStart(9)).join('') + '   <- ' + (LABEL[r.B] || r.B));
    for (const la of las) {
      let line = '    ' + String(la).padEnd(9);
      for (const lb of lbs) {
        const c = r.cells.find(x => x.la === la && x.lb === lb);
        line += (c ? fmt(c.mean).padStart(9) : '        -');
      }
      console.log(line);
    }
  }
}

console.log('\n\x1b[1mBEST CONFIGURATIONS IN THE SCREEN\x1b[0m');
for (const c of [...passing].sort((a, b) => b.score - a.score).slice(0, 12))
  console.log('  ' + c.tag.padEnd(7) + fmt(c.score).padStart(6) + '  ' + JSON.stringify(c.params));
const base = configs.find(c => c.tag === 'baseline');
if (base) console.log('  ' + 'baseline'.padEnd(7) + fmt(base.score).padStart(6) +
                      `  (pass ${(100 * base.passRate).toFixed(0)}%)`);
