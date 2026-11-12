// Команда из нескольких виртуальных игроков: выбор действующего игрока, профили поведения,
// проверки, запись багов, сверка состояния между игроками.
const {W}=require('./player');const {goTo}=require('./levels');
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
class Team{
  constructor(run,id,name,profiles,seed){this.run=run;this.id=id;this.name=name;this.profiles=profiles;this.R=rng(seed);this.seed=seed;this.P=[];this.level='living';this.checks=[];this.stepN=0;this.levels={}}
  pick(a){return a[Math.floor(this.R()*a.length)]}
  who(){if(this.P.length<2)return this.P[0];return this.P[Math.floor(this.R()*this.P.length)]}
  any(){return this.P[0]}
  other(P){return this.P.find(q=>q!==P)}
  prof(P){return this.profiles[this.P.indexOf(P)]}
  ok(c,msg,sev){this.checks.push({level:this.level,ok:!!c,msg});if(!c)this.run.bug({team:this,sev:sev||'серьёзный',title:msg,level:this.level});return !!c}
  async step(room,fn){this.stepN++;const P=this.who();const partner=this.other(P);
    const noise=partner&&this.level!=='boss'&&this.level!=='flight'?this.noise(partner):Promise.resolve();
    if(this.prof(P)==='unstable'&&this.R()<.12)this.blip(P,1500+this.R()*2500);
    let err=null;for(const Q of [P,partner].filter(Boolean)){try{await this.ready(Q);await goTo(Q,room);await fn(Q);err=null;break}catch(e){err=e;Q.log('ОШИБКА: '+e.message.split('\n')[0]);await Q.closeUI().catch(()=>{});await W(1200)}}
    await noise.catch(()=>{});if(err&&/has been closed/.test(err.message))throw err;
    if(err){this.run.bug({team:this,sev:'серьёзный',title:'Шаг не выполнился ни у одного игрока: '+err.message.split('\n')[0],level:this.level,room});this.failedSteps=(this.failedSteps||0)+1}
    await W(this.P.length>1?250:60)}
  async ready(P){if(!P.online){/* ждём, пока связь вернётся */for(let k=0;k<40&&!P.online;k++)await W(250)}
    if(P.needReload){P.needReload=false;await P.reload()}}
  blip(P,ms){if(!P.online)return;P.setOffline(true).then(()=>W(ms)).then(()=>P.setOffline(false)).catch(()=>{})}
  async take(P,h,name){const prof=this.P.map(q=>this.prof(q));
    if(this.P.length>1&&(prof.includes('active')||prof.includes('chaos')&&this.R()<.5)){
      const Q=this.other(P);await this.ready(Q);const room=await P.E('ROOM');await goTo(Q,room).catch(()=>{});
      P.log('берёт «'+name+'» одновременно с '+Q.name);Q.log('берёт «'+name+'» одновременно с '+P.name);
      await Promise.all([P.act(h,name),Q.act(h,name).catch(()=>{})]);await W(1500);
      for(const R of this.P){const n=await R.E(`TEAM.inv.map(baseIt).filter(x=>x===${JSON.stringify(name)}).length`);this.ok(n===1,'одновременный клик двоих: «'+name+'» в инвентаре ровно 1 раз у '+R.name+' (сейчас '+n+')')}
    }else{await P.act(h,name);this.ok(await P.waitFor(`anyHas(${JSON.stringify(name)})`),'взят предмет «'+name+'»')}}
  async noise(P){const pr=this.prof(P);if(pr==='sequential')return;await this.ready(P);
    const kind=pr==='chaos'?this.pick(['explorer','careless','active','unstable','none']):pr;
    if(kind==='explorer'){const n=1+Math.floor(this.R()*3);for(let k=0;k<n;k++){const r=await P.E(`(()=>{const its=curItems().filter(it=>it.hit&&!/goScene|levelDone|startFlight/.test(String(it.act)));if(!its.length)return null;const it=its[Math.floor(${this.R()}*its.length)];TEAM.inv=TEAM.inv.map(x=>x.startsWith('@'+me+':')?x.slice(x.indexOf(':')+1):x);bubble=null;actOn(it);return it.hit.join(',')+' → '+(bubble?bubble.text.slice(0,50):'окно')})()`).catch(e=>'ошибка '+e.message);if(r)P.log('осматривает '+r);await W(300);await P.closeUI()}}
    else if(kind==='careless'){const a=this.R();
      if(a<.08){P.log('обновил страницу');await P.reload()}
      else if(a<.35){const sc=await P.E(`(()=>{const subs={stable:['loft','forge'],kitchen:['pantry'],pantry:['cellar','kitchen'],loft:['stable'],forge:['stable'],cellar:['pantry']}[ROOM];return subs?subs[0]:null})()`);if(sc){await goTo(P,sc).catch(()=>{});P.log('ушёл в '+sc+' и вернулся');await W(600)}}
      else if(a<.7){const n=await P.pg.locator('#inv .slot.full').count();if(n){const i=Math.floor(this.R()*n);P.log('потыкал инвентарь');await P.pg.locator('#inv .slot.full').nth(i).click().catch(()=>{});await W(150);await P.pg.locator('#inv .slot.full').nth(i).click().catch(()=>{});await P.E('unholdIt();0').catch(()=>{})}}
      else{P.log('нажал Escape');await P.pg.keyboard.press('Escape');await P.closeUI()}}
    else if(kind==='active'){const box=await P.pg.locator('#game').boundingBox().catch(()=>null);if(box){P.log('быстро накликал по сцене');for(let k=0;k<6;k++){await P.pg.mouse.click(box.x+box.width*(.2+.6*this.R()),box.y+box.height*(.4+.5*this.R()));await W(40)}await W(400);await P.closeUI()}}
    else if(kind==='unstable'){if(this.R()<.4){const ms=2500+this.R()*5000;await P.setOffline(true);await W(ms);await P.setOffline(false);await W(800)}}}
  async sync(){await W(1500);if(this.P.length<2)return;
    const snap=P=>P.E(`(()=>{const out={};const walk=(o,p,d)=>{if(d>3||o==null)return;for(const k in o){const v=o[k];if(/^(so\.(beam|passed|hitDecoy)|sc\.ang|st\.(hangT|catT)|sk\.melt|sw\.gifts\.\d+\.s$)/.test(p+k))continue;if(/T$|^t$|At$|^t0$|cd|parts|beams|spikes|orbs|shots|taunt|melt|^s$|frost/.test(k))continue;if(typeof v==='boolean'||typeof v==='string'||(typeof v==='number'&&Number.isInteger(v)&&Math.abs(v)<1000))out[p+k]=v;else if(typeof v==='object')walk(v,p+k+'.',d+1)}};
      const L=levelOf(ROOM);const R={living:'st',work:'sw',clock:'sc',stable:'ss',kitchen:'sk',obs:'so'}[L];if(R)walk(eval(R),R+'.',0);out.inv=TEAM.inv.map(baseIt).sort().join('|');out.level=L;return out})()`);
    let diff=[];for(let a=0;a<4;a++){const [A,B]=await Promise.all(this.P.map(snap));diff=Object.keys(Object.assign({},A,B)).filter(k=>JSON.stringify(A[k])!==JSON.stringify(B[k])).map(k=>k+': '+JSON.stringify(A[k])+' / '+JSON.stringify(B[k]));if(!diff.length)return;await W(1500)}
    this.ok(false,'Состояние у игроков разошлось: '+diff.slice(0,6).join('; '),'серьёзный')}
}
module.exports={Team,rng};
