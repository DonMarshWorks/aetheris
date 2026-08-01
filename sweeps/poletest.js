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
  // Drag right by 60px at several pitches, and report where the sub-camera
  // ground point actually moved, in the camera's own screen frame.
  const probe = (pitch)=>p.evaluate(pi=>{
    window.__world.setView(0.0, pi, 0.12);
    const c=window.__world.cam();
    const eyeOf=()=>{const cp=Math.cos(c.pitch);return [cp*Math.sin(c.yaw),Math.sin(c.pitch),cp*Math.cos(c.yaw)];};
    const before=eyeOf();
    const mk=(t,x,y)=>new PointerEvent(t,{pointerId:9,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true});
    const cv=document.getElementById('gl');
    cv.dispatchEvent(mk('pointerdown',195,420));
    for(let k=1;k<=6;k++) window.dispatchEvent(mk('pointermove',195+k*10,420));
    window.dispatchEvent(mk('pointerup',255,420));
    // read the TARGET frame, which is where the drag landed
    const cp2=Math.cos(c.tPitch);
    const after=[cp2*Math.sin(c.tYaw),Math.sin(c.tPitch),cp2*Math.cos(c.tYaw)];
    // decompose the motion into the pre-drag screen right / up
    const upN=(y,q)=>{const s=Math.sin(q);return [-s*Math.sin(y),Math.cos(q),-s*Math.cos(y)];};
    const n=upN(c.yaw,c.pitch), e=before;
    const cr=Math.cos(c.roll), sr=Math.sin(c.roll);
    const u=[n[0]*cr+(e[1]*n[2]-e[2]*n[1])*sr, n[1]*cr+(e[2]*n[0]-e[0]*n[2])*sr, n[2]*cr+(e[0]*n[1]-e[1]*n[0])*sr];
    let r=[u[1]*e[2]-u[2]*e[1], u[2]*e[0]-u[0]*e[2], u[0]*e[1]-u[1]*e[0]];
    const rl=Math.hypot(...r); r=r.map(v=>v/rl);
    const d=[after[0]-before[0],after[1]-before[1],after[2]-before[2]];
    return { along:+(d[0]*r[0]+d[1]*r[1]+d[2]*r[2]).toFixed(4),
             across:+(d[0]*u[0]+d[1]*u[1]+d[2]*u[2]).toFixed(4) };
  },pitch);
  console.log('drag 60px RIGHT — motion of the eye, resolved in the screen frame');
  console.log(' pitch(deg)   along screen-right   across (should be ~0)');
  for(const pi of [0, 1.1, 1.40, 1.50, 1.54, 1.5707]){
    const r=await probe(pi);
    console.log('  '+(pi*180/Math.PI).toFixed(1).padStart(7),
                String(r.along).padStart(18), String(r.across).padStart(20));
  }
  console.log('errors:',errs.length?errs[0]:'none');
  await b.close();
})();
