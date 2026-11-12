// Один виртуальный игрок: своя вкладка (свой контекст браузера), помощники для действий в игре.
const W=t=>new Promise(r=>setTimeout(r,t));
class Player{
  constructor(run,team,idx,name){this.run=run;this.team=team;this.idx=idx;this.name=name;this.tag=team.name+'/'+name;this.trail=[];this.errors=[];this.net=[];this.online=true}
  async open(browser,url){
    this.ctx=await browser.newContext({viewport:{width:1280,height:860}});this.pg=await this.ctx.newPage();
    this.pg.on('pageerror',e=>this.errors.push({t:Date.now(),kind:'js',msg:e.message}));
    this.pg.on('console',m=>{if(m.type()==='error'){const t=m.text();if(/ERR_INTERNET_DISCONNECTED|WebSocket connection|net::ERR/.test(t)&&!this.online)return;this.errors.push({t:Date.now(),kind:'console',msg:t})}});
    this.pg.on('requestfailed',r=>{const u=r.url();if(!this.online||/favicon/.test(u))return;this.net.push({t:Date.now(),url:u,err:r.failure()&&r.failure().errorText})});
    this.pg.on('response',r=>{if(r.status()>=400&&!/favicon/.test(r.url()))this.net.push({t:Date.now(),url:r.url(),err:'HTTP '+r.status()})});
    this.url=url;await this.pg.goto(url);await W(1500)}
  log(s){this.trail.push(new Date().toISOString().slice(11,19)+' '+s);if(this.trail.length>60)this.trail.shift()}
  E(code){return this.pg.evaluate(c=>window.__EV(c),code)}
  async install(){await this.E(`window.BOT={
    find(h){return curItems().find(o=>o.hit&&o.hit[0]===h[0]&&o.hit[1]===h[1]&&(h[2]===undefined||o.hit[2]===h[2]))},
    act(h){const it=this.find(h);if(!it)return '__НЕТ__';bubble=null;if(!modal.hidden||!pick.hidden)return '__ЗАНЯТО__ '+(modal.hidden?'выбор':'окно');actOn(it);return bubble?bubble.text:'(окно)'},
    near(x,y){const p=people[me];p.x=x-8;p.y=y-20},
    closeUI(){document.getElementById('prolog').hidden=true;document.querySelectorAll('.modal').forEach(m=>{if(m.id!=='epibox')m.hidden=true});try{if(!treeBox.hidden)closeTree()}catch(e){}try{if(!gearBox.hidden)closeGears()}catch(e){}const nm=document.getElementById('netmsg');if(nm)nm.hidden=true}
  };if(!window.__BANNERS){window.__BANNERS=[];const tr=document.getElementById('trans');new MutationObserver(()=>{if(!tr.hidden&&/Уровень пройден/.test(tr.textContent))window.__BANNERS.push({lv:levelOf(ROOM),t:Date.now()})}).observe(tr,{attributes:true,childList:true})}0`)}
  async reload(){this.log('перезагрузка страницы');await this.pg.reload();await this.waitReady()}
  async waitReady(ms=20000){const t0=Date.now();while(Date.now()-t0<ms){const r=await this.pg.evaluate(()=>!!(window.__EV&&window.NET&&NET.started&&document.getElementById('netui').hidden)).catch(()=>false);if(r)break;await W(300)}
    await W(800);await this.install();await this.closeUI()}
  async closeUI(){await this.E('BOT.closeUI();0')}
  async act(h,label){this.log('нажал '+(label||JSON.stringify(h)));const r=await this.E(`BOT.act(${JSON.stringify(h)})`);if(r==='__НЕТ__'){const room=await this.E('ROOM').catch(()=>'?');throw new Error('нет предмета '+JSON.stringify(h)+(label?' «'+label+'»':'')+' в '+room)}this.log('  ← '+String(r).slice(0,60));await W(90);return r}
  async code(v){this.log('ввёл код '+v);await this.pg.fill('#codein',v);await this.pg.press('#codein','Enter');await W(250)}
  async pick(t){this.log('выбрал «'+t+'»');await this.pg.locator('#pickopts button',{hasText:t}).first().click({timeout:5000});await W(130)}
  async hold(k){this.log('взял в руки «'+k+'»');
    if(await this.E(`heldBy(me)===${JSON.stringify(k)}`))return true;
    for(let a=0;a<12;a++){const sel=await this.pg.locator('#inv .slot.full').evaluateAll((els,k)=>els.findIndex(e=>{const t=e.title||'';return t===k||t.startsWith(k+' ')}),k);
      if(sel>=0){await this.pg.locator('#inv .slot.full').nth(sel).click();await W(140);if(await this.E(`heldBy(me)===${JSON.stringify(k)}`))return true}
      await W(300)}
    throw new Error('не удалось взять в руки «'+k+'»; инвентарь: '+await this.E('TEAM.inv.join(", ")'))}
  async waitRoom(r,ms=15000){const t0=Date.now();while(Date.now()-t0<ms){if(await this.E(`levelOf(ROOM)===${JSON.stringify(r)}&&!transBusy`))break;await W(250)}await W(300);await this.closeUI();return this.E('levelOf(ROOM)')}
  async waitFor(expr,ms=8000){const t0=Date.now();while(Date.now()-t0<ms){if(await this.E(expr).catch(()=>false))return true;await W(200)}return false}
  async shot(file){try{await this.pg.screenshot({path:file});return file}catch(e){return null}}
  async setOffline(v){this.online=!v;this.log(v?'СВЯЗЬ ПРОПАЛА':'связь вернулась');await this.ctx.setOffline(v)}
}
module.exports={Player,W};
