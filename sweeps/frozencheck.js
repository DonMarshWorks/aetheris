const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  for(const mult of [100,0.001]){
    const p=await b.newPage({viewport:{width:200,height:200}});
    p.setDefaultTimeout(600000);
    await p.goto('file://'+PAGE+'#seed=31337');
    await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
    await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
    const rows=[];
    for(let k=0;k<6;k++){
      await p.evaluate(([n,m])=>window.__world.runWorld(n,m,16),[200,mult]);
      const s=await p.evaluate(()=>({t:window.__world.S.time,ice:window.__world.S.stats.ice,
        ocean:window.__world.S.stats.ocean,sun:window.__world.sunDir()}));
      rows.push(s);
    }
    console.log('mult='+mult);
    console.log('  simTime(s)   ice%   ocean%   sunY (season/day marker)');
    for(const r of rows) console.log('  '+r.t.toFixed(1).padStart(10),
      (100*r.ice).toFixed(2).padStart(6),(100*r.ocean).toFixed(2).padStart(8),
      r.sun[1].toFixed(4).padStart(9));
    await p.close();
  }
  await b.close();
})();
