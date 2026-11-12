// Тестовый веб-сервер: раздаёт файлы игры из корня репозитория.
// В index.html на лету добавляет крючок window.__EV для ботов. Сам файл игры не меняется.
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');const PORT=+(process.argv[2]||8765);
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.ogg':'audio/ogg','.json':'application/json','.css':'text/css','.woff2':'font/woff2'};
http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';
  const f=path.join(ROOT,u);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('нет');return}
  let body=fs.readFileSync(f);
  if(u==='/index.html'){const s=body.toString('utf8');if(!s.includes('/*NET-END*/'))throw new Error('в index.html нет метки /*NET-END*/');body=Buffer.from(s.replace('/*NET-END*/','/*NET-END*/\nwindow.__EV=s=>eval(s);'))}
  res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store','X-Santa-QA':'1'});res.end(body)
}).listen(PORT,'127.0.0.1',()=>console.log('тестовый сервер: http://127.0.0.1:'+PORT));
