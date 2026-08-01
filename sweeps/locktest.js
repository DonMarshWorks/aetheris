const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const p=await b.newPage({viewport:{width:600,height:600}}); p.setDefaultTimeout(300000);
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  // sample the surface point under the camera, twice, with lock OFF then ON
  const sample=async(lock)=>{
    await p.evaluate(l=>{
      const el=document.getElementById('lock');
      if(el.classList.contains('on')!==l) el.click();
    },lock);
    await p.waitForTimeout(300);
    const a=await p.evaluate(()=>({yaw:window.__world.cam().yaw, t:performance.now()}));
    await p.waitForTimeout(4000);
    const c=await p.evaluate(()=>({yaw:window.__world.cam().yaw, t:performance.now()}));
    const dt=(c.t-a.t)/1000;
    return {dYaw:c.yaw-a.yaw, dt, expected:dt*(Math.PI*2/150)};
  };
  const off=await sample(false), on=await sample(true);
  console.log('lock OFF: camera yaw moved', off.dYaw.toFixed(4),'rad over',off.dt.toFixed(1),'s (expected 0)');
  console.log('lock ON : camera yaw moved', on.dYaw.toFixed(4),'rad over',on.dt.toFixed(1),
              's (spin over that time =',on.expected.toFixed(4),'rad)');
  const worldStillTurning=await p.evaluate(()=>window.__world.S.time>0);
  console.log('world clock still advancing while locked:', worldStillTurning);
  await b.close();
})();
