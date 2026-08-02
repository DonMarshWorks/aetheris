const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(); p.setDefaultTimeout(600000);
  const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,200)));
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200));});
  await p.goto('file://'+PAGE+'#seed=31337');
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  await p.evaluate(()=>window.__world.runWorld(200,100,16));
  const r=await p.evaluate(()=>{
    document.getElementById('gear').click();
    const on=document.getElementById('settings').classList.contains('on');
    const rows=document.querySelectorAll('#setlist .setrow').length;
    const groups=document.querySelectorAll('#setlist .setgroup').length;
    const d=document.documentElement;
    const fits=d.scrollWidth===d.clientWidth && d.scrollHeight===d.clientHeight;
    const sc=document.getElementById('setlist');
    return {on,rows,groups,fits,scrolls:sc.scrollHeight>sc.clientHeight};
  });
  console.log('panel opens:',r.on,' rows:',r.rows,' groups:',r.groups,
              ' document still fits:',r.fits,' list scrolls:',r.scrolls);
  // live change: leaf size, and confirm PARAMS + hash both moved
  const live=await p.evaluate(()=>{
    const before=window.__world.params().fathi;
    const ranges=[...document.querySelectorAll('#setlist input[type=range]')];
    const leaf=ranges[ranges.length-5];  // second knob of leaf size
    leaf.value=0.6; leaf.dispatchEvent(new Event('input',{bubbles:true}));
    return {before, after:window.__world.params().fathi, hash:location.hash.slice(0,90)};
  });
  console.log('live edit: fathi', live.before, '->', live.after, ' hash:', live.hash);
  const sea=await p.evaluate(()=>{
    const btns=[...document.querySelectorAll('#setlist .setchoice button')];
    btns[0].click();   // "None"
    return {seafit:window.__world.params().seafit, marine:window.__world.params().marine,
            hash:location.hash.includes('seafit')};
  });
  console.log('choice: sea plants none ->', JSON.stringify(sea));
  await p.screenshot({path:path.resolve(__dirname,'settings.png')});
  console.log('errors:', errs.length?errs[0]:'none');
  await b.close();
})();
