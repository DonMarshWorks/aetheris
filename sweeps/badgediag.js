const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(); p.setDefaultTimeout(300000);
  const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,160)));
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  await p.evaluate(()=>window.__world.runWorld(25,100,16));   // few plants: frames stay fast
  await p.evaluate(()=>window.__world.setView(1.42,0.26,1.0));
  await p.waitForTimeout(900);
  const spot=await p.evaluate(()=>{
    for(let x=6;x<=384;x+=3) for(let y=150;y<=830;y+=4){ if(window.__world.pick(x,y)>=0) return {x,y}; }
    return null;
  });
  if(!spot){ console.log('no plant found'); await b.close(); return; }
  const st=()=>p.evaluate(()=>({fade:window.__world.selected().fade,
    frames:window.__world.selected().frames,
    badge:+getComputedStyle(document.getElementById('selbadge')).opacity,
    txt:document.getElementById('selinfo').textContent}));
  await p.evaluate(([x,y])=>document.getElementById('gl').dispatchEvent(new PointerEvent('pointerdown',{pointerId:51,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),[spot.x,spot.y]);
  await p.waitForTimeout(350);
  console.log('held      :', JSON.stringify(await st()));
  await p.evaluate(([x,y])=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:51,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),[spot.x,spot.y]);
  for(const w of [700,1400,2100,3200]){ await p.waitForTimeout(700); console.log('+'+w+'ms  :', JSON.stringify(await st())); }
  console.log('errors:', errs.length?errs[0]:'none');
  await b.close();
})();
