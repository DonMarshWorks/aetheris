const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  for(const [name,w,h] of [['portrait',390,844],['desktop',1440,900]]){
    const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:w<500,hasTouch:true});
    const p=await ctx.newPage(); p.setDefaultTimeout(300000);
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('file://'+PAGE+'#seed=31337');
    await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
    await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
    const geo=await p.evaluate(()=>{
      const zs=[1.0,0.44,0.11,0.02], out=[];
      for(const z of zs){ window.__world.setView(1.42,0.26,z);
        const c=window.__world.cam();
        out.push({z, dist:+c.tDist.toFixed(3)});
      }
      return out;
    });
    console.log(name,'zoom->distance:',geo.map(g=>`z${g.z}=${g.dist}`).join(' '));
    const btns=await p.evaluate(()=>{
      const ids=['playpause','lock','info'];
      const r={};
      for(const id of ids){const e=document.getElementById(id);const b=e.getBoundingClientRect();
        r[id]={x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),onscreen:b.right<=innerWidth&&b.bottom<=innerHeight&&b.x>=0};}
      return r;
    });
    console.log(' buttons:',JSON.stringify(btns));
    const lock=await p.evaluate(()=>{
      document.getElementById('lock').click();
      const on=document.getElementById('lock').classList.contains('on');
      const pressed=document.getElementById('lock').getAttribute('aria-pressed');
      return {on,pressed};
    });
    console.log(' lock:',JSON.stringify(lock));
    const inf=await p.evaluate(()=>{
      document.getElementById('info').click();
      const on=document.getElementById('charts').classList.contains('on');
      document.getElementById('chartclose').click();
      return on;
    });
    console.log(' info opens charts:',inf,' errors:',errs.length?errs[0]:'none');
    await p.evaluate(()=>{window.__world.setView(1.42,0.26,0.02);});
    await p.waitForTimeout(2500);
    await p.screenshot({path:path.resolve(__dirname,'ui-'+name+'.png')});
    await ctx.close();
  }
  await b.close();
})();
