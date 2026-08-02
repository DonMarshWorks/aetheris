const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(); p.setDefaultTimeout(300000);
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  await p.evaluate(()=>window.__world.runWorld(600,100,16));
  await p.evaluate(()=>{window.__world.setSpeed(0);});
  for(const z of [1.0,0.35]){
    await p.evaluate(zz=>window.__world.setView(1.42,0.26,zz), z);
    await p.waitForTimeout(1200);
    const r=await p.evaluate(()=>{
      let hits=0, tried=0, sizes=[];
      for(let x=40;x<=350;x+=20) for(let y=200;y<=700;y+=25){
        tried++; const b=window.__world.pick(x,y);
        if(b>=0){hits++; if(sizes.length<5) sizes.push(b);}
      }
      return {tried,hits,sizes};
    });
    console.log('zoom',z,'— probes',r.tried,'hits',r.hits,'('+(100*r.hits/r.tried).toFixed(0)+'%)');
  }
  console.log('errors:',errs.length?errs[0]:'none');
  await b.close();
})();
