const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const p=await b.newPage({viewport:{width:220,height:220}}); p.setDefaultTimeout(900000);
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  for(const t of [3000,12000,30000]){
    await p.evaluate(n=>window.__world.runWorld(Math.round(n/16),100,16),
                     t===3000?3000:(t===12000?9000:18000));
    const r=await p.evaluate(()=>window.__world.overlapScan());
    console.log('~'+String(t).padStart(5)+' ticks  live '+String(r.live).padStart(6)+
      '  sampled '+String(r.sampled).padStart(5)+
      '  pairs closer than the exclusion radius: '+r.tooClosePairs+
      (r.tooClosePairs? '  worst '+r.worstOverlapPct+'% inside':'') +
      '   | paint width / step = '+r.paintOverStep);
  }
  await b.close();
})();
