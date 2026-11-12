#!/usr/bin/env node
// Полный прогон QA: ведущая + N команд по 2 виртуальных игрока, проход игры от начала до финала.
// Запуск: node tests/qa.js [--teams 4] [--seed 7] [--chaos] [--levels living,work] [--headed]
const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),cp=require('child_process');
const {Player,W}=require('./lib/player');const {Team}=require('./lib/team');const {LEVELS,ORDER}=require('./lib/levels');
const A=process.argv.slice(2);const arg=(k,d)=>{const i=A.indexOf('--'+k);return i<0?d:(A[i+1]&&!A[i+1].startsWith('--')?A[i+1]:true)};
const NT=+arg('teams',4),SEED=+arg('seed',Date.now()%100000),CHAOS=!!arg('chaos',false),ONLY=arg('levels',null);
const PORT=8765,BU='&bu='+encodeURIComponent('ws://127.0.0.1:9001'),BASE='http://127.0.0.1:'+PORT;
const OUT=path.join(__dirname,'out',(CHAOS?'chaos-':'run-')+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'));fs.mkdirSync(path.join(OUT,'shots'),{recursive:true});
const PROFILES=CHAOS?[['chaos','chaos'],['chaos','chaos'],['chaos','chaos'],['chaos','chaos']]:[['sequential','sequential'],['active','explorer'],['careless','sequential'],['unstable','active']];
const PNAME={sequential:'последовательный',active:'активный',explorer:'исследователь',careless:'невнимательный',unstable:'нестабильная связь',chaos:'хаос'};
const LVNAME={living:'1. Гостиная',work:'2. Мастерская',clock:'3. Часовая башня',stable:'4. Конюшня',kitchen:'5. Кухня',obs:'6. Обсерватория',flight:'Полёт',boss:'7. Финал'};
async function up(url,ms=8000){const t0=Date.now();while(Date.now()-t0<ms){try{await fetch(url);return true}catch(e){await W(300)}}return false}
const net=require('net');function portOpen(p){return new Promise(r=>{const s=net.connect(p,'127.0.0.1');s.on('connect',()=>{s.end();r(true)});s.on('error',()=>r(false))})}
const run={bugs:[],pend:[],t0:Date.now(),seed:SEED,
  bug(o){const id=this.bugs.length+1;const b={id,sev:o.sev,title:o.title,team:o.team?o.team.name:'—',level:LVNAME[o.level]||o.level||'—',room:o.room,seed:SEED,at:new Date().toISOString()};this.bugs.push(b);
    console.log(`  🐞 #${id} [${b.sev}] ${b.team} · ${b.level}: ${b.title}`);
    if(o.team)this.pend.push((async()=>{b.players=[];for(const P of o.team.P){const room=await P.E('ROOM').catch(()=>'?');const file=await P.shot(path.join(OUT,'shots',`bug${id}-${P.name}.png`));
      if(process.env.QA_VERBOSE)console.log('     '+P.name+': '+P.trail.slice(-6).join(' → '));b.players.push({name:P.name,profile:PNAME[o.team.prof(P)],room,actions:P.trail.slice(-12),js:P.errors.slice(-5).map(e=>e.msg),net:P.net.slice(-5).map(e=>e.url+' '+e.err),shot:file&&path.relative(OUT,file)})}})().catch(()=>{}))}};
(async()=>{
  const kids=[];if(await portOpen(PORT)){const r=await fetch(BASE+'/index.html').catch(()=>null);if(!r||r.headers.get('x-santa-qa')!=='1'){console.error('Порт '+PORT+' занят чужим сервером. Остановите его и запустите снова.');process.exit(2)}}else {kids.push(cp.spawn(process.execPath,[path.join(__dirname,'serve.js'),String(PORT)],{stdio:'ignore'}))}
  if(!(await portOpen(9001))){kids.push(cp.spawn(process.execPath,[path.join(__dirname,'broker.js')],{stdio:'ignore'}))}
  await up(BASE+'/host.html');for(let k=0;k<30&&!(await portOpen(9001));k++)await W(300);
  const browser=await chromium.launch({headless:!arg('headed',false)});
  console.log(`QA: команд ${NT}, сид ${SEED}${CHAOS?', режим хаоса':''}. Отчёт: ${OUT}`);
  // ведущая
  const host=await (await browser.newContext({viewport:{width:1400,height:900}})).newPage();const hostErr=[];host.on('pageerror',e=>hostErr.push(e.message));
  await host.goto(BASE+'/host.html?x=1'+BU);await W(800);await host.fill('#nTeams',String(NT));await host.click('#nCreate');await W(2500);
  const sid=new URL(host.url()).searchParams.get('s');
  const teams=[];for(let t=0;t<NT;t++){const T=new Team(run,'t'+(t+1),'Команда '+(t+1),PROFILES[t%PROFILES.length],SEED*31+t);teams.push(T);
    for(let i=0;i<2;i++){const P=new Player(run,T,i,'Игрок'+(t+1)+'.'+(i+1));await P.open(browser,`${BASE}/index.html?s=${sid}&t=${T.id}${BU}`);
      await P.pg.fill('#netui input',P.name);await P.pg.click('#netui .btn.go');await W(900);await P.pg.click(`#netui .ch >> nth=${i}`);await W(900);await P.pg.click('#netui >> text=Я готов(а)');await W(400);T.P.push(P)}}
  const tStart=Date.now();await host.click('#bStart');await W(500);if(await host.locator('#dlgOk').isVisible())await host.click('#dlgOk');
  // пролог: текст появляется постепенно, у обоих игроков
  for(const T of teams)for(const P of T.P){const vis=`document.getElementById('prolog').hidden?null:(document.getElementById('plt')||document.getElementById('prolog')).textContent.length`;
    let a=null;for(let k=0;k<60&&a===null;k++){a=await P.E(vis).catch(()=>null);if(a===null)await W(250)}await W(1500);const b=await P.E(vis).catch(()=>null);
    if(T===teams[0])T.ok(a!==null,P.name+': после отсчёта показан пролог','серьёзный')}
  for(const T of teams)for(const P of T.P){await P.waitReady();T.ok(await P.E(`(()=>{const m=document.getElementById('mbtn'),s=document.getElementById('sbtn');return !!(m&&s&&m.closest('.hotbar')&&m.offsetParent&&s.offsetParent)})()`),P.name+': кнопки музыки и звука видны внизу','серьёзный')}
  // экраны команд у ведущей: без звука
  try{await host.click('#nav button >> text=Экраны команд');await W(400);await host.click('#monToggle');await W(5000);const fr=host.frames().filter(f=>/spec=1/.test(f.url()));
    teams[0].ok(fr.length===NT,'у ведущей открыты экраны всех команд: '+fr.length);for(const f of fr){await f.evaluate(()=>document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))).catch(()=>{})}await W(800);
    for(const f of fr){const s=await f.evaluate(()=>window.__EV?window.__EV('!!AU.ctx'):'нет').catch(e=>'ошибка');teams[0].ok(s===false,'экран команды у ведущей без звука ('+s+')')}
    await host.click('#monToggle');await host.click('#nav button >> text=Команды')}catch(e){run.bug({sev:'незначительный',title:'Не удалось проверить экраны команд у ведущей: '+e.message.split('\n')[0]})}
  // проход
  const levels=ONLY?ORDER.filter(l=>ONLY.split(',').includes(l)):ORDER;
  async function play(T){
    if(levels[0]!=='living'){/* старт с нужного уровня — переводит ведущая */await hostGoto(T,levels[0]==='flight'?'boss':levels[0])}
    for(const lv of levels){T.level=lv;const t0=Date.now();const cs=T.checks.length;console.log(`▶ ${T.name}: ${LVNAME[lv]}`);
      for(const P of T.P){await P.closeUI().catch(()=>{});await P.E('window.__BANNERS=[];0').catch(()=>{})}
      let next=null;try{next=await LEVELS[lv](T)}catch(e){run.bug({team:T,sev:'критический',title:'Сценарий уровня прерван: '+e.message.split('\n')[0],level:lv})}
      if(lv==='boss'){T.levels[lv]={sec:Math.round((Date.now()-t0)/1000),ok:T.checks.slice(cs).every(c=>c.ok),checks:T.checks.length-cs};break}
      // переход: у всех баннер и новый уровень, без нажатия двери
      const want=next||ORDER[ORDER.indexOf(lv)+1];const lvlKey=want==='flight'?'obs':want;
      let moved=true;for(const P of T.P){const r=await P.waitRoom(want==='flight'?'boss':want,want==='flight'?25000:20000).catch(()=>null);
        if(want==='flight'){if(!(await P.E(`!flightBox.hidden||ROOM==='boss'`)))moved=false}else if(r!==want)moved=false}
      if(want!=='flight'&&lv!=='flight'){for(const P of T.P){const seen=await P.E(`(window.__BANNERS||[]).length`).catch(()=>0);T.ok(seen>0,P.name+': показан баннер «Уровень пройден!»')}}
      if(!moved){run.bug({team:T,sev:'критический',title:'Команда не перешла на «'+(LVNAME[want]||want)+'» после прохождения уровня',level:lv});await hostGoto(T,want==='flight'?'boss':want)}
      else if(want!=='flight'&&want!=='boss'){let hv=null;for(let k=0;k<12;k++){hv=await host.$eval('#goto_'+T.id,e=>e.value).catch(()=>null);if(hv===want)break;await W(500)}T.ok(hv===want,'панель ведущей видит команду на уровне «'+LVNAME[want]+'» ('+hv+')')}
      T.levels[lv]={sec:Math.round((Date.now()-t0)/1000),ok:T.checks.slice(cs).every(c=>c.ok),checks:T.checks.length-cs,moved};
      if(want==='flight'&&!levels.includes('flight'))break}
    T.done=Date.now()}
  async function hostGoto(T,lv){console.log(`  ⤳ ведущая переводит ${T.name} на ${lv}`);try{await host.click('#nav button >> text=Команды');await W(300);await host.selectOption('#goto_'+T.id,lv);await host.click(`#goto_${T.id} + button`);await W(300);if(await host.locator('#dlgOk').isVisible())await host.click('#dlgOk');await W(3500);for(const P of T.P){await P.waitRoom(lv);await P.install()}}catch(e){run.bug({team:T,sev:'серьёзный',title:'Ведущая не смогла перевести команду: '+e.message.split('\n')[0]})}}
  await Promise.all(teams.map(T=>play(T).catch(e=>run.bug({team:T,sev:'критический',title:'Прогон команды упал: '+e.message.split('\n')[0]}))));
  // ведущая видит финиш
  await W(3000);await host.click('#nav button >> text=Результаты').catch(()=>{});await W(800);const fin=await host.$eval('#s-res',e=>e.innerText).catch(()=>null);
  await Promise.all(run.pend);
  // отчёт
  const rep={seed:SEED,chaos:CHAOS,teams:teams.map(T=>({name:T.name,players:T.P.map(P=>({name:P.name,profile:PNAME[T.prof(P)],jsErrors:P.errors.length,netErrors:P.net.length,errors:P.errors.slice(0,8)})),levels:T.levels,checks:T.checks.length,failed:T.checks.filter(c=>!c.ok).length,failedSteps:T.failedSteps||0,minutes:T.done?((T.done-tStart)/60000).toFixed(1):null})),hostErrors:hostErr,hostFin:fin,bugs:run.bugs,checks:teams.flatMap(T=>T.checks.map(c=>Object.assign({team:T.name},c))),durationMin:((Date.now()-run.t0)/60000).toFixed(1)};
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(rep,null,1));fs.writeFileSync(path.join(OUT,'report.md'),require('./lib/report').md(rep,LVNAME));
  console.log(`\nГОТОВО за ${rep.durationMin} мин. Проверок: ${rep.checks.length}, провалено: ${rep.checks.filter(c=>!c.ok).length}, багов: ${run.bugs.length}. Отчёт: ${path.join(OUT,'report.md')}`);
  await browser.close();kids.forEach(k=>k.kill());process.exit(0)})();
