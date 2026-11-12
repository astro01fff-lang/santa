#!/usr/bin/env node
// Регрессия ранее найденных багов (каждый сценарий — отдельная игра на 1 команду из 2 игроков).
// Запуск: node tests/regress.js [--only gift,banner,...]
const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),cp=require('child_process'),net=require('net');
const {Player,W}=require('./lib/player');
const A=process.argv.slice(2);const oi=A.indexOf('--only');const ONLY=oi>=0?A[oi+1].split(','):null;
const PORT=8765,BU='&bu='+encodeURIComponent('ws://127.0.0.1:9001'),BASE='http://127.0.0.1:'+PORT;
const OUT=path.join(__dirname,'out','regress-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'));fs.mkdirSync(OUT,{recursive:true});
const portOpen=p=>new Promise(r=>{const s=net.connect(p,'127.0.0.1');s.on('connect',()=>{s.end();r(true)});s.on('error',()=>r(false))});
let browser;const results=[];
async function game(n=2){const host=await (await browser.newContext()).newPage();host.errs=[];host.on('pageerror',e=>host.errs.push(e.message));
  await host.goto(BASE+'/host.html?x=1'+BU);await W(700);await host.fill('#nTeams','1');await host.click('#nCreate');await W(2000);const sid=new URL(host.url()).searchParams.get('s');
  const team={name:'Регрессия',P:[]};const P=[];for(let i=0;i<n;i++){const p=new Player(null,team,i,'Игрок'+(i+1));await p.open(browser,`${BASE}/index.html?s=${sid}&t=t1${BU}`);
    await p.pg.fill('#netui input',p.name);await p.pg.click('#netui .btn.go');await W(800);await p.pg.click(`#netui .ch >> nth=${i}`);await W(800);await p.pg.click('#netui >> text=Я готов(а)');await W(400);P.push(p)}
  await host.click('#bStart');await W(500);if(await host.locator('#dlgOk').isVisible())await host.click('#dlgOk');for(const p of P)await p.waitReady();
  const L=await P[0].E('NET.leader')?0:1;return {host,P,sid,lead:P[L],fol:P[1-L],
    async goto(lv){await host.click('#nav button >> text=Команды');await W(300);await host.selectOption('#goto_t1',lv);await host.click('#goto_t1 + button');await W(300);if(await host.locator('#dlgOk').isVisible())await host.click('#dlgOk');for(const p of P){await p.waitRoom(lv);await p.install()}},
    async close(){for(const p of P)await p.ctx.close().catch(()=>{});await host.context().close()}}}
const S={
async gift(c,ok){// кукольный домик в руках у не-лидера: виден лидеру, переживает перезагрузку, кладётся в коробку
  const {lead,fol}=c;await c.goto('work');await lead.E('sw.running=true;0');await W(2500);
  const gi=await fol.E(`(()=>{const i=sw.gifts.findIndex(g=>g.n==='кукольный домик');const [x,y]=loopPos(sw.gifts[i].s);BOT.near(x,y+2);CONV.act();return i})()`);await W(2500);
  const fm=await fol.E('me');ok(await lead.E(`!!people[${fm}].held&&people[${fm}].held.n==='кукольный домик'`),'лидер видит домик в руках второго игрока');
  await fol.reload();await W(2500);ok(await fol.E(`!!people[me].held&&people[me].held.n==='кукольный домик'`),'после перезагрузки домик снова в руках');
  await fol.E(`(()=>{const i=sw.boxes.findIndex(b=>b.name==='Алиса');BOT.near(BXC[i],150);return boxAct(i)})()`);await W(2500);
  ok(await lead.E(`sw.boxes.find(b=>b.name==='Алиса').done&&sw.gifts[${gi}].gone`),'коробка Алисы закрыта и домик убран с ленты у лидера');
  await lead.E(`(()=>{const g=sw.gifts.find(g=>g.n==='телескоп');g.on=false;g.by=7;return 0})()`);await W(1200);ok(await lead.E(`sw.gifts.find(g=>g.n==='телескоп').on`),'«потерянный» подарок вернулся на ленту')},
async banner(c,ok){// уровень проходит не-лидер, пока лидер на сеновале → баннер и переход у обоих
  const {lead,fol}=c;await c.goto('stable');await lead.E(`goScene('loft',[72,140]);0`);await W(500);
  await fol.E(`SLOTS.forEach(s=>ss.slot[s.k+s.side]=ANSWER[s.k+s.side]);ss.shod=true;ss.tarp=false;say(people[me],sledAct());0`);let seen=[false,false];for(let t=0;t<60;t++){await W(100);for(const k of [0,1])if(await c.P[k].E(`!document.getElementById('trans').hidden`))seen[k]=true}
  ok(seen[0]&&seen[1],'баннер «Уровень пройден!» у обоих игроков ('+seen+')');for(const p of c.P)await p.waitRoom('kitchen');
  ok(await lead.E(`levelOf(ROOM)`)==='kitchen'&&await fol.E(`levelOf(ROOM)`)==='kitchen','оба на кухне, хотя лидер был на сеновале')},
async boss(c,ok){// финал: без щита, оба стреляют, не бьёт во время отогрева, победа у обоих
  const {lead,fol}=c;await c.goto('boss');
  for(const [k,p] of c.P.entries()){for(let a=0;a<6&&!(await p.E('hasWand(me)'));a++){await p.E(`(()=>{const it=bossItems()[${k}]||bossItems()[0];BOT.near(it.x,it.y);it.act(people[me]);return 0})()`);await W(300)}ok(await p.waitFor('hasWand(me)',4000),p.name+' получил жезл')}
  const h0=await lead.E('sb.hp');for(let k=0;k<4;k++){await fol.E('bossShoot();0');await W(1300)}const h1=await lead.E('sb.hp');ok(h1<h0,'выстрелы не-лидера ранят Королеву ('+Math.round(h0)+'→'+Math.round(h1)+')');
  // заморозка одного — атаки на паузе
  const fm=await fol.E('me');await lead.E(`sb.frozen[${fm}]=true;sb.lives[${fm}]=0;sb.nextAtk=performance.now()+100;0`);await W(1500);
  const atk=await lead.E(`[sb.spikes.length,sb.orbs.length,sb.nextAtk-performance.now()]`);ok(atk[0]===0&&atk[1]===0&&atk[2]>500,'пока товарища отогревают, Королева не атакует ('+atk.map(Math.round)+')');
  await lead.E(`(()=>{const q=people[${fm}];const p=people[me];p.x=q.x+6;p.y=q.y;return 0})()`);ok(await lead.waitFor(`!isFrozen(${fm})`,6000),'товарищ оттаял, когда к нему подошли');
  let phases=new Set();for(let t=0;t<500;t++){const ph=await lead.E('sb.phase');phases.add(ph);if(ph==='win')break;for(const p of c.P)await p.E(`sb.frozen={};sb.lives={};bossShoot();0`).catch(()=>{});await W(300)}
  ok(!phases.has('shield'),'щита нет ни разу (фазы: '+[...phases]+')');ok(await lead.E(`sb.phase==='win'`),'Королева побеждена (здоровье '+Math.round(await lead.E('sb.hp'))+', фазы: '+[...phases]+')');ok(await fol.waitFor(`sb.phase==='win'`,5000),'победа видна обоим');
  await W(3000);await c.host.click('#nav button >> text=Результаты').catch(()=>{});await W(800);const rt=await c.host.$eval('#s-res',e=>e.innerText).catch(()=>'');ok(/1 место|место|\d\d:\d\d/i.test(rt),'панель ведущей показывает результат команды: '+rt.replace(/\s+/g,' ').slice(0,100))},
async last2(c,ok){// двое одновременно закрывают две последние коробки → уровень всё равно засчитан у обоих
  const {P}=c;await c.goto('work');
  await P[0].E(`sw.running=true;sw.boxes.forEach((b,i)=>{b.name=Object.keys(WANT)[i];if(i<6){b.done=true;const g=sw.gifts.find(g=>g.n===WANT[b.name]);g.gone=true;g.on=false}});renderSide();0`);await W(2500);
  for(const [k,p] of P.entries())await p.E(`(()=>{const g0=sw.gifts.find(g=>g.n===WANT[sw.boxes[${6+k}].name]);g0.on=false;g0.by=me;people[me].held=g0;return 0})()`);await W(1500);
  await Promise.all(P.map((p,k)=>p.E(`(()=>{const i=${6+k};BOT.near(BXC[i],150);return boxAct(i)})()`)));
  for(const p of P)ok(await p.waitFor(`levelOf(ROOM)==='clock'`,15000),p.name+': после одновременного закрытия двух последних коробок команда перешла в часовую башню')},
async leaderReload(c,ok){// лидер обновляет страницу; пока он загружается, товарищ берёт вещи → ничего не теряется
  const {lead,fol}=c;const rl=lead.pg.reload();await W(300);await fol.act([137,89],'молоко');await fol.act([6,143],'ведро');await fol.act([95,130],'подушка (обрывок)');
  await rl;await lead.waitReady();await W(6000);
  for(const p of [lead,fol])ok(await p.waitFor(`anyHas('стакан молока')&&anyHas('пустое ведро')&&st.pillow&&st.pieces===1`,8000),p.name+': находки, сделанные пока лидер перезагружался, на месте ('+await p.E(`TEAM.inv.join(', ')+'; обрывков '+st.pieces`)+')')},
async selfReload(c,ok){// игрок что-то сделал и сразу обновил страницу (до того как лидер ответил)
  const {lead,fol}=c;await fol.E(`BOT.act([137,89]);setTimeout(()=>location.reload(),150);0`).catch(()=>{});await W(600);await fol.waitReady();await W(4000);
  for(const p of [lead,fol])ok(await p.waitFor(`anyHas('стакан молока')`,8000),p.name+': молоко, взятое прямо перед перезагрузкой, не пропало ('+await p.E(`TEAM.inv.join(', ')`)+')');
  ok(await lead.E(`TEAM.inv.filter(x=>baseIt(x)==='стакан молока').length`)===1,'молоко не задвоилось')},
async reach(c,ok){// настоящий клик мышью по каждому предмету во всех комнатах: нигде нет «Туда не пройти»
  const p=c.P[0];const bad=[];
  for(const [lv,subs] of [['living',[]],['work',[]],['clock',[]],['stable',['loft','forge']],['kitchen',['pantry','cellar']],['obs',[]]]){
    await c.goto(lv);
    for(const sc of [lv,...subs]){if(sc!==lv)await p.E(`goScene('${sc}',[100,120]);0`);await W(300);
      const items=await p.E(`curItems().filter(o=>o.hit&&!/goScene|levelDone/.test(String(o.act))).map(o=>o.hit)`);
      for(const h of items){await p.E(`document.querySelectorAll('.modal').forEach(m=>m.hidden=true);bubble=null;path=null;const p0=people[me];0`);
        const [S,ZM,camX,ZX,camY,ZY]=await p.E(`[S,ZM,camX,ZX,camY,ZY]`);const r=await p.pg.locator('#game').boundingBox();
        await p.pg.mouse.click(r.x+(h[0]+h[2]/2-camX-ZX)*S*ZM,r.y+(h[1]+h[3]/2-camY-ZY)*S*ZM);await W(60);
        const t=await p.E(`bubble&&bubble.text||''`);if(/Туда не пройти/.test(t))bad.push(sc+' '+h.join(','))}}}
  ok(!bad.length,'ко всем предметам можно подойти или осмотреть их издалека'+(bad.length?': '+bad.join(' | '):''))
  await c.goto('stable');{const [S,ZM,camX,ZX,camY,ZY]=await p.E(`[S,ZM,camX,ZX,camY,ZY]`);const r=await p.pg.locator('#game').boundingBox();
    await p.pg.mouse.click(r.x+(246-camX-ZX)*S*ZM,r.y+(15-camY-ZY)*S*ZM);ok(await p.waitFor(`ROOM==='loft'`,8000),'клик мышью по верёвочной лестнице ведёт на сеновал')}},
async offline(c,ok){// пропала связь у игрока на 10 с: его действия доходят после возвращения, позиция и инвентарь сходятся
  const {lead,fol}=c;await fol.setOffline(true);await fol.act([6,143],'ведро');await W(10000);await fol.setOffline(false);
  ok(await lead.waitFor(`anyHas('пустое ведро')`,15000),'ведро, взятое без связи, появилось у товарища после восстановления');
  await lead.act([137,89],'молоко');ok(await fol.waitFor(`anyHas('стакан молока')`,8000),'вернувшийся игрок видит находки товарища')},
async leaderLeft(c,ok){// лидер закрыл вкладку посреди уровня → второй игрок продолжает, состояние не теряется; лидер возвращается
  const {lead,fol}=c;await lead.act([6,143],'ведро');await W(1500);const url=lead.url;await lead.pg.close();await W(25000);
  ok(await fol.waitFor('NET.leader',40000),'второй игрок стал ведущим в команде после ухода лидера');ok(await fol.E(`anyHas('пустое ведро')`),'находки ушедшего остались у команды');
  await fol.act([137,89],'молоко');lead.pg=await lead.ctx.newPage();await lead.pg.goto(url);await lead.waitReady(30000);
  ok(await lead.waitFor(`anyHas('стакан молока')&&anyHas('пустое ведро')`,10000),'вернувшийся по той же ссылке игрок видит всё состояние команды');
  ok(await lead.E('me')!==await fol.E('me'),'вернувшийся получил своё место, а не чужое')},
async sound(c,ok){// звук: кнопки видны везде, выключенная музыка остаётся выключенной при переходах и перезагрузке
  const {lead}=c;await lead.pg.click('#mbtn');ok(await lead.E('AU.music===false'),'музыка выключается кнопкой');
  for(const lv of ['work','stable']){await c.goto(lv);ok(await lead.E(`AU.music===false&&!!document.getElementById('mbtn').offsetParent&&!!document.getElementById('sbtn').offsetParent`),'на уровне '+lv+' музыка выключена и кнопки видны')}
  await lead.E(`goScene('loft',[72,140]);0`);ok(await lead.E(`!!document.getElementById('mbtn').offsetParent`),'кнопки видны на сеновале');
  await lead.reload();ok(await lead.E('AU.music===false'),'после перезагрузки музыка всё ещё выключена');await lead.pg.click('#mbtn');ok(await lead.E('AU.music===true'),'музыка включается обратно')},
async stable(c,ok){// олень: можно вернуть в стойло без упряжи, подковать в стойле, имя видно
  const {lead}=c;await c.goto('stable');await lead.E(`ss.tags=STALL.slice();ss.namesOK=true;TEAM.inv.push('упряжь');renderSide();0`);await lead.hold('упряжь');await lead.E(`slotAct(0);0`);await W(200);
  const opts=await lead.pg.locator('#pickopts button').allTextContents();await lead.pick(opts.find(t=>!/Отмена|Закрыть/.test(t)));
  await lead.E(`TEAM.inv=TEAM.inv.map(x=>x.replace(/^@\\d+:/,''));renderSide();0`);await lead.E(`slotAct(0);0`);await W(200);const t=await lead.E(`document.getElementById('picktitle').textContent`);const o2=await lead.pg.locator('#pickopts button').allTextContents();
  ok(/Это /.test(t),'при нажатии на запряжённого оленя видно его имя («'+t.slice(0,40)+'»)');ok(o2.some(x=>/Вернуть .* в стойло/.test(x)),'есть кнопка «Вернуть … в стойло» без упряжи в руках');
  await lead.pick('Вернуть');ok(await lead.E(`!ss.slot[SLOTS[0].k+SLOTS[0].side]`),'олень вернулся в стойло');
  const sk=await lead.E(`STALL.indexOf('Скакун')`);await lead.E(`TEAM.inv.push('новая подкова','молоток');renderSide();0`);await lead.hold('новая подкова');await lead.E(`say(people[me],stallAct(${sk}));0`);await lead.hold('молоток');await lead.E(`say(people[me],stallAct(${sk}));0`);
  ok(await lead.waitFor('ss.shod'),'Скакуна можно подковать прямо в стойле');
  const lad=await lead.E(`(()=>{const it=ITEMS_S.find(o=>o.hit&&o.hit[0]===236&&o.hit[1]===0);return it?it.hit:null})()`);ok(!!lad,'лестница на сеновал на месте ('+lad+')')},
async prologue(c,ok){// пролог печатается постепенно и встаёт на паузу, пока вкладка скрыта
  const p=c.P[0];await p.E(`(()=>{const b=document.getElementById('prolog');b.hidden=false;return 0})()`);ok(true,'пролог проверяется в основном прогоне (qa.js)')}
};
(async()=>{const kids=[];if(await portOpen(PORT)){const r=await fetch(BASE+'/index.html').catch(()=>null);if(!r||r.headers.get('x-santa-qa')!=='1'){console.error('Порт '+PORT+' занят чужим сервером. Остановите его и запустите снова.');process.exit(2)}}else kids.push(cp.spawn(process.execPath,[path.join(__dirname,'serve.js'),String(PORT)],{stdio:'ignore'}));if(!(await portOpen(9001)))kids.push(cp.spawn(process.execPath,[path.join(__dirname,'broker.js')],{stdio:'ignore'}));await W(2000);
  browser=await chromium.launch();let fails=0;
  for(const [name,fn] of Object.entries(S)){if(ONLY&&!ONLY.includes(name)||name==='prologue')continue;console.log('▶ '+name);let c;
    const ok=(v,m)=>{results.push({sc:name,ok:!!v,msg:m});if(!v)fails++;console.log((v?'  ✓ ':'  ✗ ')+m)};
    try{c=await game();await fn(c,ok)}catch(e){ok(false,'сценарий упал: '+e.message.split('\n')[0]);if(c)for(const p of c.P)await p.shot(path.join(OUT,name+'-'+p.name+'.png'))}
    if(c){for(const p of c.P)if(p.errors.length)ok(false,p.name+': ошибки JS: '+p.errors.map(e=>e.msg).slice(0,3).join(' | '));await c.close()}}
  fs.writeFileSync(path.join(OUT,'regress.json'),JSON.stringify(results,null,1));console.log(`\nРЕГРЕССИЯ: проверок ${results.length}, провалено ${fails}. ${OUT}`);await browser.close();kids.forEach(k=>k.kill());process.exit(fails?1:0)})();
