const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const p=await b.newPage({viewport:{width:250,height:250}}); p.setDefaultTimeout(600000);
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  await p.evaluate(()=>window.__world.advance(1800,120));
  const r=await p.evaluate(()=>{
    const F=window.__world.F, GW=320, GH=160;
    const h=F.h; const out=[];
    /* area-weighted ocean fraction at each sea level the controller may reach */
    for(let sl=-0.50; sl<=0.501; sl+=0.05){
      let wet=0, tot=0;
      for(let j=0;j<GH;j++){
        const lat=(j+0.5)/GH*Math.PI - Math.PI/2, w=Math.cos(lat);
        for(let i=0;i<GW;i++){ tot+=w; if(h[j*GW+i]<sl) wet+=w; }
      }
      out.push([+sl.toFixed(2), +(wet/tot).toFixed(3)]);
    }
    return {curve:out, seaNow:window.__world.S.seaLevel, stats:window.__world.S.stats};
  });
  console.log('ocean share the sea-level dial can actually reach (clamped to +/-0.50):');
  console.log('  seaLevel  ocean');
  for(const [sl,o] of r.curve) console.log('  '+String(sl).padStart(6), (100*o).toFixed(1)+'%');
  console.log('\ncurrently at seaLevel', r.seaNow.toFixed(3), '->', (100*r.stats.ocean).toFixed(1)+'% ocean');
  await b.close();
})();
