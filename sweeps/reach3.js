const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
const axis=process.argv[2], churn=process.argv[3]||'0';
(async()=>{
  const b=await chromium.launch({args:GL});
  const p=await b.newPage({viewport:{width:200,height:200}}); p.setDefaultTimeout(900000);
  await p.goto('file://'+PAGE+'#seed=31337&plants=0&churn='+churn);
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  const base=await p.evaluate(()=>({sea:window.__world.S.seaLevel,
    temp:window.__world.S.globalTemp, hum:window.__world.S.globalHum}));
  const vals = axis==='temp' ? [-14,-10,-6,-3,0,3,6,10,14]
                             : [-0.56,-0.42,-0.28,-0.14,0,0.14,0.28,0.42,0.52];
  console.log('pinned sweep on '+axis+', churn='+churn+
              '   (mean of 8 samples over 4800s after settling; +/- is the spread)');
  console.log('  value     ocean       ice      desert      grass      forest');
  for(const v of vals){
    await p.evaluate(([a,v,b])=>window.__world.holdClimate(true, b.sea,
        a==='temp'? v : b.temp, a==='hum'? v : b.hum),[axis,v,base]);
    await p.evaluate(()=>window.__world.advance(7200,240));   // settle
    const S=[];
    for(let k=0;k<8;k++){
      await p.evaluate(()=>window.__world.advance(600,20));
      S.push(await p.evaluate(()=>({...window.__world.S.stats})));
    }
    const stat=k=>{ const a=S.map(s=>s[k]); const m=a.reduce((x,y)=>x+y,0)/a.length;
      const sd=Math.sqrt(a.reduce((x,y)=>x+(y-m)*(y-m),0)/a.length);
      return (100*m).toFixed(1).padStart(5)+(sd>0.002?('±'+(100*sd).toFixed(1)):'    '); };
    console.log('  '+String(v).padStart(6), stat('ocean'), stat('ice'), stat('desert'),
                stat('grass'), stat('forest'));
  }
  await b.close();
})();
