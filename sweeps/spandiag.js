const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const p=await b.newPage({viewport:{width:250,height:250}}); p.setDefaultTimeout(600000);
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  for(const ticks of [2000, 8000]){
    await p.evaluate(t=>window.__world.runWorld(Math.round(t/16),100,16), ticks);
    const r=await p.evaluate(()=>window.__world.bodySpan(10));
    console.log('after ~'+ticks+' ecology ticks — the 10 biggest bodies:');
    console.log('   root   nodes   span(deg)  parent-linked across the span?');
    for(const d of r) console.log('  '+String(d.root).padStart(6), String(d.nodes).padStart(6),
      String(d.spanDeg).padStart(11), (d.joined?'yes':'NO').padStart(9));
    console.log();
  }
  await b.close();
})();
