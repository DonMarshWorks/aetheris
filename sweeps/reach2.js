const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
const axis = process.argv[2];
(async()=>{
  const b=await chromium.launch({args:GL});
  const p=await b.newPage({viewport:{width:200,height:200}}); p.setDefaultTimeout(900000);
  await p.goto('file://'+PAGE+'#seed=31337&plants=0');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  const base=await p.evaluate(()=>({sea:window.__world.S.seaLevel,
    temp:window.__world.S.globalTemp, hum:window.__world.S.globalHum}));
  const vals = axis==='temp' ? [-14,-11,-8,-5,-3,-1,0,1,3,5,8,11,14]
                             : [-0.56,-0.45,-0.35,-0.25,-0.15,-0.05,0.05,0.15,0.25,0.35,0.45,0.52];
  console.log('pinned sweep on '+axis+'   (other dials held at the settled world: sea '+
              base.sea.toFixed(3)+', temp '+base.temp.toFixed(2)+', hum '+base.hum.toFixed(3)+')');
  console.log('  value    ocean    ice  desert  tundra   grass  forest   settled?');
  for(const v of vals){
    await p.evaluate(([a,v,b])=>{
      window.__world.holdClimate(true, b.sea, a==='temp'? v : b.temp, a==='hum'? v : b.hum);
    },[axis,v,base]);
    /* settle, then measure again to see whether it has actually stopped moving */
    await p.evaluate(()=>window.__world.advance(5400,180));
    const s1=await p.evaluate(()=>({...window.__world.S.stats}));
    await p.evaluate(()=>window.__world.advance(1800,60));
    const s2=await p.evaluate(()=>({...window.__world.S.stats}));
    const drift=Math.max(Math.abs(s2.ice-s1.ice),Math.abs(s2.desert-s1.desert),
                         Math.abs(s2.forest-s1.forest),Math.abs(s2.grass-s1.grass));
    const f=x=>(100*x).toFixed(1).padStart(6);
    console.log('  '+String(v).padStart(6), f(s2.ocean), f(s2.ice), f(s2.desert),
                f(s2.tundra), f(s2.grass), f(s2.forest),
                (drift<0.01?'   yes':'   still moving '+(100*drift).toFixed(1)));
  }
  await b.close();
})();
