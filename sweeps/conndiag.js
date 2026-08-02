const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const p=await b.newPage({viewport:{width:300,height:300}}); p.setDefaultTimeout(600000);
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  await p.evaluate(()=>window.__world.runWorld(1200,100,16));
  const r=await p.evaluate(()=>window.__world.bodyDiag(12));
  console.log('For the 12 largest bodies: are their nodes one connected piece,');
  console.log('and how far apart are the spatial clumps?');
  console.log(' body   nodes  wood  parentGraph  spatialClumps  biggestGap(steps)');
  for(const d of r) console.log('  '+String(d.root).padStart(6), String(d.alive).padStart(6),
    String(d.wood).padStart(5), (d.connected?'connected':'SPLIT').padStart(12),
    String(d.clumps).padStart(14), d.gap.toFixed(1).padStart(17));
  await b.close();
})();
