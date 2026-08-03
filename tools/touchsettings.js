#!/usr/bin/env node
/**
 * Can the settings sliders actually be worked with a finger?
 *
 *   node tools/touchsettings.js                       (both engines)
 *   node tools/touchsettings.js --engine webkit
 *   node tools/touchsettings.js --page /tmp/before.html
 *
 * Reported from an iPhone: the sliders are hard to grab and move. WebKit is
 * the engine Safari on iOS actually runs, so it is tested here as well as
 * Chromium — this is as close to the report as anything short of the phone.
 *
 * The suspected cause is that html and body carry touch-action:none, which the
 * canvas needs and which also suppresses the browser's own drag behaviour on a
 * native <input type=range>. A synthetic pointer event cannot see that, because
 * it bypasses the gesture machinery entirely — so the decisive checks here are
 * the ones driven by REAL input: page.touchscreen for touch, page.mouse for a
 * drag. --page lets the same checks run against the file as it was before, so
 * the fix is measured against the failure rather than asserted over it.
 */
'use strict';
const path = require('path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i === -1 ? d : process.argv[i + 1];
};
const PAGE = path.resolve(arg('page', path.join(ROOT, 'index.html')));
const ENGINES = (arg('engine', 'chromium,webkit')).split(',');

const GL_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl',
];

let failures = 0;
const pass = m => console.log('  \x1b[32mok\x1b[0m   ' + m);
const fail = m => { failures++; console.log('  \x1b[31mFAIL\x1b[0m ' + m); };
const check = (c, m) => c ? pass(m) : fail(m);

/* Where a control is on screen and what it currently reads. Works for either
   kind of slider, so the same test can be pointed at the old file. */
const probe = (page, key) => page.evaluate(nm => {
  /* By parameter, never by label — the copy is edited often and has nothing to
     do with whether the control works. Falls back to matching the label for
     the old file, which carried no data-key, so the two can be compared. */
  let row = document.querySelector('#setlist .card[data-key="' + nm.key + '"]');
  if (!row) row = [...document.querySelectorAll('#setlist .setrow, #setlist .card')]
    .find(r => { const t = r.querySelector('.cardname, .setname span');
                 return t && t.textContent === nm.was; });
  if (!row) throw new Error('no control for ' + nm.key);
  row.scrollIntoView({ block: 'center' });
  const built = row.querySelector('.srange');
  const label = (row.querySelector('.cardname, .setname span')||{}).textContent || nm.key;
  const natives = [...row.querySelectorAll('input[type=range]')];
  const box = (built || natives[0]).getBoundingClientRect();
  const rail = built ? built.querySelector('.strack').getBoundingClientRect() : box;
  return {
    kind: built ? 'built' : 'native', label,
    knobs: built ? built.querySelectorAll('.sknob').length : natives.length,
    reading: row.querySelector('.setval').textContent,
    railLeft: rail.left, railWidth: rail.width,
    cy: box.top + box.height / 2, height: box.height,
    /* what the browser will let a touch on this control do. "none" means the
       page has claimed the gesture and nothing native will drag. */
    touchAction: getComputedStyle(built || natives[0]).touchAction,
  };
}, key);

const SEA = {key:'tgtocean', was:'Sea level'};
const RAIN = {key:'tgtdesert', was:'Rainfall'};
const LEN  = {key:'__len',     was:'Branch length'};
const xAt = (p, f) => p.railLeft + Math.min(0.999, Math.max(0.001, f)) * p.railWidth;

async function suite(engineName) {
  console.log(`\n\x1b[1m${engineName} — iPhone 13 viewport, real touch\x1b[0m` +
    (PAGE.endsWith('index.html') ? '' : `  (${path.relative(ROOT, PAGE)})`));
  const engine = playwright[engineName];
  const browser = await engine.launch(engineName === 'chromium' ? { args: GL_ARGS } : {});
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5 * 60 * 1000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await page.goto('file://' + PAGE + '#seed=31337');
  await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
    { timeout: 240000 });
  await page.waitForFunction(() => {
    const s = document.getElementById('splash');
    return !s || s.classList.contains('gone');
  }, { timeout: 60000 });

  await page.tap('#gear');

  /* ---- 1. a single tap on the track must move the knob there ----
     This is the whole complaint made into one gesture. A native range in a
     page that has taken touch-action does not respond to it at all. */
  {
    const before = await probe(page, SEA);
    console.log(`       "${before.label}" is a ${before.kind} control, ` +
      `${before.knobs} knob(s), ${before.height.toFixed(0)}px tall, ` +
      `touch-action:${before.touchAction} — reads "${before.reading}"`);
    await page.touchscreen.tap(xAt(before, 0.85), before.cy);
    const after = await probe(page, SEA);
    const hash = await page.evaluate(() => location.hash);
    check(after.reading !== before.reading,
      `one tap at 85% of the track moves it: "${before.reading}" → "${after.reading}"`);
    check(/tgtocean=/.test(hash), `and reaches the world and the URL: ${hash}`);
  }

  /* ---- 2. a touch drag along the track must track the finger ---- */
  {
    const before = await probe(page, RAIN);
    await page.touchscreen.tap(xAt(before, 0.2), before.cy);
    const low = await probe(page, RAIN);
    await page.touchscreen.tap(xAt(before, 0.9), before.cy);
    const high = await probe(page, RAIN);
    check(low.reading !== high.reading && low.reading !== before.reading,
      `the far ends of the track are both reachable: "${low.reading}" then "${high.reading}"`);
  }

  /* ---- 3. dragging a slider must not scroll the panel out from under it,
             and dragging the prose must still scroll it ---- */
  {
    const p = await probe(page, RAIN);
    const top0 = await page.evaluate(() => document.getElementById('setlist').scrollTop);
    await page.mouse.move(xAt(p, 0.5), p.cy);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(xAt(p, 0.5 + k * 0.04), p.cy + k * 9);
    await page.mouse.up();
    const top1 = await page.evaluate(() => document.getElementById('setlist').scrollTop);
    check(top0 === top1, `a sloppy drag on a slider does not scroll the panel (${top0} → ${top1})`);
    const moved = await probe(page, RAIN);
    check(moved.reading !== p.reading,
      `and it still tracks sideways while the finger wanders: "${p.reading}" → "${moved.reading}"`);
  }

  /* ---- 4. the two-knob range: each end moves on its own and they never
             swap meaning ---- */
  {
    const p = await probe(page, LEN);
    console.log(`       "${p.label}" is a ${p.kind} control with ${p.knobs} knob(s)` +
      ` — reads "${p.reading}"`);
    check(p.knobs === 2, `one control, two knobs (${p.knobs})`);
    const pair = () => page.evaluate(() => {
      const q = window.__world.params();
      return { lo: q.splo, hi: q.sphi };
    });
    /* Each tap must find the NEARER knob and leave the other alone, which is
       the whole of what makes one track carry two values. Stated as "the one
       that moved is the one that was nearer" rather than as an expected
       number — a tap at 5% lands where 5% is, not on the stop. */
    const start = await pair();
    await page.touchscreen.tap(xAt(p, 0.05), p.cy);
    const lowTap = await pair();
    await page.touchscreen.tap(xAt(p, 0.95), p.cy);
    const highTap = await pair();
    check(lowTap.lo !== start.lo && lowTap.hi === start.hi,
      `a tap near the low end moves only the low knob ` +
      `(${start.lo}→${lowTap.lo}, ${start.hi}→${lowTap.hi})`);
    check(highTap.hi !== lowTap.hi && highTap.lo === lowTap.lo,
      `a tap near the high end moves only the high knob ` +
      `(${lowTap.lo}→${highTap.lo}, ${lowTap.hi}→${highTap.hi})`);

    /* drive the low knob past the high one: it must stop, never swap */
    await page.mouse.move(xAt(p, 0.05), p.cy);
    await page.mouse.down();
    for (const f of [0.3, 0.6, 0.9, 1.3]) await page.mouse.move(xAt(p, f), p.cy);
    await page.mouse.up();
    const shut = await pair();
    check(shut.lo <= shut.hi && Math.abs(shut.lo - shut.hi) < 0.06,
      `the low end stops at the high end instead of passing it (${shut.lo} to ${shut.hi})`);

    /* and the range must be re-openable once collapsed — with both knobs on
       one spot the nearer one is a coin toss, and a wrong guess strands the
       control shut for good */
    await page.mouse.move(xAt(p, 0.9), p.cy);
    await page.mouse.down();
    for (const f of [0.6, 0.3, 0.05]) await page.mouse.move(xAt(p, f), p.cy);
    await page.mouse.up();
    const reopened = await pair();
    check(reopened.hi - reopened.lo > 1,
      `a collapsed range can be opened again (${reopened.lo} to ${reopened.hi})`);
  }

  /* ---- 5. and none of it zoomed or scrolled the page ---- */
  {
    const s = await page.evaluate(() => ({
      scale: window.visualViewport ? +window.visualViewport.scale.toFixed(3) : 1,
      x: scrollX, y: scrollY,
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    }));
    check(s.scale === 1 && s.x === 0 && s.y === 0 && s.sw === s.cw,
      `the page itself never zoomed or scrolled (${JSON.stringify(s)})`);
  }

  check(errs.length === 0, 'no console errors' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close();
  await browser.close();
}

(async () => {
  for (const e of ENGINES) await suite(e.trim());
  console.log();
  if (failures) { console.log(`\x1b[31m${failures} check(s) failed\x1b[0m`); process.exit(1); }
  console.log('\x1b[32mAll checks passed\x1b[0m');
})().catch(e => { console.error(e); process.exit(1); });
