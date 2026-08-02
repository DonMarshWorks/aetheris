const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const p=await b.newPage({viewport:{width:250,height:250}}); p.setDefaultTimeout(900000);
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  for(const t of [1000,5000,20000,60000]){
    await p.evaluate(n=>window.__world.runWorld(Math.round(n/16),100,16), t===1000?1000:(t===5000?4000:(t===20000?15000:40000)));
    const h=await p.evaluate(()=>window.__world.hopScan());
    const sp=await p.evaluate(()=>window.__world.bodySpan(3));
    console.log('~'+t+' ticks: links '+h.links+
      '  longest parent-child hop '+h.longestDeg+' deg (a step is '+h.stepDeg+
      ', the widest legal '+h.legalMaxDeg+')  over limit: '+h.overLimit+
      '  | biggest body spans '+sp[0].spanDeg+' deg');
  }
  await b.close();
})();
