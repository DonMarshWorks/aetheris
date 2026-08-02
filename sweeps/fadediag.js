const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(); p.setDefaultTimeout(300000);
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  await p.evaluate(()=>window.__world.runWorld(200,100,16));
  await p.evaluate(()=>{window.__world.setView(1.42,0.26,1.0);});
  await p.waitForTimeout(1000);
  const spot=await p.evaluate(()=>{for(let x=40;x<=360;x+=4)for(let y=200;y<=700;y+=5){if(window.__world.pick(x,y)>=0)return{x,y};}return null;});
  await p.evaluate(([x,y])=>document.getElementById('gl').dispatchEvent(new PointerEvent('pointerdown',{pointerId:41,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),[spot.x,spot.y]);
  await p.waitForTimeout(400);
  console.log('held :', JSON.stringify(await p.evaluate(()=>window.__world.selected())));
  await p.evaluate(([x,y])=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:41,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),[spot.x,spot.y]);
  for(const w of [400,800,1200,1600]){
    await p.waitForTimeout(w===400?400:400);
    console.log('after lift +'+w+'ms:', JSON.stringify(await p.evaluate(()=>window.__world.selected())));
  }
  await b.close();
})();
