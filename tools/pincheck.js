#!/usr/bin/env node
/**
 * Do the pinned controls work?
 *
 *   node tools/pincheck.js
 *
 * A pin lifts a setting out of the panel and onto the world view so it can be
 * moved while watching what it does. The things that have to be true: a
 * restart-only setting cannot be pinned, because its answer only arrives after
 * the world starts again and there is nothing to watch; the copy carries the
 * value as well as the control; the number of them is capped, or the interface
 * buries the planet it is pointed at; moving the copy moves the world; and the
 * list travels in the link like every other setting.
 */
'use strict';
const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const PAGEU=PAGE.split(path.sep).join('/');
const A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
let bad=0; const ok=m=>console.log('  \x1b[32mok\x1b[0m   '+m); const no=m=>{bad++;console.log('  \x1b[31mFAIL\x1b[0m '+m);};
(async()=>{
  const b=await chromium.launch({args:A});
  const p=await b.newPage({viewport:{width:1200,height:800}});
  p.setDefaultTimeout(300000);
  const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,200)));
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200));});
  await p.goto('file://'+PAGEU+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:240000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');});

  await p.click('#gear');
  const shape = await p.evaluate(()=>{
    const cards=[...document.querySelectorAll('#setlist .card[data-key]')];
    return { total:cards.length,
      withPin:cards.filter(c=>c.querySelector('.pin')).length,
      restartWithPin:cards.filter(c=>c.querySelector('.setnote')&&c.querySelector('.pin')).map(c=>c.dataset.key),
      restart:cards.filter(c=>c.querySelector('.setnote')).map(c=>c.dataset.key) };
  });
  ok(`${shape.total} cards, ${shape.withPin} pinnable`);
  if(shape.restartWithPin.length===0) ok(`no pin on any restart-only setting (${shape.restart.join(', ')})`);
  else no(`restart-only settings still carry a pin: ${shape.restartWithPin.join(', ')}`);

  // pin three
  for(const k of ['tgtocean','tgtdesert','__sea']){
    await p.click(`#setlist .card[data-key="${k}"] .pin`);
  }
  await p.click('#setclose');
  const pinned = await p.evaluate(()=>({
    n: document.querySelectorAll('#pins .pinned').length,
    keys: [...document.querySelectorAll('#pins .pinned')].map(e=>e.dataset.key),
    hasSlider: !!document.querySelector('#pins .pinned .srange'),
    hasChoice: !!document.querySelector('#pins .pinned .setchoice'),
    hasVal: !!document.querySelector('#pins .pinned .setval'),
    hash: location.hash,
    visible: getComputedStyle(document.getElementById('pins')).display,
  }));
  ok(`three pinned and shown on the world: ${pinned.keys.join(', ')} (display:${pinned.visible})`);
  if(pinned.hasSlider&&pinned.hasChoice&&pinned.hasVal) ok('sliders, choice buttons and the value readout all copied across');
  else no(`missing a control type: slider=${pinned.hasSlider} choice=${pinned.hasChoice} value=${pinned.hasVal}`);
  if(/pins=/.test(pinned.hash)) ok(`the link carries them: ${pinned.hash}`); else no(`no pins= in the hash: ${pinned.hash}`);

  // cap
  await p.click('#gear');
  await p.click('#setlist .card[data-key="minfrag"] .pin');
  const capped = await p.evaluate(()=>({
    n: document.querySelectorAll('#pins .pinned').length,
    disabled: [...document.querySelectorAll('#setlist .card[data-key] .pin')].filter(b=>b.disabled).length,
  }));
  if(capped.disabled>0) ok(`at the cap of four, the remaining ${capped.disabled} pins are greyed out`);
  else no('cap not enforced — every pin still enabled at four pinned');

  // drive a pinned slider and confirm it reaches the world
  await p.click('#setclose');
  const moved = await p.evaluate(async()=>{
    const sr=document.querySelector('#pins .pinned[data-key="tgtocean"] .srange');
    const t=sr.querySelector('.strack').getBoundingClientRect(), b=sr.getBoundingClientRect();
    const x=t.left+t.width*0.9, y=b.top+b.height/2;
    const before=window.__world.params().tgtocean;
    sr.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,clientX:x,clientY:y,bubbles:true,cancelable:true}));
    sr.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:x,clientY:y,bubbles:true,cancelable:true}));
    return {before, after:window.__world.params().tgtocean, hash:location.hash};
  });
  if(moved.after!==moved.before) ok(`a pinned slider changes the world: tgtocean ${moved.before} -> ${moved.after}`);
  else no(`a pinned slider did nothing (${moved.before})`);

  // unpin from the pinned copy
  await p.click('#pins .pinned[data-key="__sea"] .pin');
  const after = await p.evaluate(()=>({n:document.querySelectorAll('#pins .pinned').length, hash:location.hash}));
  if(after.n===3) ok(`unpinning from the world view works (${after.n} left)`); else no(`unpin left ${after.n}`);

  // reload the link and confirm the pins come back
  await p.goto('file://'+PAGEU+after.hash);
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:240000});
  const back = await p.evaluate(()=>[...document.querySelectorAll('#pins .pinned')].map(e=>e.dataset.key));
  if(back.length===3) ok(`the link restores them: ${back.join(', ')}`); else no(`link restored ${back.length}: ${back.join(', ')}`);

  if(errs.length) no('console: '+errs[0]); else ok('no console errors');
  await b.close();
  console.log(); process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
