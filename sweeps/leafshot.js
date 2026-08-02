const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const p=await b.newPage({viewport:{width:640,height:640}}); p.setDefaultTimeout(900000);
  await p.goto('file://'+PAGE+'#seed=31337&topn=0');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  await p.evaluate(()=>window.__world.runWorld(400,100,16));
  const sun=await p.evaluate(()=>window.__world.sunDir());
  const yaw=Math.atan2(sun[0],sun[2]), pitch=Math.asin(Math.max(-1,Math.min(1,sun[1])));
  await p.evaluate(()=>{document.getElementById('hud').classList.add('hidden'); window.__world.setSpeed(0);});
  await p.evaluate(([y,pi])=>window.__world.setView(y+0.35, pi*0.7+0.2, 0.05),[yaw,pitch]);
  await p.waitForTimeout(3000);
  await p.screenshot({path:path.resolve(__dirname,'leaf-now.png')});
  console.log('wrote leaf-now.png');
  await b.close();
})();
