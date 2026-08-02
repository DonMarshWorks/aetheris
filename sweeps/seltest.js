const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(); p.setDefaultTimeout(300000);
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  await p.evaluate(()=>window.__world.runWorld(200,100,16));
  await p.evaluate(()=>{window.__world.setView(1.42,0.26,1.0); window.__world.setSpeed(0);});
  await p.waitForTimeout(1200);
  const spot=await p.evaluate(()=>{
    for(let x=40;x<=360;x+=4) for(let y=200;y<=700;y+=5){ if(window.__world.pick(x,y)>=0) return {x,y}; }
    return null;
  });
  if(!spot){ console.log('no plant in view'); await b.close(); return; }
  const down=(x,y,id)=>p.evaluate(([x,y,id])=>document.getElementById('gl').dispatchEvent(
    new PointerEvent('pointerdown',{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),[x,y,id]);
  const move=(x,y,id)=>p.evaluate(([x,y,id])=>window.dispatchEvent(
    new PointerEvent('pointermove',{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),[x,y,id]);
  const up=(x,y,id)=>p.evaluate(([x,y,id])=>window.dispatchEvent(
    new PointerEvent('pointerup',{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),[x,y,id]);
  const st=()=>p.evaluate(()=>({...window.__world.selected(),
     badge:+getComputedStyle(document.getElementById('selbadge')).opacity,
     txt:document.getElementById('selbadge').textContent,
     pos:document.getElementById('selbadge').style.transform}));

  await down(spot.x,spot.y,31); await p.waitForTimeout(160);
  console.log('at 160ms (before the hold matures):', JSON.stringify(await st()));
  await p.waitForTimeout(180);
  let a=await st(); console.log('at 340ms:', JSON.stringify(a));
  // jitter, then a real drag, while still down
  await move(spot.x+6,spot.y+4,31); await move(spot.x+70,spot.y+30,31);
  await p.waitForTimeout(300);
  let held=await st(); console.log('after dragging 70px with the finger still down:', JSON.stringify(held));
  await up(spot.x+70,spot.y+30,31);
  await p.waitForTimeout(1200); let f1=await st();
  await p.waitForTimeout(1400); let f2=await st();
  console.log('1.2s after lifting:', f1.fade, ' badge', f1.badge);
  console.log('2.6s after lifting:', f2.fade, ' badge', f2.badge);
  await p.waitForTimeout(900);
  console.log('3.5s after lifting:', JSON.stringify(await st()));
  // near the edge: badge must stay on screen
  // the hit nearest a corner, to check the badge is held inside the window
  const corner=await p.evaluate(()=>{
    let best=null,bd=1e9;
    for(let x=6;x<=384;x+=4) for(let y=150;y<=830;y+=6){
      if(window.__world.pick(x,y)<0) continue;
      const d=Math.min(x,390-x)+Math.min(y,844-y);
      if(d<bd){bd=d;best={x,y};}
    }
    return best;
  });
  if(corner){
    await down(corner.x,corner.y,32); await p.waitForTimeout(340);
    const edge=await p.evaluate(()=>{
      const b=document.getElementById('selbadge').getBoundingClientRect();
      return {l:Math.round(b.left),t:Math.round(b.top),r:Math.round(b.right),bo:Math.round(b.bottom),
              w:innerWidth,h:innerHeight};
    });
    await up(corner.x,corner.y,32);
    const inside = edge.l>=0 && edge.t>=0 && edge.r<=edge.w && edge.bo<=edge.h;
    console.log(`press at ${corner.x},${corner.y} (nearest a corner) -> badge box`,
                JSON.stringify(edge), ' fully on screen:', inside);
  }
  console.log('errors:', errs.length?errs[0]:'none');
  await b.close();
})();
