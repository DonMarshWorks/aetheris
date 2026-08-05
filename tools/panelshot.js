#!/usr/bin/env node
/**
 * Photograph the overlays at the sizes people actually read them at.
 *
 *   node tools/panelshot.js --out docs/img/ui
 *
 * verify.js cannot see a layout. A deleted parameter once made every leaf a
 * bare rectangle while every check passed, so anything visual gets rendered
 * and looked at. The settings panel is a grid of cards whose whole claim is
 * that it reflows from a laptop to a phone, and the only way to know is to
 * look at it at both.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i === -1 ? d : process.argv[i + 1];
};
const PAGE = path.resolve(arg('page', path.join(ROOT, 'index.html')));
const OUT = path.resolve(arg('out', path.join(ROOT, 'docs', 'img', 'ui')));
const HASH = arg('hash', '#seed=31337');

const GL_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl',
];

const ALL = [
  { name: 'laptop',  w: 1512, h: 900,  touch: false },
  { name: 'desktop', w: 1920, h: 1080, touch: false },
  { name: 'tablet',  w: 820,  h: 1180, touch: true  },
  { name: 'phone',   w: 390,  h: 844,  touch: true  },
];
const want = arg('sizes');
const SIZES = want ? ALL.filter(s => want.split(',').includes(s.name)) : ALL;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: GL_ARGS });
  for (const s of SIZES) {
    const ctx = await browser.newContext({
      viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1,
      isMobile: s.touch, hasTouch: s.touch,
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(5 * 60 * 1000);
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await page.goto('file://' + PAGE + HASH);
    await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
      { timeout: 240000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('splash');
      return !el || el.classList.contains('gone');
    }, { timeout: 60000 });

    /* the world itself first, so a layout change that covered it would show */
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `world-${s.name}.png`) });

    /* And with controls pinned onto it, which is the layout most at risk of
       burying the thing it is pointed at. Four are asked for — the most the
       piece will ever carry — because the shot is only worth taking at the
       worst case the cap allows, and the cap answers differently on a phone
       than on a laptop. Buttons that have gone grey are simply not clicked. */
    await page.evaluate(() => {
      document.getElementById('gear').click();
      for (const k of ['tgtocean', 'tgtice', '__sea', 'tilt']) {
        const b = document.querySelector(`#setlist .card[data-key="${k}"] .pin`);
        if (b && !b.disabled) b.click();
      }
      document.getElementById('setclose').click();
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `pinned-${s.name}.png`) });

    /* the metrics overlay is a grid of the same cards now, so it gets looked
       at the same way */
    await page.click('#info');
    await page.waitForTimeout(1400);
    await page.screenshot({ path: path.join(OUT, `charts-${s.name}.png`) });
    await page.click('#chartclose');
    await page.waitForTimeout(200);

    await page.click('#gear');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `settings-${s.name}.png`) });

    /* and scrolled down, because the cards below the fold are the ones nobody
       looks at until they are wrong */
    const scrolled = await page.evaluate(() => {
      const l = document.getElementById('setlist');
      l.scrollTop = Math.round(l.scrollHeight * 0.45);
      return { top: l.scrollTop, height: l.scrollHeight, view: l.clientHeight };
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `settings-${s.name}-scrolled.png`) });

    const fit = await page.evaluate(() => {
      const d = document.documentElement;
      return { sw: d.scrollWidth, cw: d.clientWidth, sh: d.scrollHeight, ch: d.clientHeight };
    });
    console.log(`${s.name.padEnd(8)} ${s.w}x${s.h}  list ${scrolled.height}px in ` +
      `${scrolled.view}px  document ${fit.sw}x${fit.sh} vs viewport ${fit.cw}x${fit.ch}` +
      (fit.sw === fit.cw && fit.sh === fit.ch ? '' : '   *** OVERFLOW ***') +
      (errs.length ? '   ERRORS: ' + errs[0] : ''));
    await ctx.close();
  }
  await browser.close();
  console.log('\nwrote ' + path.relative(ROOT, OUT));
})().catch(e => { console.error(e); process.exit(1); });
