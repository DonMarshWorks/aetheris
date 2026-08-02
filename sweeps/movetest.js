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
  await p.waitForTimeout(1000);
  const spot=await p.evaluate(()=>{for(let x=30;x<=360;x+=6)for(let y=200;y<=700;y+=8){if(window.__world.pick(x,y)>=0)return{x,y};}return null;});
  /* the whole gesture inside ONE evaluate, so it really happens inside the
     hold window — a round trip per move costs tens of milliseconds and the
     timer fires mid-gesture, which tests nothing */
  const gest=async(dx,label)=>{
    await p.evaluate(([x,y,dx])=>{
      const cv=document.getElementById('gl');
      const mk=(t,X)=>new PointerEvent(t,{pointerId:81,pointerType:'touch',clientX:X,clientY:y,bubbles:true,cancelable:true});
      cv.dispatchEvent(mk('pointerdown',x));
      for(let k=1;k<=5;k++) window.dispatchEvent(mk('pointermove',x+dx*k/5));
    },[spot.x,spot.y,dx]);
    await p.waitForTimeout(260);
    const sel=await p.evaluate(()=>window.__world.holdState().fired);
    await p.evaluate(([x,y,dx])=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:81,pointerType:'touch',clientX:x+dx,clientY:y,bubbles:true,cancelable:true})),[spot.x,spot.y,dx]);
    await p.waitForTimeout(3400);
    console.log('  moved '+String(dx).padStart(3)+'px within the hold -> '+(sel?'SELECTED':'no selection')+'  '+label);
  };
  console.log('a press that drifts should not take a plant:');
  await gest(0,  '(expected: selected)');
  await gest(4,  '(expected: selected — small jitter is fine)');
  await gest(12, '(expected: no selection)');
  await gest(40, '(expected: no selection)');
  console.log('errors:', errs.length?errs[0]:'none');
  await b.close();
})();
