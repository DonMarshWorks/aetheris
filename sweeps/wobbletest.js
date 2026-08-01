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
  console.log('STRAIGHT-LINE TEST: drag right in 12 equal steps; measure how far the');
  console.log('eye strays from the great circle through its start and end (wobble).');
  console.log(' deg from N pole   max stray (rad)   path/chord   sense');
  for(const fromPole of [15,30,37,45,60,90]){
    const pitch=(90-fromPole)*Math.PI/180;
    const r=await p.evaluate(([pi])=>{
      window.__world.setView(0.6, pi, 0.12);
      const c=window.__world.cam();
      const snap=()=>{const q=c.tq; const v=[0,0,1];
        const tx=2*(q[1]*v[2]-q[2]*v[1]), ty=2*(q[2]*v[0]-q[0]*v[2]), tz=2*(q[0]*v[1]-q[1]*v[0]);
        return [v[0]+q[3]*tx+(q[1]*tz-q[2]*ty), v[1]+q[3]*ty+(q[2]*tx-q[0]*tz), v[2]+q[3]*tz+(q[0]*ty-q[1]*tx)];};
      const mk=(t,x,y)=>new PointerEvent(t,{pointerId:11,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true});
      const cv=document.getElementById('gl');
      const pts=[snap()];
      cv.dispatchEvent(mk('pointerdown',120,420));
      for(let k=1;k<=12;k++){ window.dispatchEvent(mk('pointermove',120+k*12,420)); pts.push(snap()); }
      window.dispatchEvent(mk('pointerup',264,420));
      return pts;
    },[pitch]);
    const A=r[0], B=r[r.length-1];
    let nx=A[1]*B[2]-A[2]*B[1], ny=A[2]*B[0]-A[0]*B[2], nz=A[0]*B[1]-A[1]*B[0];
    const nl=Math.hypot(nx,ny,nz)||1; nx/=nl; ny/=nl; nz/=nl;
    let stray=0, pathLen=0;
    for(let i=0;i<r.length;i++){
      stray=Math.max(stray, Math.abs(r[i][0]*nx+r[i][1]*ny+r[i][2]*nz));
      if(i) pathLen+=Math.hypot(r[i][0]-r[i-1][0],r[i][1]-r[i-1][1],r[i][2]-r[i-1][2]);
    }
    const chord=Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2]);
    console.log('  '+String(fromPole).padStart(9),
      stray.toFixed(6).padStart(17), (pathLen/Math.max(1e-9,chord)).toFixed(4).padStart(13),
      (chord>1e-6?'ok':'DEAD').padStart(7));
  }
  console.log('errors:',errs.length?errs[0]:'none');
  await b.close();
})();
