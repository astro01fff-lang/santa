// «Лёгкий» игрок для нагрузочного теста: без браузера и графики, но по сети ведёт себя как настоящий.
// Регистрируется у ведущей (имя, персонаж, «готов»), после старта шлёт координаты, действия,
// а главный игрок команды — снимки состояния, прогресс для ведущей и поток финальной битвы.
// Использует тот же клиент связи, что и игра (net/mqtt.js).
const fs=require('fs'),path=require('path'),vm=require('vm');
if(!globalThis.window)globalThis.window=globalThis;
if(!globalThis.MQ)vm.runInThisContext(fs.readFileSync(path.join(__dirname,'..','..','net','mqtt.js'),'utf8'));
const SNAP=JSON.parse(fs.readFileSync(path.join(__dirname,'snap_sample.json'),'utf8'));
const LV=['living','work','clock','stable','kitchen','obs','boss'];
const rid=()=>Math.random().toString(36).slice(2,10);

class Light{
  constructor({url,sid,team,slot,char,name,rng}){Object.assign(this,{url,sid,team,slot,char,name,R:rng||Math.random});
    this.B='santa26/'+sid;this.pid='L'+rid();this.cid=rid();this.sent=0;this.recv=0;this.started=false;this.timers=[];this.x=100+slot*20;this.y=130;this.seq=0;this.lvI=0}
  connect(){return new Promise(res=>{const B=this.B;
    this.C=MQ.connect(this.url,{clientId:'s26'+this.cid,keepalive:20,will:{topic:B+'/pres/'+this.pid,payload:JSON.stringify({on:0,cid:this.cid}),retain:true}});
    this.C.on('connect',()=>{this.C.subscribe(B+'/cfg',1);this.C.subscribe(B+'/roster',1);this.C.subscribe(B+'/t/'+this.team+'/#',1);
      this.C.publish(B+'/pres/'+this.pid,JSON.stringify({on:1,cid:this.cid,t:Date.now()}),{retain:true});res()});
    this.C.on('message',(t,s)=>{this.recv++;if(t===B+'/cfg'){try{const m=JSON.parse(s);if(m.started&&!this.started){this.started=true;this.startT=Date.now();this.run()}}catch(e){}}})})}
  pub(sub,o,q,ret){this.sent++;this.C.publish(this.B+sub,JSON.stringify(o),{qos:q||0,retain:!!ret})}
  join(){this.pub('/req',{pid:this.pid,cid:this.cid,op:'join',name:this.name,team:this.team,char:this.char},1);
    setTimeout(()=>this.pub('/req',{pid:this.pid,cid:this.cid,op:'ready',ready:true},1),800)}
  get lv(){return LV[Math.min(this.lvI,LV.length-1)]}
  run(){const T='/t/'+this.team+'/';const leader=this.slot===0;
    // координаты: пока «ходит» — каждые 0,5 с, иначе раз в 2 с (как sendPos в игре)
    let walkUntil=0;const pos=()=>{const now=Date.now();if(this.R()<.15)walkUntil=now+2000+this.R()*4000;const walking=now<walkUntil;
      if(walking){this.x+=(this.R()-.5)*14;this.y+=(this.R()-.5)*10}
      this.pub(T+'pos',{s:this.slot,x:Math.round(this.x*10)/10,y:Math.round(this.y*10)/10,sc:this.lv,d:'down',p:walking?[[Math.round(this.x/4),Math.round(this.y/4)]]:null,v:1,cid:this.cid});
      this.timers.push(setTimeout(pos,walking?500:2000))};pos();
    // действия игрока: изменение общего состояния раз в 8–15 с
    const act=()=>{this.seq++;this.pub(T+'ev',{ty:'d',s:this.slot,cid:this.cid,seq:this.seq,lv:this.lv,ops:[['st.pf.load'+this.slot+'_'+this.seq,1,0]],inv:{add:[],rm:[]},notes:{add:[],rm:[]}},1);
      this.timers.push(setTimeout(act,8000+this.R()*7000))};this.timers.push(setTimeout(act,3000+this.R()*5000));
    if(leader){
      // снимок команды (≈3 КБ) раз в секунду, прогресс ведущей раз в 3 с, уровень сменяется примерно раз в 90 с
      const snap=()=>{this.pub(T+'state',Object.assign({ty:'snap',acks:{},lv:this.lv,inFlight:false,at:Date.now(),inv:[],notes:[],boss:{phase:'intro',hp:100,pen:0},cid:this.cid},SNAP),1,true);this.timers.push(setTimeout(snap,1000))};snap();
      const prog=()=>{this.pub('/host',{ty:'prog',team:this.team,lv:this.lv,pen:0,boss:this.lv==='boss'?{phase:'fight',hp:60}:null,leader:0});this.timers.push(setTimeout(prog,3000))};prog();
      const lvl=()=>{if(this.lvI<LV.length-1){this.lvI++;this.pub(T+'ev',{ty:'lvl',next:this.lv,cid:this.cid,id:rid()},1)}this.timers.push(setTimeout(lvl,this.levelMs||90000))};this.timers.push(setTimeout(lvl,this.levelMs||90000));
      // финальная битва: поток состояния боя ~5,5 раз в секунду
      const boss=()=>{if(this.lv==='boss')this.pub(T+'boss',{sb:{phase:'fight',hp:60,qx:190,qy:128,spikes:[],orbs:[],frozen:{},lives:{},cd:{}},t:Date.now()});this.timers.push(setTimeout(boss,180))};boss()}}
  stop(){this.timers.forEach(clearTimeout);try{this.C.end()}catch(e){}}
}
module.exports={Light};
