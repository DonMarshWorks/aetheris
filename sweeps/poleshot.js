const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  for(const [tag,hash] of [['detail-on','#seed=31337'],['detail-off','#seed=31337&detail=0']]){
    const p=await b.newPage({viewport:{width:700,height:700}}); p.setDefaultTimeout(900000);
    await p.goto('file://'+PAGE+hash);
    await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
    await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
    await p.evaluate(()=>window.__world.runWorld(400,100,16));
    /* look straight down on the north pole, close in */
    await p.evaluate(()=>{ document.getElementById('hud').classList.add('hidden');
                           window.__world.setView(1.0, 1.45, 0.16); window.__world.setSpeed(0); });
    await p.waitForTimeout(3000);
    await p.screenshot({path:path.resolve(__dirname,'pole-'+tag+'.png')});
    console.log('wrote pole-'+tag+'.png');
    await p.close();
  }
  await b.close();
})();
