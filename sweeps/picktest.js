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
  await p.evaluate(()=>window.__world.runWorld(600,100,16));
  await p.evaluate(()=>{window.__world.setView(1.42,0.26,0.35); window.__world.setSpeed(0);});
  await p.waitForTimeout(1500);
  // find the screen point sitting on the BIGGEST body in view
  const spot=await p.evaluate(()=>{
    let best=null;
    for(let x=30;x<=360;x+=6) for(let y=180;y<=700;y+=8){
      const r=window.__world.pick(x,y);
      if(r<0) continue;
      const sz=window.__world.S && 0;
      if(!best) best={x,y,r};
    }
    return best;
  });
  if(!spot){ console.log('nothing under the whole screen'); await b.close(); return; }
  const press=async(x,y,ms)=>{
    await p.evaluate(([x,y])=>{const cv=document.getElementById('gl');
      cv.dispatchEvent(new PointerEvent('pointerdown',{pointerId:21,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));},[x,y]);
    await p.waitForTimeout(ms);
    await p.evaluate(([x,y])=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:21,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),[x,y]);
    await p.waitForTimeout(400);
    return p.evaluate(()=>({sel:document.getElementById('selinfo').textContent,
                            hudShown:!document.getElementById('hud').classList.contains('hidden'),
                            s:window.__world.selected()}));
  };
  let r=await press(spot.x,spot.y,800);
  console.log(`long press at ${spot.x},${spot.y} -> "${r.sel}"  (root ${r.s.root}, ${r.s.size} nodes)  hud shown: ${r.hudShown}`);
  await p.screenshot({path:path.resolve(__dirname,'pick-selected.png')});
  r=await press(spot.x,spot.y,800);
  console.log('long press again on the same plant ->', r.sel? `"${r.sel}"` : 'cleared');
  const before=await p.evaluate(()=>!document.getElementById('hud').classList.contains('hidden'));
  r=await press(spot.x,spot.y,120);
  console.log('quick tap -> selection', r.sel?`"${r.sel}"`:'(none)', '| hud toggled:', before!==r.hudShown);
  console.log('errors:',errs.length?errs[0]:'none');
  await b.close();
})();
