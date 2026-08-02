const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(); p.setDefaultTimeout(900000);
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  const r=await p.evaluate(()=>{
    const cv=document.getElementById('gl'), log=[];
    const mk=(t,X,Y)=>new PointerEvent(t,{pointerId:91,pointerType:'touch',clientX:X,clientY:Y,bubbles:true,cancelable:true});
    cv.dispatchEvent(mk('pointerdown',195,420));
    log.push(['after down', JSON.stringify(window.__world.holdState())]);
    for(let k=1;k<=5;k++){
      window.dispatchEvent(mk('pointermove',195+8*k,420));
      log.push(['after move '+k+' (x='+(195+8*k)+')', JSON.stringify(window.__world.holdState())]);
    }
    return log;
  });
  for(const [k,v] of r) console.log(k.padEnd(26), v);
  await b.close();
})();
