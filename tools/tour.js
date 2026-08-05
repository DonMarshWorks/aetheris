#!/usr/bin/env node
/**
 * Does the tour fly, and does it fly comfortably?
 *
 *   node tools/tour.js
 *
 * A screensaver is judged by how it feels, and feel is acceleration. So the
 * assertions here are about the shape of the motion rather than about where it
 * ends up, and two of them are things that MUST be true rather than things that
 * would be nice:
 *
 *  - **The journey follows smootherstep in the leg's own clock.** The pose is a
 *    pure function of how far through a leg it is, so this can be checked
 *    exactly and is immune to a headless renderer's uneven frames. The tell is
 *    the peak: smootherstep's derivative tops out at 30/16 = 1.875 times the
 *    average. Linear would read 1.000 and plain smoothstep 1.500, so this one
 *    number distinguishes the curve that has zero acceleration at both ends
 *    from the two that do not.
 *
 *  - **The tour must not touch the world.** It draws its route from
 *    Math.random and must never reach the simulation's own stream, or the
 *    camera would decide the planet and a link would stop describing a world.
 *    Two identical runs, one touring and one not, must produce byte-identical
 *    ecologies.
 *
 * The rest is behaviour: legs change, the tangent shot really does look past
 * the planet rather than at it, leaving brings the view back, and a drag does
 * not fight the pilot.
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const PAGE = path.resolve(__dirname, '..', 'index.html').split(path.sep).join('/');
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist', '--enable-webgl'];
/* Wait on FRAMES, never on milliseconds. Everything measured here is driven by
   the frame loop, and a software renderer under load delivers about seven frames
   a second — so a 500ms wait is often less than one frame and every reading is
   of the state BEFORE the thing that was asked for. It reported the ring shot
   standing over a pole, with the identical number the pole shot had just given,
   which is the signature: the same camera read twice. */
const frames = (p, n = 2) => p.evaluate(async k => {
  for (let i = 0; i < k; i++) await new Promise(r => requestAnimationFrame(r));
}, n);
let bad = 0;
const ok = m => console.log('  \x1b[32mok\x1b[0m   ' + m);
const no = m => { bad++; console.log('  \x1b[31mFAIL\x1b[0m ' + m); };
const check = (c, m) => c ? ok(m) : no(m);

(async () => {
  const browser = await chromium.launch({ args: GL });
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  page.setDefaultTimeout(10 * 60 * 1000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await page.goto('file://' + PAGE + '#seed=31337');
  await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
    { timeout: 240000 });
  await page.waitForFunction(() => { const s = document.getElementById('splash');
                                     return !s || s.classList.contains('gone'); });

  // ---- the button exists, and says what it is doing -----------------------
  const btn = await page.evaluate(() => {
    const b = document.getElementById('tour');
    return { there: !!b, pressed: b && b.getAttribute('aria-pressed'),
             title: b && b.title, svg: !!(b && b.querySelector('svg')) };
  });
  check(btn.there && btn.svg, `a rocket among the round controls ("${btn.title}")`);

  await page.click('#tour');
  const on = await page.evaluate(() => ({ t: window.__world.tour(),
    pressed: document.getElementById('tour').getAttribute('aria-pressed'),
    lit: document.getElementById('tour').classList.contains('on') }));
  check(on.t.on && on.pressed === 'true' && on.lit,
    `pressed, it flies: "${on.t.shot}" over ${on.t.dur}s`);
  check(on.t.shots.length >= 8, `${on.t.shots.length} framings to choose from`);

  // ---- the shape of the motion --------------------------------------------
  /* Sampled against the leg's OWN clock, not against wall time: the pose is a
     pure function of TOUR.t, so this measures the easing curve itself and a
     dropped frame cannot make a smooth flight look jerky. */
  /* On a leg the eye does NOT ride the ground for. When the tour holds a piece
     of ground, it carries both ends of the leg round with the planet every
     frame — so the whole journey is rotating while it is being flown, and the
     angle from a fixed starting pose is not a monotone sweep at all. It went
     backwards, and it should: the metric was wrong, not the motion. "The planet
     turning" stands still against the stars, so its two endpoints are fixed and
     the angle between them really is the journey. */
  const prof = await page.evaluate(async () => {
    const W = window.__world;
    W.tourGo('the planet turning', true);
    await new Promise(r => requestAnimationFrame(r));
    const ang = (a, b) => {
      let d = 0; for (let i = 0; i < 4; i++) d += a[i] * b[i];
      return 2 * Math.acos(Math.min(1, Math.abs(d)));
    };
    const s = [];
    for (;;) {
      await new Promise(r => requestAnimationFrame(r));
      const t = W.tour();
      const u = t.t / t.dur;
      /* the clock running BACKWARDS is a new leg starting, and everything after
         it belongs to a different journey */
      if (s.length && u < s[s.length - 1].u) break;
      s.push({ u, q: t.eye.slice() });
      if (t.arrived || s.length > 4000) break;
    }
    return s;
  });
  /* ARC LENGTH along the path, not the angle back to where it started. The
     angle between two orientations is 2*acos(|dot|), which saturates at a half
     turn and then comes DOWN again — so a leg that turns through more than 180
     degrees reads as doubling back and its derivative blows up at the top of
     the arc. That is the metric bending, not the camera. Accumulated steps are
     monotone by construction and their derivative is the angular speed, which
     is the quantity the easing curve is a statement about. */
  const step = (a, b) => { let d = 0; for (let i = 0; i < 4; i++) d += a[i] * b[i];
                           return 2 * Math.acos(Math.min(1, Math.abs(d))); };
  let acc = 0;
  for (let i = 1; i < prof.length; i++) { acc += step(prof[i-1].q, prof[i].q); prof[i].a = acc; }
  prof[0].a = 0;
  const total = prof[prof.length - 1].a;
  /* the fastest tenth of the journey against the average tenth. Smootherstep
     peaks at 1.875, smoothstep at 1.500, a linear ramp at 1.000. */
  /* From the SECOND step. The page re-registers its frame callback at the top
     of its own handler, so from the second iteration onward this samples after
     the world has been advanced — but the first reading is taken before it, and
     therefore belongs to the pose the leg started FROM. One stale sample against
     a step of two hundredths of the clock reads as a twenty-three-fold spike in
     a quantity that cannot mathematically exceed 1.875. */
  /* A derivative needs an interval to be measured over. Frame times are not
     even -- one frame in forty lands 8ms after its neighbour where the rest are
     230ms apart -- and a step of a thousandth of the clock divided into any
     ordinary movement manufactures a spike of twenty-eight times the mean in a
     quantity that cannot exceed 1.875. That is arithmetic on a degenerate
     interval, not a camera doing anything. Steps far shorter than the typical
     one are noise and are skipped; the instrumented dump is what showed it,
     after two runs of guessing did not. */
  const minDu = 0.4 / Math.max(1, prof.length - 1);
  let peak = 0;
  for (let i = 2; i < prof.length; i++) {
    const du = prof[i].u - prof[i - 1].u;
    if (du < minDu) continue;
    const v = (prof[i].a - prof[i - 1].a) / du / total;
    if (v > peak) peak = v;
  }
  check(peak > 1.72 && peak < 2.02,
    `the journey is eased, not ramped: peak speed ${peak.toFixed(3)}x the mean ` +
    `(smootherstep 1.875, smoothstep 1.500, linear 1.000)`);
  /* and the claim that makes it comfortable: it leaves and arrives at nothing */
  /* Against smootherstep at the sample's OWN position on the clock, not against
     a number chosen for a tenth of the way in. At seven frames a second a leg is
     thirty samples, so "the first sample past 0.10" can be at 0.19 — where the
     curve really has covered four and a half per cent, and a gate written for
     0.10 calls a correct motion a failure. */
  const ease = u => u*u*u*(u*(u*6-15)+10);
  const early = prof.find(p => p.u >= 0.10), late = prof.find(p => p.u >= 0.85);
  const eOK = !early || early.a/total < ease(early.u)*2.2 + 0.01;
  const lOK = !late  || (1-late.a/total) < (1-ease(late.u))*2.2 + 0.01;
  check(eOK && lOK,
    `it starts and stops from rest: ${(100*early.a/total).toFixed(1)}% across at ` +
    `u=${early.u.toFixed(2)} where the curve says ${(100*ease(early.u)).toFixed(1)}%, ` +
    `${(100*(1-late.a/total)).toFixed(1)}% left at u=${late.u.toFixed(2)} ` +
    `where it says ${(100*(1-ease(late.u))).toFixed(1)}%`);
  /* monotone — the eye never backs up on its way somewhere */
  let backs = 0;
  for (let i = 2; i < prof.length; i++) if (prof[i].a < prof[i - 1].a - 1e-6) backs++;
  check(backs === 0, `and never doubles back (${prof.length} frames sampled)`);

  // ---- how the camera rolls on its way ------------------------------------
  /* An aeroplane banks on to a new heading; it does not flick on to its back.
     The two are told apart by the peak roll rate against the mean: turned about
     an axis the profile is the easing curve's own 1.875, and dragged along a
     chord between two nearly opposite ups it spikes far higher, because the
     direction whips through most of the half-turn in a few frames near the
     middle. Measured on a leg into the shuttle window, which is the framing
     that wants an up furthest from every other one. */
  await page.evaluate(() => window.__world.tourGo('the world in space'));
  await frames(page, 3);
  const roll = await page.evaluate(async () => {
    const W = window.__world;
    W.tourGo('down the tangent', true);
    /* CAM.up is the zero vector whenever the tour is not driving it, and the
       angle between a zero vector and anything comes out as a right angle — so
       one such sample puts a ninety-degree step into the middle of a smooth
       roll. Returns null and the sample is dropped rather than counted. */
    const up = () => { const u = W.cam().up, l = Math.hypot(u[0],u[1],u[2]);
                       return l > 1e-6 ? [u[0]/l, u[1]/l, u[2]/l] : null; };
    const s = [];
    for (;;) {
      await new Promise(r => requestAnimationFrame(r));
      const t = W.tour();
      const u = t.t / t.dur;
      if (s.length && u < s[s.length - 1].u) break;
      const v = up(); if (v) s.push({ u, v });
      if (t.arrived || s.length > 4000) break;
    }
    const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1,
                  a[0]*b[0] + a[1]*b[1] + a[2]*b[2])));
    let total = 0, peak = 0;
    /* uneven frame times again - see the note on the journey profile above */
    const minDu = 0.4 / Math.max(1, s.length - 1);
    for (let i = 2; i < s.length; i++) {          /* see the note on the first sample */
      const du = s[i].u - s[i-1].u; if (du < minDu) continue;
      const da = ang(s[i-1].v, s[i].v);
      total += da;
      if (da / du > peak) peak = da / du;
    }
    let worst = 0, wi = 0;
    for (let i = 2; i < s.length; i++) {
      const du = s[i].u - s[i-1].u; if (du < 1e-4) continue;
      if (ang(s[i-1].v, s[i].v)/du > worst) { worst = ang(s[i-1].v, s[i].v)/du; wi = i; }
    }
    return { turned: ang(s[1].v, s[s.length-1].v), peak, total, n: s.length,
             /* the step that spikes, and the three around it, because guessing
                at where a discontinuity comes from has now cost two runs */
             around: s.slice(Math.max(0, wi-2), wi+2)
                      .map(x => ({u:+x.u.toFixed(3), v:x.v.map(k=>+k.toFixed(3))})) };
  });
  const ratio = roll.total > 0.05 ? roll.peak / roll.total : 0;
  if (roll.turned < 0.15)
    ok(`the shuttle leg barely rolled (${(roll.turned*57.3).toFixed(0)}deg) — nothing to judge`);
  else check(ratio > 1.5 && ratio < 2.4,
    `it banks rather than flicks: rolled ${(roll.turned*57.3).toFixed(0)}deg, ` +
    `peak rate ${ratio.toFixed(2)}x the mean (an eased turn about an axis is 1.875; ` +
    `a chord between opposite ups spikes far past this)` +
    (ratio > 2.4 ? `\n       around the spike: ` + JSON.stringify(roll.around) : ''));
  await page.evaluate(() => window.__world.setTour(false));
  await page.evaluate(async () => {
    const t0 = performance.now();
    while (window.__world.tour().leaving && performance.now() - t0 < 30000)
      await new Promise(r => requestAnimationFrame(r));
  });
  await page.evaluate(() => window.__world.setTour(true));
  await frames(page, 2);

  // ---- one leg follows another --------------------------------------------
  const legs = await page.evaluate(async () => {
    const W = window.__world, seen = [];
    const t0 = performance.now();
    let last = '';
    while (performance.now() - t0 < 150000) {
      await new Promise(r => setTimeout(r, 250));
      const t = W.tour();
      if (t.shot !== last) { seen.push(t.shot); last = t.shot; }
      if (seen.length >= 3) break;
    }
    return seen;
  });
  check(legs.length >= 3 && legs[0] !== legs[1] && legs[1] !== legs[2],
    `it goes on somewhere new: ${legs.join(' -> ')}`);

  // ---- the framings point where they say they do --------------------------
  /* The assertion that catches a conjugated orientation, which is what this
     went wrong as: a conjugate is a perfectly good unit quaternion, every
     length and every dot product stays exactly what it should be, and the only
     symptom is that every camera faces the opposite way. Nothing about the
     algebra can see it. Where the eye ends up relative to the sun and the axis
     can. */
  const facing = await page.evaluate(async (names) => {
    const W = window.__world, out = {};
    const rot = (q, v) => {                       // the page's own qApply, inlined
      const tx = 2 * (q[1] * v[2] - q[2] * v[1]),
            ty = 2 * (q[2] * v[0] - q[0] * v[2]),
            tz = 2 * (q[0] * v[1] - q[1] * v[0]);
      return [v[0] + q[3] * tx + (q[1] * tz - q[2] * ty),
              v[1] + q[3] * ty + (q[2] * tx - q[0] * tz),
              v[2] + q[3] * tz + (q[0] * ty - q[1] * tx)];
    };
    for (const n of names) {
      W.tourGo(n);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const t = W.tour(), s = W.sunDir(), p = W.pole();
      const e = rot(t.eye, [0, 0, 1]);            // where the eye stands
      out[n] = { sun: e[0] * s[0] + e[1] * s[1] + e[2] * s[2],
                 pole: e[0] * p[0] + e[1] * p[1] + e[2] * p[2] };
    }
    return out;
  }, ['the sunlit side', 'the night side', 'over a pole', 'the ring edge on']);
  check(facing['the sunlit side'].sun > 0.85,
    `the sunlit side stands in the sun (eye·sun ${facing['the sunlit side'].sun.toFixed(2)})`);
  check(facing['the night side'].sun < -0.5,
    `the night side stands behind it (eye·sun ${facing['the night side'].sun.toFixed(2)})`);
  check(Math.abs(facing['over a pole'].pole) > 0.88,
    `over a pole is over a pole (|eye·axis| ${Math.abs(facing['over a pole'].pole).toFixed(2)})`);
  check(Math.abs(facing['the ring edge on'].pole) < 0.14,
    `edge on to the ring is in its plane (|eye·axis| ` +
    `${Math.abs(facing['the ring edge on'].pole).toFixed(2)})`);

  // ---- looking past the planet, and coming back ---------------------------
  await page.evaluate(() => window.__world.tourGo('down the tangent'));
  await frames(page, 3);
  const tan = await page.evaluate(() => {
    const W = window.__world, c = W.cam(), t = W.tour();
    const rot = (q, v) => {
      const tx = 2 * (q[1] * v[2] - q[2] * v[1]),
            ty = 2 * (q[2] * v[0] - q[0] * v[2]),
            tz = 2 * (q[0] * v[1] - q[1] * v[0]);
      return [v[0] + q[3] * tx + (q[1] * tz - q[2] * ty),
              v[1] + q[3] * ty + (q[2] * tx - q[0] * tz),
              v[2] + q[3] * tz + (q[0] * ty - q[1] * tx)];
    };
    const e = rot(t.eye, [0, 0, 1]);
    const eye = e.map(v => v * c.dist);
    const v = t.aim.map((a, i) => a - eye[i]);
    const vl = Math.hypot(...v);
    /* how close the look ray passes to the planet's centre. The ray that just
       grazes the limb passes at exactly one radius, so this number says where
       the horizon falls in the frame — and it says it from the geometry rather
       than by repeating the constant the code used to get there. */
    const cross = [eye[1] * v[2] - eye[2] * v[1],
                   eye[2] * v[0] - eye[0] * v[2],
                   eye[0] * v[1] - eye[1] * v[0]];
    return { off: Math.hypot(...t.aim), dist: c.dist,
             graze: Math.hypot(...cross) / vl,
             up: c.up, upDotEye: c.up[0] * e[0] + c.up[1] * e[1] + c.up[2] * e[2] };
  });
  check(tan.off > 0.2,
    `the shuttle window really looks past the planet (aim ${tan.off.toFixed(2)} from the centre)`);
  check(tan.graze > 0.72 && tan.graze < 1.0,
    `and looks at the horizon: the sightline passes ${tan.graze.toFixed(2)} radii from the ` +
    `centre, from ${tan.dist.toFixed(2)} out — a grazing ray is exactly 1.00`);
  check(tan.upDotEye > 0.9,
    `with the local vertical up the frame, not the pole (up·out ${tan.upDotEye.toFixed(3)})`);

  await page.click('#tour');
  const leaving = await page.evaluate(() => window.__world.tour());
  check(leaving.leaving && !leaving.on, 'leaving is a manoeuvre, not a cut');
  await page.evaluate(async () => {
    const t0 = performance.now();
    while (window.__world.tour().leaving && performance.now() - t0 < 30000)
      await new Promise(r => requestAnimationFrame(r));
  });
  const home = await page.evaluate(() => ({ t: window.__world.tour(),
    pressed: document.getElementById('tour').getAttribute('aria-pressed') }));
  const back = Math.hypot(...home.t.aim);
  check(!home.t.on && !home.t.leaving && back < 1e-4 && home.pressed === 'false',
    `and it comes about to face the planet again (aim ${back.toFixed(4)} from the centre)`);

  // ---- a drag does not fight the pilot ------------------------------------
  await page.click('#tour');
  await frames(page, 3);
  const fought = await page.evaluate(async () => {
    const W = window.__world, c = document.getElementById('c') || document.querySelector('canvas');
    const before = W.tour();
    const ev = (k, x, y) => c.dispatchEvent(new PointerEvent(k,
      { pointerId: 3, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    ev('pointerdown', 500, 400);
    for (let i = 0; i < 10; i++)
      window.dispatchEvent(new PointerEvent('pointermove',
        { pointerId: 3, clientX: 500 + i * 30, clientY: 400, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup',
      { pointerId: 3, clientX: 800, clientY: 400, bubbles: true }));
    const after = W.tour();
    return { shot: before.shot === after.shot, zoom: Math.abs(before.zoom - after.zoom) };
  });
  check(fought.shot, 'a drag does not wrestle the camera off the tour');
  await page.click('#tour');

  // ---- and it must not touch the world ------------------------------------
  /* The one that has to be true. The route is drawn from Math.random and the
     world from its own seeded stream; if they ever share, the camera decides
     the planet and a link stops describing a world. */
  /* The frame loop must be STOPPED before this, and leaving it running is what
     made the first reading of this a false alarm: it advances the same world
     runWorld is advancing, by an amount that depends on how many frames the
     machine managed — and the tour costs frames. So the arm with the tour on
     drew fewer frames, got less free advancement, and came out with a different
     world. That is the frame loop being measured, not the tour.

     requestAnimationFrame is replaced before the page runs a line, letting
     through exactly the one call that boots the world — the boot lives inside a
     frame callback and schedules the loop as its last act — and dropping every
     call after it. tools/sweep.js already had to learn this; it did not occur to
     me that a determinism check needed it more than a sweep does. */
  const eco = async (tourOn) => {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
    await ctx.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      let through = 0;
      window.requestAnimationFrame = cb => (through++ === 0 ? raf(cb) : 0);
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(10 * 60 * 1000);
    await p.goto('file://' + PAGE + '#seed=31337');
    await p.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
      { timeout: 240000 });
    /* the tour is turned on and then STEPPED by hand, because with no frame loop
       nothing would call it — and a tour that never ran would prove nothing */
    if (tourOn) await p.evaluate(() => {
      window.__world.setTour(true);
      for (let i = 0; i < 900; i++) window.__world.tourStep(1 / 60, 0.0004);
    });
    await p.evaluate(() => window.__world.runWorld(1200));
    const r = await p.evaluate(() => { const s = window.__world.plants();
      return { live: s.live, bodies: s.bodies, largest: s.largestBody,
               deaths: s.deaths, fit: s.meanFit, runs: s.progRuns }; });
    await ctx.close();
    return r;
  };
  const [without, withTour] = [await eco(false), await eco(true)];
  const same = JSON.stringify(without) === JSON.stringify(withTour);
  check(same, same
    ? `the tour does not touch the world: ${without.live} living nodes, ` +
      `${without.bodies} bodies, ${without.deaths} deaths, both ways`
    : `THE TOUR MOVED THE WORLD — ${JSON.stringify(without)} vs ${JSON.stringify(withTour)}`);

  check(errs.length === 0, 'no console errors' + (errs[0] ? ': ' + errs[0] : ''));
  await browser.close();
  console.log();
  if (bad) { console.log(`\x1b[31m${bad} check(s) failed\x1b[0m`); process.exit(1); }
  console.log('\x1b[32mThe pilot has somewhere to be\x1b[0m');
})().catch(e => { console.error(e); process.exit(1); });
