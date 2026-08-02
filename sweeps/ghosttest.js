const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(); p.setDefaultTimeout(900000);
  const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,160)));
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  await p.evaluate(()=>window.__world.runWorld(250,100,16));
  await p.evaluate(()=>{window.__world.setView(1.42,0.26,1.0); document.getElementById('playpause').click();});
  await p.waitForTimeout(1200);
  const spots=await p.evaluate(()=>{
    const out=[], seen=new Set();
    for(let x=30;x<=360;x+=7) for(let y=200;y<=700;y+=9){
      const r=window.__world.pick(x,y);
      if(r>=0 && !seen.has(r)){ seen.add(r); out.push({x,y,r}); }
    }
    return out.slice(0,5);
  });
  console.log('selecting '+spots.length+' different plants in turn, letting each fade fully;');
  console.log('after each, how many DISTINCT bodies carry the mark being shown?');
  for(const s of spots){
    await p.evaluate(([x,y])=>document.getElementById('gl').dispatchEvent(new PointerEvent('pointerdown',{pointerId:71,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),[s.x,s.y]);
    await p.waitForTimeout(300);
    const d=await p.evaluate(()=>window.__world.markedBodies());
    await p.evaluate(([x,y])=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:71,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),[s.x,s.y]);
    console.log('  press -> bodies carrying the shown mark:', d.bodies, ' nodes:', d.nodes,
                (d.bodies===1?'  ok':'  GHOSTS'));
    await p.waitForTimeout(3400);   // let it expire completely
  }
  console.log('errors:', errs.length?errs[0]:'none');
  await b.close();
})();
