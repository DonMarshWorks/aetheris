const path=require('path'); const {chromium}=require('playwright');
const PAGE=path.resolve(__dirname,'..','index.html');
const GL=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'];
(async()=>{
  const b=await chromium.launch({args:GL});
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(); p.setDefaultTimeout=600000;
  const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,160)));
  // arrive with NO seed, to check the link still names one
  await p.goto('file://'+PAGE);
  await p.waitForFunction(()=>window.__world&&window.__world.S.epoch0>0,{timeout:180000});
  await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.classList.contains('gone');},{timeout:60000});
  const r=await p.evaluate(()=>{
    document.getElementById('gear').click();
    const l0=document.getElementById('setlink').value;
    const rs=[...document.querySelectorAll('#setlist input[type=range]')];
    rs[1].value=2600; rs[1].dispatchEvent(new Event('input',{bubbles:true}));   // plant lifespan
    return {before:l0, after:document.getElementById('setlink').value};
  });
  console.log('arrived with no seed in the URL');
  console.log('  link on opening   :', r.before);
  console.log('  after one slider  :', r.after);
  console.log('  names a seed      :', /seed=\d+/.test(r.after));
  const box=await p.evaluate(()=>{
    const d=document.documentElement;
    const b=document.getElementById('setlink').getBoundingClientRect();
    return {fits:d.scrollWidth===d.clientWidth, onscreen:b.right<=innerWidth&&b.left>=0};
  });
  console.log('  document still fits:', box.fits, ' field on screen:', box.onscreen);
  await p.screenshot({path:path.resolve(__dirname,'settings-link.png')});
  console.log('errors:', errs.length?errs[0]:'none');
  await b.close();
})();
