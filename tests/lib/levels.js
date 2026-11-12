// Сценарии прохождения уровней командой. Каждый шаг делает игрок, которого выбирает T.who()
// (по профилю и сиду), поэтому вещи находит один, а применяет другой — как в живой игре.
const {W}=require('./player');
// двери между под-локациями: [откуда, куда, зона двери]
const DOORS=[['stable','loft',[236,0]],['stable','forge',[0,44]],['loft','stable',[0,118]],['forge','stable',[0,26]],
  ['kitchen','pantry',[232,22]],['pantry','kitchen',[0,24]],['pantry','cellar',[186,110]],['cellar','pantry',[0,5]]];
async function goTo(P,room){for(let k=0;k<4;k++){const cur=await P.E('ROOM');if(cur===room)return;
  // ищем путь по дверям
  const q=[[cur]];const seen=new Set([cur]);let path=null;while(q.length){const pth=q.shift();const last=pth[pth.length-1];if(last===room){path=pth;break}
    for(const [a,b] of DOORS)if(a===last&&!seen.has(b)){seen.add(b);q.push(pth.concat(b))}}
  if(!path)throw new Error('нет пути '+cur+' → '+room);const d=DOORS.find(([a,b])=>a===path[0]&&b===path[1]);await P.act(d[2],'дверь '+d[0]+'→'+d[1]);await W(350)}
  if(await P.E('ROOM')!==room)throw new Error('не дошёл до '+room)}

const LEVELS={
async living(T){
  await T.step('living',async P=>{await T.take(P,[6,143],'пустое ведро')});
  await T.step('living',async P=>{await P.hold('пустое ведро');await P.act([33,10],'окно (снег)');T.ok(await P.waitFor(`anyHas('ведро снега')`),'ведро снега набрано')});
  await T.step('living',async P=>{const r=await P.act([119,48],'камин');T.ok(/руку не сунешь/.test(r||''),'камин без ведра в руках не тушится')});
  await T.step('living',async P=>{await P.hold('ведро снега');await P.act([119,48],'камин');await P.act([119,48],'камин');T.ok(await P.waitFor(`anyHas('ключ от шкафа')`),'камин потушен, ключ из золы')});
  await T.step('living',async P=>{await P.act([78,15],'сейф');await P.act([78,15],'сейф');await P.code('2140');T.ok(await P.waitFor('st.safeOpen'),'сейф открыт кодом 2140')});
  await T.step('living',async P=>{await P.hold('золотой ключик');await P.act([173,7],'часы с кукушкой');await W(2200);await P.pg.click('#clockclose').catch(()=>{});T.ok(await P.waitFor('st.clock'),'часы заведены')});
  for(const h of [[95,130],[23,7],[142,34],[79,117],[121,92]])await T.step('living',async P=>{await P.act(h)});
  await T.step('living',async P=>{await T.take(P,[137,89],'стакан молока')});
  await T.step('living',async P=>{await P.act([155,108],'кот');T.ok(!(await P.E('st.catMoved')),'кот не реагирует без молока в руках')});
  await T.step('living',async P=>{await P.hold('стакан молока');await P.act([155,108],'кот');T.ok(await P.waitFor('st.catMoved'),'кот выпил молоко')});
  await T.step('living',async P=>{await P.act([211,117],'подарок');T.ok(!(await P.E('st.gift')),'подарок не режется без ножниц')});
  await T.step('living',async P=>{await P.hold('ножницы');await P.act([211,117],'подарок');T.ok(await P.waitFor('st.gift'),'подарок разрезан')});
  await T.step('living',async P=>{await P.hold('ключ от шкафа');await P.act([199,7],'шкаф');await P.act([199,7],'шкаф');T.ok(await P.waitFor('st.book'),'книжный шкаф открыт')});
  for(const h of [[209,56],[59,7],[112,34],[45,58],[47,75],[37,58],[147,130],[102,135],[84,129]])await T.step('living',async P=>{await P.act(h);await P.closeUI()});
  await T.sync();
  await T.step('living',async P=>{T.ok(await P.waitFor('st.pieces===9'),'все 9 обрывков фото: '+await P.E('st.pieces'))});
  // ёлку наряжают все: каждый вешает свои игрушки, звезду — последней
  const hang=async(P,star)=>{await T.ready(P);await goTo(P,'living');await P.act([209,56],'ёлка');await W(400);const tb=await P.pg.locator('#treecv').boundingBox();const hooks=await P.E('HOOKS');
    const mine=await P.E(`Object.keys(ORNN).filter(k=>st.orn[k]&&!st.hung[k]&&ornMine(k))`);let n=0;
    for(const h of hooks.filter(h=>h.ans&&mine.includes(h.ans)&&(star?h.ans==='star':h.ans!=='star'))){const nm=await P.E(`ORNN['${h.ans}']`);
      await P.pg.click(`#tray button[aria-label="${nm}"]`,{timeout:5000});await P.pg.mouse.click(tb.x+h.x/1536*tb.width,tb.y+h.y/1024*tb.height);await W(150);n++}
    P.log('повесил на ёлку: '+n+(star?' (звезда)':''));if(!star)await P.pg.click('#treeclose').catch(()=>{});return n};
  let total=0;for(const P of T.P){try{total+=await hang(P,false)}catch(e){T.ok(false,P.name+': не смог повесить свои игрушки: '+e.message.split('\n')[0])}}
  await W(1500);T.ok(await T.any().waitFor('Object.keys(st.hung).length===8'),'8 игрушек на ёлке ('+await T.any().E('Object.keys(st.hung).length')+')');
  const owner=await T.any().E(`st.ornOwner&&st.ornOwner.star`);const SP=T.P.find(async Q=>true)&&(await (async()=>{for(const Q of T.P)if(await Q.E('me')===owner)return Q;return T.P[0]})());
  await hang(SP,true).catch(e=>T.ok(false,'звезда: '+e.message.split('\n')[0]));T.ok(await SP.waitFor('st.lit'),'ёлка горит');
  return 'work'},

async work(T){
  for(const h of [[48,56],[74,30],[125,23]])await T.step('work',async P=>{await P.act(h);await P.closeUI()});
  await T.step('work',async P=>{await P.act([105,20],'сейф мастерской');await P.code('472')});
  await T.step('work',async P=>{await P.hold('ключ от ящика');await P.act([160,27],'ящик')});
  await T.step('work',async P=>{await T.take(P,[229,50],'стремянка')});
  await T.step('work',async P=>{await P.hold('стремянка');await P.act([176,3],'верхняя полка')});
  for(const h of [[229,40],[215,76],[1,112],[7,81]])await T.step('work',async P=>{await P.act(h);await P.closeUI()});
  await T.step('work',async P=>{await P.hold('рычаг');await P.act([44,98],'пульт конвейера');T.ok(await P.waitFor('sw.running'),'конвейер запущен')});
  await T.step('work',async P=>{T.ok(await P.waitFor(`TEAM.notes.filter(n=>n.t.startsWith('Письмо')).length===8`),'найдено 8 писем')});
  for(let i=0;i<8;i++){
    await T.step('work',async P=>{if(!(await P.E(`!!sw.boxes[${i}].name`))){const lab=await P.E(`TEAM.inv.map(baseIt).find(x=>x.startsWith('табличка'))`);await P.hold(lab);await P.E(`BOT.near(BXC[${i}],150);BOT.act([BXC[${i}]-11,144])`);P.log('табличка на коробку '+i)}});
    await T.step('work',async P=>{const w=await P.E(`WANT[sw.boxes[${i}].name]`);let r;
      for(let a=0;a<10;a++){r=await P.E(`(()=>{const g0=sw.gifts.find(g=>g.n===WANT[sw.boxes[${i}].name]&&g.on&&!g.gone);if(!g0)return null;const [x,y]=loopPos(g0.s);BOT.near(x,y+2);return CONV.act()})()`);if(await P.E(`!!(people[me].held)`))break;await W(400)}
      P.log('снял с ленты «'+w+'»');T.ok(await P.E('!!people[me].held'),'подарок «'+w+'» в руках');
      await P.E(`BOT.near(BXC[${i}],150);BOT.act([BXC[${i}]-11,144])`);P.log('положил в коробку '+i);
      T.ok(await P.waitFor(`sw.boxes[${i}].done`),'коробка '+(i+1)+' собрана')});
  }
  await T.step('work',async P=>{T.ok(await P.waitFor('sw.done'),'все подарки разложены')});
  return 'clock'},

async clock(T){
  for(const h of [[142,60],[48,55],[103,104],[162,73]])await T.step('clock',async P=>{await P.act(h);await P.closeUI()});
  await T.step('clock',async P=>{const r=await P.act([90,88],'ящик верстака');T.ok(/заперт/.test(r||''),'ящик верстака заперт')});
  await T.step('clock',async P=>{await T.take(P,[69,71],'ключик от верстака')});
  await T.step('clock',async P=>{await P.hold('ключик от верстака');await P.act([90,88],'ящик верстака');T.ok(await P.waitFor('sc.drawer'),'ящик открыт')});
  await T.step('clock',async P=>{await P.act([177,88],'замок');await P.code('231')});
  await T.step('clock',async P=>{await P.act([168,46],'маятник');T.ok(await P.waitFor(`anyHas('ключик от шкатулки')`),'ключик за маятником')});
  await T.step('clock',async P=>{await P.hold('ключик от шкатулки');await P.act([220,40],'антресоль');await P.pick('Открыть шкатулку');T.ok(await P.waitFor('sc.loft'),'шкатулка открыта')});
  await T.sync();
  await T.step('clock',async P=>{T.ok(await P.waitFor(`GUSED.every(i=>sc.g[i].owner!==null)`),'найдены все 6 шестерёнок')});
  // механизм собирают все: каждый ставит свои шестерёнки
  for(const P of T.P){try{await T.ready(P);await goTo(P,'clock');await P.act([90,0],'механизм');await W(400);const gb=await P.pg.locator('#gearcv').boundingBox();
    const K=Math.min(gb.width/1536,gb.height/1024),ox=(gb.width-1536*K)/2,oy=(gb.height-1024*K)/2;const n=await P.pg.locator('#geartray button').count();
    for(let k=0;k<n;k++){await P.pg.click('#geartray button >> nth=0',{timeout:5000});const tgt=await P.E(`(()=>{const p=Object.keys(TSIZE).find(p=>TSIZE[p]===GSIZE[gearSel]&&!sc.g.some(o=>o.peg===p));return PEGS[p]})()`);
      await P.pg.mouse.click(gb.x+ox+(tgt[0]+25)*K,gb.y+oy+(tgt[1]-15)*K);await W(200)}
    P.log('поставил своих шестерёнок: '+n);if(!(await P.E('sc.done')))await P.pg.click('#gearclose').catch(()=>{})}catch(e){T.ok(false,P.name+': не смог поставить свои шестерёнки: '+e.message.split('\n')[0])}}
  T.ok(await T.any().waitFor('sc.done'),'механизм часов собран');
  return 'stable'},

async stable(T){
  await T.step('stable',async P=>{await P.act([2,107],'сани')});
  await T.step('stable',async P=>{await P.act([220,126],'сундук');for(let i=0;i<4;i++){const n=[1,2,3,0][i];for(let c=0;c<n;c++)await P.pick((i+1)+':')}await P.pick('Открыть');T.ok(await P.waitFor(`anyHas('упряжь')`),'сундук с упряжью открыт')});
  for(const h of [[50,15],[18,83]])await T.step('stable',async P=>{await P.act(h);await P.closeUI()});
  await T.step('loft',async P=>{await T.take(P,[96,38],'фонарь')});
  for(const h of [[110,48],[157,22],[52,65],[202,72]])await T.step('loft',async P=>{await P.act(h);await P.closeUI()});
  await T.step('stable',async P=>{await P.hold('фонарь');await P.act([40,92],'ведро со льдом');T.ok(await P.waitFor('ss.bucket'),'лёд растоплен фонарём')});
  await T.step('stable',async P=>{T.ok(await P.waitFor(`TEAM.notes.filter(n=>n.t.startsWith('Записка Санты')).length===4`),'4 записки Санты')});
  await T.step('forge',async P=>{await T.take(P,[50,28],'молоток')});
  await T.step('forge',async P=>{await T.take(P,[51,55],'клещи')});
  await T.step('forge',async P=>{await P.hold('подкова');await P.act([100,36],'горн');T.ok(await P.waitFor(`ss.horse==='hot'`),'подкова в горне');
    const rf=await P.act([100,36],'горн');T.ok(/Голыми руками/.test(rf||''),'из горна голыми руками не достать')});
  await T.step('forge',async P=>{await P.hold('клещи');await P.act([100,36],'горн');T.ok(await P.E(`heldBy(me)`)==='клещи с подковой','подкова в клещах');
    await P.act([104,86],'наковальня');await P.hold('молоток');await P.act([104,86],'наковальня');await P.hold('клещи');await P.act([104,86],'наковальня');await P.act([205,74],'бочка');
    T.ok(await P.waitFor(`anyHas('новая подкова')`),'новая подкова выкована')});
  await T.step('stable',async P=>{const STALL=await P.E('STALL');for(let i=0;i<8;i++){await P.E(`stallAct(${i});0`);if(await P.E('pick.hidden'))await P.E(`stallAct(${i});0`);
      if(!(await P.E('pick.hidden'))){await P.pg.locator('#pickopts button').filter({hasText:new RegExp('^'+STALL[i]+'$')}).first().click();await W(120)}}
    P.log('развесил таблички');T.ok(await P.waitFor('ss.namesOK'),'таблички на стойлах')});
  await T.step('stable',async P=>{const sk=await P.E(`STALL.indexOf('Скакун')`);await P.hold('новая подкова');await P.E(`say(people[me],stallAct(${sk}));0`);await P.hold('молоток');await P.E(`say(people[me],stallAct(${sk}));0`);T.ok(await P.waitFor('ss.shod'),'Скакун подкован')});
  await T.step('stable',async P=>{await P.hold('упряжь');const ANS=await P.E('ANSWER');const SL=await P.E('SLOTS');for(let i=0;i<8;i++){await P.E(`slotAct(${i});0`);await P.pick(ANS[SL[i].k+SL[i].side])}P.log('запряг оленей')});
  await T.step('stable',async P=>{await P.act([2,107],'сани');T.ok(await P.waitFor('ss.done'),'сани взлетели')});
  return 'kitchen'},

async kitchen(T){
  await T.step('kitchen',async P=>{await P.act([10,51],'рисунок');T.ok(/обороте/.test(await P.E(`document.getElementById('picktext').textContent`)),'рисунок: подсказка про оборот');await P.pick('Перевернуть');T.ok(/обороте детским/.test(await P.E(`document.getElementById('picktext').textContent`)),'подпись на обороте');
    await P.pick('Открыть холодильник');await P.act([42,69],'холодильник');await P.pick('Формочка: звезда')});
  await T.step('pantry',async P=>{await P.act([196,48]);await P.closeUI()});
  await T.step('cellar',async P=>{await P.act([184,50]);await P.closeUI()});
  await T.step('cellar',async P=>{await P.act([118,42],'кодовый замок');await P.code('423')});
  for(const h of [[146,70],[204,117]])await T.step('cellar',async P=>{await P.act(h);await P.closeUI()});
  await T.step('pantry',async P=>{const rs=await P.act([67,27],'верхняя полка');T.ok(/высоко/.test(rs||''),'без стремянки полку не достать')});
  await T.step('pantry',async P=>{await P.hold('стремянка');await P.act([67,27],'верхняя полка');T.ok(await P.waitFor(`sk.ladderAt==='left'`),'стремянка у левой полки')});
  await T.step('pantry',async P=>{await P.act([67,27],'верхняя полка');await P.pick('серебряной');await P.act([120,24],'полка');await P.pick('Переставить');await P.act([120,24],'полка');await P.pick('Имбирь')});
  await T.sync();
  await T.step('kitchen',async P=>{T.ok(await P.waitFor(`['мука','мёд во льду','имбирь','серебряная корица','звёздная пыль','формочка: звезда'].every(anyHas)`),'все продукты и формочка собраны: '+await P.E('TEAM.inv.join(", ")'))});
  await T.step('kitchen',async P=>{await P.E(`BOT.near(212,104);0`);await P.hold('мёд во льду');await P.act([202,50],'плита (мёд)');T.ok(await P.waitFor(`anyHas('мёд')`,12000),'мёд растаял')});
  await T.step('kitchen',async P=>{const REC=await P.E('RECIPE');for(const [k,n,u] of REC){await P.act([117,72],'миска');await P.pick('Положить: '+k);for(let c=0;c<n;c++)await P.pick(u==='стакан'?'+1 стакан':'+1 ложка');await P.pick('Положить в миску')}P.log('замесил тесто')});
  await T.step('kitchen',async P=>{await P.hold('формочка: звезда');await P.act([143,40],'духовка');await P.pick('Жар');for(let c=0;c<3;c++)await P.pick('Время');await P.pick('Печь!');T.ok(await P.waitFor('sk.done'),'пряники испеклись')});
  return 'obs'},

async obs(T){
  for(const h of [[1,134],[36,154],[38,134],[103,120],[188,24]])await T.step('obs',async P=>{await P.act(h);await P.closeUI()});
  await T.step('obs',async P=>{await P.act([137,146],'сундук обсерватории');await P.code('753')});
  await T.step('obs',async P=>{await P.hold('шестеренка');await P.act([35,36],'механизм купола');T.ok(await P.waitFor('so.dome'),'купол открыт')});
  const MIR=await T.any().E(`MIR.filter(o=>!o.decoy).map(o=>o.n)`);
  for(const n of MIR)await T.step('obs',async P=>{const hn=await P.E(`TEAM.inv.map(baseIt).find(x=>x.startsWith('ручка'))`);await P.hold(hn);await P.E(`mirAct(MIR.find(o=>o.n==='${n}'));0`);P.log('вставил ручку в зеркало '+n)});
  await T.sync();
  await T.step('obs',async P=>{T.ok(await P.waitFor(`MIR.filter(o=>!o.decoy).every(o=>so.mir[o.n].owner!==null&&so.mir[o.n].owner!==undefined)`),'ручки вставлены во все зеркала');
    const sol=await P.E(`(()=>{const ns=${JSON.stringify(MIR)};const save=ns.map(n=>so.mir[n].st);for(let c=0;c<256;c++){ns.forEach((n,i)=>so.mir[n].st=(c>>(i*2))&3);traceBeam();if(so.done){so.done=false;const r=ns.map(n=>so.mir[n].st);ns.forEach((n,i)=>so.mir[n].st=save[i]);Object.values(so.mir).forEach(m=>m.frost=false);traceBeam();return r}}return null})()`);
    T.ok(!!sol,'у задачи с зеркалами есть решение');
    if(sol)for(let i=0;i<MIR.length;i++){const ow=await P.E(`so.mir['${MIR[i]}'].owner`);let Q=P;for(const R of T.P)if(await R.E('me')===ow)Q=R;
      for(let c=0;c<8&&await Q.E(`so.mir['${MIR[i]}'].st`)!==sol[i];c++){await Q.E(`mirAct(MIR.find(o=>o.n==='${MIR[i]}'));0`);await W(150)}Q.log('повернул своё зеркало '+MIR[i]);await W(400)}
    T.ok(await P.waitFor('so.done'),'луч попал в кристалл')});
  return 'flight'},

async flight(T){
  // полёт: оба игрока видят его и пропускают кнопкой
  for(const P of T.P){const fl=await P.waitFor('!flightBox.hidden',15000);T.ok(fl||await P.E(`ROOM==='boss'`),P.name+': полёт на санях показан')}
  await W(2500);for(const P of T.P){P.log('пропустил полёт');await P.pg.click('#flightskip').catch(()=>{})}
  return 'boss'},

async boss(T){
  // каждый игрок разбивает лёд вокруг своего жезла и стреляет; замёрзшего отогревают
  for(const P of T.P){await P.closeUI();for(let a=0;a<12;a++){if(await P.E('hasWand(me)'))break;
    await P.E(`(()=>{const its=bossItems();const it=its[${T.P.indexOf(P)}%Math.max(1,its.length)]||its[0];if(!it)return 0;BOT.near(it.x,it.y);it.act(people[me]);return 1})()`);await W(250)}
    P.log('взял жезл');T.ok(await P.waitFor('hasWand(me)',5000),P.name+': световой жезл получен')}
  const t0=Date.now();let frozenSeen=0;
  while(Date.now()-t0<240000){const ph=await T.P[0].E('sb.phase');if(ph==='win')break;
    for(const P of T.P){const st=await P.E(`(()=>{const fr=people.filter(p=>!p.gone&&!p.off&&isFrozen(p.i)&&p.i!==me);if(isFrozen(me))return 'frozen';if(fr.length){const q=fr[0];const p=people[me];p.x=q.x+6;p.y=q.y;return 'thaw'}
        const p=people[me];if(p.x<60||p.x>320){p.x=150}const qx=sb.qx;bossShoot();return 'shoot'})()`).catch(()=>'err');if(st!=='shoot')frozenSeen++}
    await W(400)}
  const win=await T.P[0].E(`sb.phase==='win'`);T.ok(win,'Снежная Королева побеждена'+(win?' за '+Math.round((Date.now()-t0)/1000)+' с':''));
  for(const P of T.P)T.ok(await P.waitFor(`sb.phase==='win'`,8000),P.name+': видит победу');
  for(const P of T.P){const fs=await P.waitFor(`!document.getElementById('prolog').hidden||!document.getElementById('epibox').hidden||!document.getElementById('netui').hidden`,20000);T.ok(fs,P.name+': финальная сцена/эпилог показаны')}
  return 'end'}
};
module.exports={LEVELS,goTo,ORDER:['living','work','clock','stable','kitchen','obs','flight','boss']};
