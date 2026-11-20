// Локальный MQTT-брокер для тестов (websocket, порт 9001). Нужен: npm i в папке tests.
// BROKER_STATS=файл — раз в 5 с дописывать в файл, сколько сообщений прошло (для нагрузочного теста).
const aedes=require('aedes')();const http=require('http');const ws=require('websocket-stream');const fs=require('fs');
const PORT=+(process.argv[2]||9001);const srv=http.createServer();ws.createServer({server:srv},aedes.handle);
srv.listen(PORT,'127.0.0.1',()=>console.log('MQTT-брокер: ws://127.0.0.1:'+PORT));
if(process.env.BROKER_STATS){let pub=0,bytes=0,peak=0,t0=Date.now();aedes.on('publish',(p,c)=>{if(!c)return;pub++;bytes+=(p.payload&&p.payload.length)||0});
  setInterval(()=>{const r=pub/5;peak=Math.max(peak,r);fs.appendFileSync(process.env.BROKER_STATS,JSON.stringify({t:Math.round((Date.now()-t0)/1000),perSec:r,kbPerSec:Math.round(bytes/5/1024*10)/10,clients:aedes.connectedClients,peak})+'\n');pub=0;bytes=0},5000)}
