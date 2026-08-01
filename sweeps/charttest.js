const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  for(const [name,w,h] of [['iphone-portrait',390,844],['iphone-landscape',844,390],['desktop',1440,900]]){
    const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:w<500,hasTouch:true});
    const p=await ctx.newPage(); p.setDefaultTimeout(300000);
    await p.goto('file://'+PAGE+'#seed=31337');
    await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
    await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
    await p.evaluate(()=>window.__world.runWorld(400,100,16));
    await p.evaluate(()=>document.getElementById('chartlink').click());
    await p.waitForTimeout(1200);
    const info=await p.evaluate(()=>{
      const d=document.documentElement, sc=document.getElementById('cscroll'), cg=document.getElementById('cgraph');
      return {docOverflowX:d.scrollWidth-d.clientWidth, docOverflowY:d.scrollHeight-d.clientHeight,
        scrollerH:sc.clientHeight, canvasH:cg.clientHeight, canvasW:cg.clientWidth,
        scrollable:cg.clientHeight>sc.clientHeight};
    });
    console.log(name, JSON.stringify(info));
    await p.screenshot({path:path.resolve(__dirname,'charts-'+name+'.png')});
    await ctx.close();
  }
  await b.close();
})();
