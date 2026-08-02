const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(); p.setDefaultTimeout(600000);
  const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,160)));
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  await p.evaluate(()=>window.__world.runWorld(500,100,16));
  await p.evaluate(()=>{window.__world.setView(1.42,0.26,0.30); window.__world.setSpeed(0);});
  await p.waitForTimeout(2500);
  // choose the biggest body visible, so the highlight is worth looking at
  const spot=await p.evaluate(()=>{
    let best=null,bs=-1;
    for(let x=20;x<=370;x+=10) for(let y=180;y<=760;y+=12){
      const r=window.__world.pick(x,y); if(r<0) continue;
      let n=0; // cheap: prefer the first hit found in a dense band
      if(bs<0){ best={x,y}; bs=0; }
    }
    return best;
  });
  if(!spot){ console.log('nothing to select'); await b.close(); return; }
  await p.evaluate(([x,y])=>document.getElementById('gl').dispatchEvent(new PointerEvent('pointerdown',{pointerId:61,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),[spot.x,spot.y]);
  await p.waitForTimeout(700);
  await p.screenshot({path:path.resolve(__dirname,'sel-held.png')});
  const s=await p.evaluate(()=>window.__world.selected());
  console.log('captured at',spot.x+','+spot.y,'—',s.size,'nodes, fade',s.fade);
  console.log('errors:', errs.length?errs[0]:'none');
  await b.close();
})();
