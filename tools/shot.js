#!/usr/bin/env node
/**
 * Render a configuration and photograph it.
 *
 *   node tools/shot.js --out docs/img --ticks 45000 --shots shots.json
 *
 * The score cannot see whether a planet is beautiful, and the final call on
 * this piece is aesthetic. So every configuration that wins on numbers gets
 * photographed at two scales: the whole planet, which is how the piece is
 * usually seen, and close in, which is where the plants are actually legible
 * as plants rather than as texture.
 *
 * Unlike the sweep, this keeps the frame loop running — nothing is drawn
 * without it — and gives it time to settle before the shutter.
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
const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i === -1 ? d : process.argv[i + 1];
};

const OUT = arg('out', 'docs/img');
const TICKS = +arg('ticks', 45000);
const SIZE = +arg('size', 900);

/* zoom 1.0 frames the whole disc; ZTELE is 0.44 and below it the camera stops
   approaching and the lens narrows instead, so 0.13 is well into the
   telephoto and is where a single plant fills the frame.
 *
 * Several angles rather than one, because the surface turns as the world runs
 * and a fixed yaw therefore points at whatever happens to be underneath after
 * 45,000 ticks — the first close-up taken here landed on open ocean. These are
 * contact sheets to choose from, not a considered composition. */
/* Angles are given as offsets from the sun rather than as absolute yaw and
   pitch. The eye sits at (cos p sin y, sin p, cos p cos y), so putting it on
   the sun vector looks straight down the light at the sub-solar point; a
   small offset from there is guaranteed to be daylit with some modelling in
   it. Fixed angles cannot do that — the surface turns as the world runs, so
   which ground is under a given yaw depends on the tick count, and half the
   first contact sheet came back black because it was pointed at midnight. */
const VIEWS = [
  { name: 'planet-a', dYaw:  0.45, dPitch:  0.15, zoom: 1.00 },
  { name: 'planet-b', dYaw: -0.85, dPitch: -0.25, zoom: 1.00 },
  { name: 'close-a',  dYaw:  0.30, dPitch:  0.20, zoom: 0.13 },
  { name: 'close-b',  dYaw: -0.35, dPitch: -0.30, zoom: 0.13 },
  { name: 'close-c',  dYaw:  0.75, dPitch:  0.45, zoom: 0.20 },
  { name: 'close-d',  dYaw: -0.10, dPitch: -0.05, zoom: 0.20 },
];

(async () => {
  const shots = JSON.parse(fs.readFileSync(arg('shots'), 'utf8'));
  fs.mkdirSync(path.join(ROOT, OUT), { recursive: true });
  const browser = await chromium.launch({ args: GL_ARGS });

  for (const s of shots) {
    /* topn rings the largest plants in magenta. It is an annotation for
       reading the simulation, not part of the piece, and it has no business in
       a picture whose whole purpose is to be judged on how it looks. */
    const params = { topn: 0, ...s.params };
    const hash = '#seed=' + s.seed +
      Object.entries(params).map(([k, v]) => `&${k}=${v}`).join('');
    const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
    page.setDefaultTimeout(30 * 60 * 1000);
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    await page.goto('file://' + PAGE + hash);
    await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
      { timeout: 180000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('splash');
      return !el || el.classList.contains('gone');
    }, { timeout: 60000 });

    const eco = s.params.ecorate || 16;
    let left = Math.round(TICKS / eco);
    while (left > 0) {
      const chunk = Math.min(left, 400);
      await page.evaluate(([n, e]) => window.__world.runWorld(n, 100, e), [chunk, eco]);
      left -= chunk;
    }

    /* stop the world so the two views are the same instant, and take the
       interface out of the picture */
    await page.evaluate(() => {
      document.getElementById('hud').classList.add('hidden');
      window.__world.setSpeed(0);
    });

    const sun = await page.evaluate(() => window.__world.sunDir());
    const sunYaw = Math.atan2(sun[0], sun[2]);
    const sunPitch = Math.asin(Math.max(-1, Math.min(1, sun[1])));

    /* A fade cannot be photographed. --seq takes several frames a few ecology
       ticks apart from one fixed camera, so a bud arriving or a node draining
       into heartwood is visible as a change between images rather than having
       to be inferred from one. The world is stepped between shutters and the
       camera is not touched, so anything that moves between frames is the
       simulation and not the view. */
    const seq = +arg('seq', 0);
    if (seq > 0) {
      const gap = +arg('seqticks', 16);
      /* setSpeed(0) stops the simulation and NOT the daily rotation, which
         advances from wall-clock time in the frame loop — so the first attempt
         at this drifted several degrees between shutters and at telephoto that
         is a different place entirely. freeze() is what pins the surface. */
      await page.evaluate(() => window.__world.freeze(0));
      const v = VIEWS.find(q => q.name === arg('seqview', 'close-c')) || VIEWS[2];
      const yaw = sunYaw + v.dYaw;
      const pitch = Math.max(-1.35, Math.min(1.35, sunPitch * 0.7 + v.dPitch));
      await page.evaluate(vv => window.__world.setView(vv.yaw, vv.pitch, vv.zoom),
        { yaw, pitch, zoom: v.zoom });
      await page.waitForTimeout(2500);
      for (let k = 0; k < seq; k++) {
        if (k > 0) await page.evaluate(g => window.__world.growPlants(g), gap);
        /* the sheet is rebuilt on the next frame, not inside growPlants */
        await page.waitForTimeout(350);
        const f = path.join(ROOT, OUT, `${s.tag}-seq${String(k).padStart(2, '0')}.png`);
        await page.screenshot({ path: f });
      }
      console.log(`wrote ${seq} sequence frames ${gap} ecology ticks apart for ${s.tag}`);
    }

    for (const v of VIEWS) {
      const yaw = sunYaw + v.dYaw;
      /* the orbit clamps pitch, and near a solstice the sub-solar point is far
         enough off the equator that an offset could otherwise ask for more
         than the camera will give */
      const pitch = Math.max(-1.35, Math.min(1.35, sunPitch * 0.7 + v.dPitch));
      await page.evaluate(vv => window.__world.setView(vv.yaw, vv.pitch, vv.zoom),
        { yaw, pitch, zoom: v.zoom });
      /* the camera eases toward its target and the detail patch redraws on a
         later frame, so a shot taken immediately catches neither */
      await page.waitForTimeout(2500);
      const file = path.join(ROOT, OUT, `${s.tag}-${v.name}.png`);
      await page.screenshot({ path: file });
      console.log('wrote ' + path.relative(ROOT, file) + (errs.length ? '  ERRORS: ' + errs[0] : ''));
    }
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
