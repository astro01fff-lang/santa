// Локальный MQTT-брокер для тестов (websocket, порт 9001). Нужен: npm i в папке tests.
const aedes=require('aedes')();const http=require('http');const ws=require('websocket-stream');
const PORT=+(process.argv[2]||9001);const srv=http.createServer();ws.createServer({server:srv},aedes.handle);
srv.listen(PORT,'127.0.0.1',()=>console.log('MQTT-брокер: ws://127.0.0.1:'+PORT));
