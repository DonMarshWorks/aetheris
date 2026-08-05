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
 *
 * The cap is not a number and this asserts the rule rather than a copy of it.
 * The column may bury at most a quarter of the disc and may never reach the
 * readout, so the world is asked what it settled on at four window shapes and
 * the two conditions are checked against the limit the page itself reports.
 * The squat window is in there deliberately: it clears the planet entirely and
 * still lands on the clock, which is the case a width breakpoint cannot see.
 */
'use strict';
const path=require('path'); const {chromium, devices}=require('playwright');
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

  // A real DRAG on a pinned slider, which is what the click test above misses.
  // The strip used to be rebuilt on every input, which replaced the element the
  // pointer was captured on, so the thumb froze on the first pixel of travel
  // and the click test passed anyway because a click is one event.
  const dragged = await p.evaluate(async () => {
    const sr = document.querySelector('#pins .pinned[data-key="tgtocean"] .srange');
    const t = sr.querySelector('.strack').getBoundingClientRect();
    const b = sr.getBoundingClientRect();
    const y = b.top + b.height / 2;
    const at = f => t.left + t.width * f;
    const ev = (type, x) => new PointerEvent(type,
      { pointerId: 7, clientX: x, clientY: y, bubbles: true, cancelable: true });
    sr.dispatchEvent(ev('pointerdown', at(0.15)));
    const start = window.__world.params().tgtocean;
    const seen = [];
    for (const f of [0.3, 0.45, 0.6, 0.75, 0.9]) {
      sr.dispatchEvent(ev('pointermove', at(f)));
      seen.push(window.__world.params().tgtocean);
    }
    sr.dispatchEvent(ev('pointerup', at(0.9)));
    return { start, seen, end: window.__world.params().tgtocean,
             stillThere: document.body.contains(sr) };
  });
  /* The signature is not "it stopped moving" — a rebuilt slider is DETACHED, so
     its track measures zero, every position clamps to the far end, and the
     value pins at the maximum on the first move. That reads as monotone and
     as a big change, and a weaker assertion passed it. What cannot be faked is
     the spread: five moves across the track must give five different values. */
  const distinct = new Set(dragged.seen).size;
  if (distinct === dragged.seen.length && dragged.stillThere)
    ok(`a pinned slider tracks a drag the whole way: ${dragged.start} -> ${dragged.seen.join(' -> ')}`);
  else
    no(`a pinned slider does not follow the drag: ${dragged.start} -> ${dragged.seen.join(' -> ')} ` +
       `(${distinct} distinct of ${dragged.seen.length}; the element it was captured on ` +
       `${dragged.stillThere ? 'survived' : 'was REPLACED mid-drag'})`);

  // unpin from the pinned copy
  await p.click('#pins .pinned[data-key="__sea"] .pin');
  const after = await p.evaluate(()=>({n:document.querySelectorAll('#pins .pinned').length, hash:location.hash}));
  if(after.n===3) ok(`unpinning from the world view works (${after.n} left)`); else no(`unpin left ${after.n}`);

  // reload the link and confirm the pins come back
  await p.goto('file://'+PAGEU+after.hash);
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:240000});
  const back = await p.evaluate(()=>[...document.querySelectorAll('#pins .pinned')].map(e=>e.dataset.key));
  if(back.length===3) ok(`the link restores them: ${back.join(', ')}`); else no(`link restored ${back.length}: ${back.join(', ')}`);

  // Toggling a pin must not rebuild the list it lives in.
  //
  // Reported from an iPhone as "you can't disable a pin once you have enabled
  // it", and the fix was not the button: the handler called buildSettings(),
  // which begins by emptying #setlist — a scroll container with
  // -webkit-overflow-scrolling:touch. On iOS that collapses scrollHeight to
  // zero and takes scrollTop with it, so the list jumps to the top and the
  // second tap lands on a different card. It cannot be caught by asserting the
  // VALUE changed, because it does; what has to be asserted is that the element
  // survived and the list did not move. Chromium restores scroll across a
  // content swap, which is why the first emulated test of this passed and
  // proved nothing — so the check is on identity, which is browser-independent.
  await p.setViewportSize({width:390, height:844});
  await p.goto('file://'+PAGEU+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:240000});
  await p.click('#gear');
  const survived = await p.evaluate(async () => {
    const key = 'tilt';
    const card = () => document.querySelector(`#setlist .card[data-key="${key}"]`);
    card().scrollIntoView({block:'center'});
    await new Promise(r => requestAnimationFrame(r));
    const list = document.getElementById('setlist');
    const before = { top: Math.round(list.scrollTop), pin: card().querySelector('.pin'),
                     y: Math.round(card().getBoundingClientRect().y) };
    before.pin.click();                                  // pin it
    const mid = { top: Math.round(list.scrollTop), same: card().querySelector('.pin') === before.pin,
                  y: Math.round(card().getBoundingClientRect().y),
                  pinned: window.__world.pins().list.includes(key) };
    card().querySelector('.pin').click();                // and off again
    return { before, mid, off: !window.__world.pins().list.includes(key) };
  });
  /* Closed explicitly. goto() to a URL differing only in its hash is a
     SAME-DOCUMENT navigation — it does not reload, so a panel left open here
     stays open and intercepts the next click on the world behind it. */
  await p.click('#setclose');
  if (survived.mid.same && survived.mid.top === survived.before.top &&
      survived.mid.y === survived.before.y && survived.mid.pinned && survived.off)
    ok(`pinning does not rebuild the list under your finger: the same button ` +
       `survives, the card stays at y=${survived.before.y}, and a second tap unpins`);
  else
    no(`pinning disturbs the list: button ${survived.mid.same ? 'survived' : 'was REPLACED'}, ` +
       `scrollTop ${survived.before.top} -> ${survived.mid.top}, ` +
       `card y ${survived.before.y} -> ${survived.mid.y}, unpinned ${survived.off}`);

  // Can a finger actually hit it? The pin is a 22px mark, which is a mark and
  // not a target: Apple asks for 44, and the reason bites hardest here because
  // this button sits inside a list with touch-action:pan-y, so a tap that
  // drifts a pixel is taken for the start of a scroll and the click is never
  // delivered. Reported from an iPhone as "you can't disable a pin once you
  // have enabled it" — which is what intermittent misses look like from the
  // outside, since pinning and unpinning are the same tap on the same square.
  /* In a context that actually reports a COARSE pointer. The enlarged target is
     behind @media (pointer: coarse) — it is for fingers and a mouse does not
     need it — so measuring it on the desktop page tests a rule that deliberately
     does not apply there, and duly reported nothing at all. A phone context is
     part of the claim, not a convenience. */
  const touchCtx = await b.newContext({ ...devices['iPhone 13'], hasTouch:true, isMobile:true });
  const tp = await touchCtx.newPage(); tp.setDefaultTimeout(300000);
  await tp.goto('file://'+PAGEU+'#seed=31337');
  await tp.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:240000});
  await tp.tap('#gear');
  const reach = await tp.evaluate(()=>{
    const b=document.querySelector('#setlist .card[data-key] .pin');
    const r=b.getBoundingClientRect(), cx=r.x+r.width/2, cy=r.y+r.height/2;
    let far=0;
    for(let d=1; d<=30; d++){
      const el=document.elementFromPoint(cx+d, cy+d);
      if(el && el.closest('.pin')) far=d; else break;
    }
    return {mark:Math.round(r.width), reach:2*far,
            coarse:matchMedia('(pointer: coarse)').matches};
  });
  await touchCtx.close();
  if(!reach.coarse) no('the touch context did not report a coarse pointer, so this ' +
                       'measured the desktop rule and proves nothing');
  // the diagonal reach in each direction, so the effective square is 2*far
  if(reach.reach >= 34)
    ok(`the pin can be hit off-centre: a ${reach.mark}px mark with about `+
       `${reach.reach}px of reach across the diagonal`);
  else
    no(`the pin is only ${reach.reach}px across the diagonal — a fingertip that `+
       `lands off-centre misses it, and inside a pan-y scroller a near miss is `+
       `read as a scroll and never becomes a click`);

  // What the cap comes to, at four window shapes. Four pins are asked for every
  // time and the world is asked what it kept — the limits come from the page so
  // that changing them here cannot make a broken layout pass.
  const FOUR = 'tgtocean,tgtice,__sea,tilt';
  const kept = [];
  for(const s of [{n:'phone',      w:390,  h:844},
                  {n:'small phone',w:360,  h:640},
                  {n:'tablet',     w:820,  h:1180},
                  {n:'squat',      w:1000, h:500}]){
    await p.setViewportSize({width:s.w, height:s.h});
    /* A distinct URL per shape, because navigating to one that differs only in
       its hash is a SAME-DOCUMENT navigation: the page does not reload, the
       pins are not re-read from the link, and every shape after the first was
       measuring the state the previous one left behind. */
    await p.goto('file://'+PAGEU+'#seed=31337&shape='+s.n.replace(/\W/g,'')+'&pins='+FOUR);
    await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:240000});
    const r = await p.evaluate(()=>window.__world.pins());
    kept.push({...s, r});
    const line = `${s.n} ${s.w}x${s.h}: kept ${r.list.length} of ${r.max}, `+
                 `${(100*r.cover).toFixed(0)}% of the disc, `+
                 `bottom ${r.bottom|0} against a readout at ${r.readout|0}`;
    if(r.cover > r.limit + 1e-3) no(`${line} — over the ${100*r.limit}% limit`);
    else if(r.bottom > r.readout) no(`${line} — into the readout`);
    else if(!r.list.length) no(`${line} — nothing kept at all`);
    else ok(line);
  }
  // and the point of all of it: a phone carries fewer than a tablet does
  const byName = Object.fromEntries(kept.map(k=>[k.n,k.r.list.length]));
  if(byName['small phone'] < byName.phone && byName.phone < byName.tablet)
    ok(`fewer on a smaller screen: ${byName['small phone']} / ${byName.phone} / `+
       `${byName.tablet} on the small phone, the phone and the tablet`);
  else
    no(`the cap did not respond to the window: ${byName['small phone']} / `+
       `${byName.phone} / ${byName.tablet}`);

  if(errs.length) no('console: '+errs[0]); else ok('no console errors');
  await b.close();
  console.log(); process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
