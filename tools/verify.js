#!/usr/bin/env node
/**
 * Aetheris verification harness.
 *
 *   npm i          (once)
 *   npm run verify
 *
 * Renders in software (SwiftShader) so results are deterministic on any
 * machine, which makes it slow — a few minutes is normal. It checks the things
 * that have actually broken before, not just that the page loads.
 *
 * Exit code 0 = all good, 1 = something regressed.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'index.html');
const PORT = 8123;

const GL_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl',
];

let failures = 0;
const pass = m => console.log('  \x1b[32mok\x1b[0m   ' + m);
const fail = m => { failures++; console.log('  \x1b[31mFAIL\x1b[0m ' + m); };
const check = (cond, m) => cond ? pass(m) : fail(m);
const section = t => console.log('\n\x1b[1m' + t + '\x1b[0m');

/* ────────────────────────────────────────────────────────────────────────
   1. Static scan — catches whole bug classes without rendering anything
   ──────────────────────────────────────────────────────────────────────── */
/* Shader source lives in template literals. Pair backticks naively — the
   shaders contain ${...} interpolation but never a backtick. */
function glslRegions(src) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf('`', i)) !== -1) {
    const end = src.indexOf('`', i + 1);
    if (end === -1) break;
    const body = src.slice(i + 1, end);
    if (/#version 300 es|precision highp float|vec3 hash33/.test(body)) out.push(body);
    i = end + 1;
  }
  return out;
}

function staticScan() {
  section('Static scan');
  const src = fs.readFileSync(PAGE, 'utf8');
  const shaders = glslRegions(src);
  check(shaders.length >= 4, `found ${shaders.length} shader sources to scan`);

  // Reversed smoothstep is undefined in GLSL and fails silently on some
  // drivers — this exact bug hid the entire starfield once. It must only be
  // flagged inside shader source: the JS helper of the same name handles
  // descending edges correctly and is used that way on purpose.
  const bad = [];
  const re = /smoothstep\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,/g;
  for (const shader of glslRegions(src)) {
    let m;
    while ((m = re.exec(shader))) {
      if (parseFloat(m[1]) >= parseFloat(m[2])) bad.push(m[0] + ')');
    }
  }
  check(bad.length === 0,
    bad.length ? `reversed smoothstep in GLSL (undefined behaviour): ${bad.join('; ')}`
               : 'no reversed smoothstep in shader code');

  // A backtick anywhere inside shader source closes the template literal the
  // shader lives in, and the rest of the file becomes JavaScript. It reads as
  // an ordinary prose comment, so it is easy to write and impossible to spot.
  // Every full shader declares a version, so a region that opens with one and
  // never reaches its entry point was cut short by a stray backtick.
  const truncated = shaders.filter(s => /#version 300 es/.test(s) && !/void\s+main\s*\(/.test(s));
  check(truncated.length === 0,
    truncated.length ? 'shader source truncated — stray backtick inside a shader comment'
                     : 'no stray backticks inside shader source');

  check(!/REPLACE_USER/.test(src), 'no unsubstituted URL placeholders');
  check(!/window\.__(cam|ptrCount|tapDbg)\s*=/.test(src), 'no stray debug globals');
  check((src.match(/touch-action:\s*none/g) || []).length >= 2,
    'touch-action:none on body and canvas');
  check(/user-scalable=no/.test(src), 'page zoom disabled');
  check(/const ptrs = new Map/.test(src), 'pointer-map input present');
  check(/clearPointers/.test(src), 'lost-pointer recovery present');

  // The site must be self-contained. Only things the browser actually
  // *fetches* count — og:/canonical metadata carries absolute URLs by design.
  const fetched = [
    ...[...src.matchAll(/<script\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi)].map(x => x[1]),
    ...[...src.matchAll(/<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi)].map(x => x[1]),
    ...[...src.matchAll(/<link\b[^>]*\brel\s*=\s*"(?:stylesheet|preload|prefetch)"[^>]*\bhref\s*=\s*"([^"]+)"/gi)].map(x => x[1]),
    ...[...src.matchAll(/@import\s+(?:url\()?["']([^"']+)/gi)].map(x => x[1]),
  ].filter(u => !u.startsWith('data:'));
  check(fetched.length === 0,
    fetched.length ? `fetched resources: ${fetched.join(', ')}` : 'nothing fetched from markup');
}

/* ────────────────────────────────────────────────────────────────────────
   2. Boot across seeds — every world must open balanced
   ──────────────────────────────────────────────────────────────────────── */
const BOUNDS = {
  ocean:  [0.60, 0.67],
  ice:    [0.04, 0.15],
  forest: [0.02, 0.30],
  grass:  [0.02, 0.30],
  desert: [0.01, 0.25],
};
function inBounds(stats) {
  return Object.entries(BOUNDS).every(([k, [lo, hi]]) => stats[k] >= lo && stats[k] <= hi);
}
const pct = v => (v * 100).toFixed(1) + '%';

async function bootSeeds(browser) {
  section('Boot across seeds');
  for (const seed of ['', '#seed=7', '#seed=999', '#seed=31337', '#seed=424242']) {
    const page = await browser.newPage({ viewport: { width: 420, height: 420 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

    await page.goto('file://' + PAGE + seed);
    await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0,
      { timeout: 180000 });
    const s = await page.evaluate(() => window.__world.S.stats);

    const label = seed || '(random)';
    check(errs.length === 0, `${label} — no console errors` + (errs.length ? `: ${errs[0]}` : ''));
    check(inBounds(s),
      `${label} — balanced  sea ${pct(s.ocean)} ice ${pct(s.ice)} ` +
      `forest ${pct(s.forest)} grass ${pct(s.grass)} desert ${pct(s.desert)}`);
    await page.close();
  }
}

/* ────────────────────────────────────────────────────────────────────────
   3. Homeostasis — the whole point of the piece
   ──────────────────────────────────────────────────────────────────────── */
async function homeostasis(browser) {
  section('Homeostasis over a simulated hour');
  const page = await browser.newPage({ viewport: { width: 420, height: 420 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + PAGE + '#seed=31337');
  await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0, { timeout: 180000 });

  let worst = null;
  for (const mark of [1200, 2400, 3600]) {
    await page.evaluate(d => window.__world.advance(d, Math.round(d / 12)), 1200);
    const s = await page.evaluate(() => window.__world.S.stats);
    const ok = inBounds(s);
    if (!ok) worst = s;
    check(ok, `+${mark / 60} min — sea ${pct(s.ocean)} ice ${pct(s.ice)} ` +
              `forest ${pct(s.forest)} grass ${pct(s.grass)} desert ${pct(s.desert)}`);
  }
  check(errs.length === 0, 'no errors while fast-forwarding');
  if (worst) console.log('       out-of-bounds snapshot:', JSON.stringify(worst));
  await page.close();
}

/* ────────────────────────────────────────────────────────────────────────
   4. Served over HTTP — how it actually ships
   ──────────────────────────────────────────────────────────────────────── */
function serve() {
  const types = { '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png',
                  '.md': 'text/plain', '.js': 'text/javascript' };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(PORT, '127.0.0.1', () => r(server)));
}

async function served(browser) {
  section('Served over HTTP');
  const server = await serve();
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const external = [];
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('request', r => {
    const u = r.url();
    if (!u.startsWith(`http://127.0.0.1:${PORT}`) && !u.startsWith('data:')) external.push(u);
  });

  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0, { timeout: 180000 });

  check(external.length === 0,
    external.length ? `external requests: ${external.join(', ')}` : 'zero external requests');
  check(errs.length === 0, 'no console errors' + (errs.length ? `: ${errs[0]}` : ''));

  const meta = await page.evaluate(() => ({
    title: document.title,
    og: document.querySelector('meta[property="og:image"]')?.content || '',
    icon: !!document.querySelector('link[rel="icon"]'),
  }));
  check(meta.title.length > 0, `title: ${meta.title}`);
  check(/^https:\/\/[a-z0-9-]+\.github\.io\//.test(meta.og), `og:image lowercase host: ${meta.og}`);
  check(meta.icon, 'favicon present');

  await page.close();
  server.close();
}

/* ────────────────────────────────────────────────────────────────────────
   5. Touch — pinch must move only the planet, and must not jerk rotation
   ──────────────────────────────────────────────────────────────────────── */
async function touch(browser) {
  section('Touch (emulated 390×844)');
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + PAGE + '#seed=31337');
  await page.waitForFunction(() => window.__world && window.__world.S.epoch0 > 0, { timeout: 180000 });
  await page.evaluate(() => window.__world.freeze(1.1));

  const box = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight,
  }));
  check(box.sw === box.cw && box.sh === box.ch, 'no document overflow (no scrollbars)');

  const cam = () => page.evaluate(() => {
    const c = window.__world.cam();
    return { yaw: +c.yaw.toFixed(5), pitch: +c.pitch.toFixed(5), zoom: +c.zoom.toFixed(5) };
  });
  const cdp = await ctx.newCDPSession(page);
  const t = (type, pts) => cdp.send('Input.dispatchTouchEvent',
    { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: q.length > 2 ? q[2] : i })) });

  const before = await cam();
  await t('touchStart', [[195, 420, 0]]);            await page.waitForTimeout(120);
  const oneDown = await cam();
  await t('touchStart', [[195, 420, 0], [195, 520, 1]]); await page.waitForTimeout(120);
  const pinchStart = await cam();
  const jump = Math.abs(pinchStart.yaw - oneDown.yaw) + Math.abs(pinchStart.pitch - oneDown.pitch);
  check(jump < 1e-4, `rotation does not jump when the second finger lands (${jump.toFixed(6)})`);

  for (let k = 1; k <= 6; k++) {
    await t('touchMove', [[195, 420 - k * 18, 0], [195, 520 + k * 18, 1]]);
    await page.waitForTimeout(60);
  }
  const spread = await cam();
  check(spread.zoom < before.zoom, `pinching apart zooms in (${before.zoom} → ${spread.zoom})`);
  await t('touchEnd', [[195, 420 - 108, 0]]);
  await t('touchEnd', [[195, 520 + 108, 1]]);
  await page.waitForTimeout(200);

  const scale = await page.evaluate(() => ({
    s: window.visualViewport ? +window.visualViewport.scale.toFixed(3) : 1,
    x: scrollX, y: scrollY,
  }));
  check(scale.s === 1 && scale.x === 0 && scale.y === 0, 'page itself never zoomed or scrolled');

  // tap toggles the interface; a drag must not
  const tap = await page.evaluate(() => {
    const c = document.getElementById('gl'), h = document.getElementById('hud');
    const was = h.classList.contains('hidden');
    const o = { pointerId: 97, pointerType: 'touch', clientX: 195, clientY: 300, bubbles: true, cancelable: true };
    c.dispatchEvent(new PointerEvent('pointerdown', o));
    window.dispatchEvent(new PointerEvent('pointerup', o));
    return was !== h.classList.contains('hidden');
  });
  check(tap, 'tap toggles the interface');

  const dragged = await page.evaluate(() => {
    const c = document.getElementById('gl'), h = document.getElementById('hud');
    const was = h.classList.contains('hidden');
    const mk = (t, x, y) => new PointerEvent(t, { pointerId: 98, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true });
    c.dispatchEvent(mk('pointerdown', 195, 300));
    for (let k = 1; k <= 8; k++) window.dispatchEvent(mk('pointermove', 195 + k * 9, 300 + k * 3));
    window.dispatchEvent(mk('pointerup', 267, 324));
    return was === h.classList.contains('hidden');
  });
  check(dragged, 'a drag does not toggle the interface');
  check(errs.length === 0, 'no errors during touch' + (errs.length ? `: ${errs[0]}` : ''));

  await ctx.close();
}

/* ──────────────────────────────────────────────────────────────────────── */
(async () => {
  if (process.argv.includes('--static')) { staticScan(); process.exit(failures ? 1 : 0); }
  staticScan();
  const browser = await chromium.launch({ args: GL_ARGS });
  try {
    await bootSeeds(browser);
    await homeostasis(browser);
    await served(browser);
    await touch(browser);
  } finally {
    await browser.close();
  }
  console.log();
  if (failures) { console.log(`\x1b[31m${failures} check(s) failed\x1b[0m`); process.exit(1); }
  console.log('\x1b[32mAll checks passed\x1b[0m');
})().catch(e => { console.error(e); process.exit(1); });
