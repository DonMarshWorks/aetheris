const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const p=await b.newPage({viewport:{width:760,height:620}}); p.setDefaultTimeout(900000);
  await p.goto('file://'+PAGE+'#seed=31337&plants=0');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  await p.evaluate(()=>window.__world.advance(900,60));
  await p.evaluate(()=>{ document.getElementById('hud').classList.add('hidden');
                         window.__world.setView(1.0, 1.15, 0.18); window.__world.setSpeed(0); });
  await p.waitForTimeout(3000);
  await p.screenshot({path:path.resolve(__dirname,'ice-after.png')});
  console.log('wrote ice-after.png');
  await b.close();
})();
