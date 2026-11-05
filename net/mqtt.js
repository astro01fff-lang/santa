// Мини-клиент MQTT 3.1.1 поверх WebSocket (без внешних библиотек).
// API: const c=MQ.connect(url,{clientId,will:{topic,payload,qos,retain},keepalive});
// c.on('connect'|'close'|'message'(topic,str,retain)); c.subscribe(filter,qos); c.publish(topic,str,{qos,retain}); c.end()
(function(){
const enc=new TextEncoder(),dec=new TextDecoder();
function strBytes(s){const b=enc.encode(s);const o=new Uint8Array(2+b.length);o[0]=b.length>>8;o[1]=b.length&255;o.set(b,2);return o}
function varLen(n){const out=[];do{let d=n%128;n=Math.floor(n/128);if(n>0)d|=128;out.push(d)}while(n>0);return out}
function packet(type,flags,parts){let len=0;parts.forEach(p=>len+=p.length);const vl=varLen(len);const o=new Uint8Array(1+vl.length+len);o[0]=(type<<4)|flags;o.set(vl,1);let k=1+vl.length;parts.forEach(p=>{o.set(p,k);k+=p.length});return o}
function u16(n){return new Uint8Array([n>>8,n&255])}
function topicMatch(f,t){const F=f.split('/'),T=t.split('/');for(let i=0;i<F.length;i++){if(F[i]==='#')return true;if(i>=T.length)return false;if(F[i]!=='+'&&F[i]!==T[i])return false}return F.length===T.length}
function connect(url,opt){opt=opt||{};
  const ev={},emit=(n,...a)=>(ev[n]||[]).forEach(f=>{try{f(...a)}catch(e){console.error(e)}});
  const subs=new Map();let ws=null,buf=new Uint8Array(0),pid=1,connected=false,closedByUser=false,ping=0,retry=0,lastIn=0,rt=0;
  const queue=[];const inflight=new Map();
  const nextId=()=>{pid=pid%65535+1;return pid};
  const c={get connected(){return connected},url,
    on(n,f){(ev[n]=ev[n]||[]).push(f);return c},
    subscribe(f,q){subs.set(f,q||0);if(connected)sendSub([[f,q||0]])},
    unsubscribe(f){subs.delete(f);if(connected){const id=nextId();send(packet(10,2,[u16(id),strBytes(f)]))}},
    publish(topic,str,o){o=o||{};const q=o.qos?1:0;const m={topic,str,q,r:!!o.retain};if(connected)pub(m);else{if(queue.length>500)queue.shift();queue.push(m)}},
    end(){closedByUser=true;clearInterval(ping);clearTimeout(rt);try{if(ws&&ws.readyState===1)ws.send(packet(14,0,[]))}catch(e){}try{ws&&ws.close()}catch(e){}connected=false},
    reconnectNow(){if(!connected&&!closedByUser){clearTimeout(rt);open()}}};
  function send(b){try{if(ws&&ws.readyState===1)ws.send(b)}catch(e){}}
  function pub(m){const parts=[strBytes(m.topic)];let id=0;if(m.q){id=nextId();parts.push(u16(id));inflight.set(id,{m,t:Date.now()})}parts.push(enc.encode(m.str));send(packet(3,(m.q<<1)|(m.r?1:0),parts))}
  function sendSub(list){const id=nextId();const parts=[u16(id)];list.forEach(([f,q])=>{parts.push(strBytes(f));parts.push(new Uint8Array([q]))});send(packet(8,2,parts))}
  function open(){
    try{ws=new WebSocket(url,['mqtt'])}catch(e){schedule();return}
    ws.binaryType='arraybuffer';buf=new Uint8Array(0);
    ws.onopen=()=>{const ka=opt.keepalive||30;let flags=2;const pay=[strBytes(opt.clientId||('c'+Math.random().toString(36).slice(2,12)))];
      if(opt.will){flags|=4|((opt.will.qos||0)<<3)|(opt.will.retain?32:0);pay.push(strBytes(opt.will.topic));const wb=enc.encode(opt.will.payload||'');pay.push(u16(wb.length),wb)}
      const vh=new Uint8Array([0,4,77,81,84,84,4,flags,ka>>8,ka&255]);send(packet(1,0,[vh,...pay]))};
    ws.onmessage=e=>{const d=new Uint8Array(e.data);const nb=new Uint8Array(buf.length+d.length);nb.set(buf);nb.set(d,buf.length);buf=nb;lastIn=Date.now();parse()};
    ws.onclose=()=>{const was=connected;connected=false;clearInterval(ping);if(was)emit('close');if(!closedByUser)schedule()};
    ws.onerror=()=>{};
  }
  function schedule(){clearTimeout(rt);retry=Math.min(retry+1,6);rt=setTimeout(open,Math.min(8000,400*Math.pow(1.7,retry))+Math.random()*400)}
  function parse(){
    while(buf.length>=2){let mul=1,len=0,i=1,b;do{if(i>=buf.length)return;b=buf[i++];len+=(b&127)*mul;mul*=128}while(b&128);
      if(buf.length<i+len)return;const type=buf[0]>>4,flags=buf[0]&15,body=buf.subarray(i,i+len);buf=buf.slice(i+len);handle(type,flags,body)}}
  function handle(type,flags,b){
    if(type===2){if(b[1]!==0){emit('error','connack '+b[1]);try{ws.close()}catch(e){}return}
      connected=true;retry=0;const list=[...subs.entries()];if(list.length)sendSub(list);
      inflight.forEach(x=>queue.unshift(x.m));inflight.clear();
      while(queue.length)pub(queue.shift());
      clearInterval(ping);const ka=(opt.keepalive||30)*1000;ping=setInterval(()=>{send(new Uint8Array([192,0]));if(Date.now()-lastIn>ka*2.2){try{ws.close()}catch(e){}}
        inflight.forEach((x,id)=>{if(Date.now()-x.t>8000){inflight.delete(id);pub(x.m)}})},Math.max(3000,ka/2));
      emit('connect');return}
    if(type===3){const q=(flags>>1)&3,ret=!!(flags&1);const tl=(b[0]<<8)|b[1];const topic=dec.decode(b.subarray(2,2+tl));let k=2+tl;
      if(q>0){const id=(b[k]<<8)|b[k+1];k+=2;send(packet(4,0,[u16(id)]))}
      const str=dec.decode(b.subarray(k));emit('message',topic,str,ret);return}
    if(type===4){const id=(b[0]<<8)|b[1];inflight.delete(id);return}
  }
  open();return c}
window.MQ={connect,topicMatch};
})();
