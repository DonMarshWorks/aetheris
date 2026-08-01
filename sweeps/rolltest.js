const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const p=await b.newPage({viewport:{width:600,height:600}}); p.setDefaultTimeout(300000);
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  // Track a fixed point on the SURFACE and see whether it stays put on screen,
  // in position and in orientation, while the lock is held.
  await p.evaluate(()=>{ window.__world.setView(1.42,0.35,0.30); document.getElementById('lock').click(); });
  await p.waitForTimeout(400);
  const probe=()=>p.evaluate(()=>{
    const c=window.__world.cam();
    // object-space point currently under the camera, carried forward by spin
    return {yaw:c.yaw,pitch:c.pitch,roll:c.roll};
  });
  const a=await probe(); await p.waitForTimeout(6000); const c=await probe();
  console.log('over 6s held: yaw moved',(c.yaw-a.yaw).toFixed(4),
              ' pitch moved',(c.pitch-a.pitch).toFixed(4),
              ' roll accumulated',(c.roll-a.roll).toFixed(4),'rad');
  console.log('expected spin over 6s:',(6*Math.PI*2/150).toFixed(4),'rad');
  console.log('errors:',errs.length?errs[0]:'none');
  await b.close();
})();
