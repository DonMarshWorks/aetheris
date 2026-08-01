const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  for(const [name,w,h] of [['iphone',390,844],['desktop',1440,900]]){
    const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:w<500,hasTouch:true});
    const p=await ctx.newPage(); p.setDefaultTimeout(300000);
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('file://'+PAGE+'#seed=31337');
    await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
    await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
    // how far does a 100px drag move the view, at each zoom?
    const out=[];
    for(const z of [1.0,0.50,0.30,0.20,0.11,0.05,0.02]){
      const r=await p.evaluate(zz=>{
        window.__world.setView(1.42,0.26,zz);
        const c=window.__world.cam(), before=c.tYaw;
        const mk=(t,x,y)=>new PointerEvent(t,{pointerId:5,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true});
        const cv=document.getElementById('gl');
        cv.dispatchEvent(mk('pointerdown',200,400));
        for(let k=1;k<=10;k++) window.dispatchEvent(mk('pointermove',200+k*10,400));
        window.dispatchEvent(mk('pointerup',300,400));
        const c2=window.__world.cam();
        return {dYaw:Math.abs(c2.tYaw-before), dist:c2.dist};
      },z);
      out.push(z+':'+r.dYaw.toFixed(4)+' ('+(100*r.dYaw/(2*Math.PI)).toFixed(1)+'% of a turn)');
    }
    console.log(name,'yaw radians per 100px drag —',out.join('  '),' errors:',errs.length?errs[0]:'none');
    // does panning work while locked?
    const locked=await p.evaluate(()=>{
      window.__world.setView(1.42,0.26,0.20);
      document.getElementById('lock').click();
      const c=window.__world.cam();
      const mk=(t,x,y)=>new PointerEvent(t,{pointerId:6,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true});
      const cv=document.getElementById('gl');
      const b4=c.tYaw;
      cv.dispatchEvent(mk('pointerdown',200,400));
      for(let k=1;k<=10;k++) window.dispatchEvent(mk('pointermove',200+k*10,400));
      window.dispatchEvent(mk('pointerup',300,400));
      return {moved:Math.abs(window.__world.cam().tYaw-b4)};
    });
    console.log('   locked drag moved target yaw by',locked.moved.toFixed(4),'rad (0 would mean panning is dead)');
    await ctx.close();
  }
  await b.close();
})();
