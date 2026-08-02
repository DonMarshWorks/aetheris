const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(); p.setDefaultTimeout(600000);
  const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,160)));
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  await p.evaluate(()=>window.__world.runWorld(300,100,16));
  await p.evaluate(()=>{window.__world.setView(1.42,0.26,0.30); document.getElementById('playpause').click();});
  await p.waitForTimeout(1500);
  // press the SAME spot repeatedly in a paused world and see if it answers the same
  const spots=await p.evaluate(()=>{
    const out=[];
    for(let x=40;x<=350;x+=30) for(let y=220;y<=680;y+=40){ if(window.__world.pick(x,y)>=0) out.push([x,y]); }
    return out.slice(0,8);
  });
  /* one pick per turn of the event loop, with real waits between, so frames
     run and the framing breath actually moves the ray — which is the thing
     that made repeated presses answer differently */
  const r=[];
  for(const [x,y] of spots){
    const seen=new Set();
    for(let k=0;k<12;k++){
      seen.add(await p.evaluate(([x,y])=>window.__world.pick(x,y),[x,y]));
      await p.waitForTimeout(160);
    }
    r.push(seen.size);
  }
  const unstable=r.filter(v=>v>1).length;
  console.log('12 repeated picks, 160ms apart, at each of', r.length, 'spots in a PAUSED world');
  console.log('distinct answers per spot:', r.join(' '));
  console.log(unstable===0 ? 'every spot answered identically every time'
                           : unstable+' spot(s) gave more than one answer');
  console.log('errors:', errs.length?errs[0]:'none');
  await b.close();
})();
