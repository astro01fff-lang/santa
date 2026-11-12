// Отчёт в Markdown по результатам прогона.
exports.md=function(r,LV){const L=[];const fails=r.checks.filter(c=>!c.ok);
L.push(`# Отчёт QA — ${r.chaos?'режим хаоса':'основной прогон'}`,'',`Сид: **${r.seed}** (повтор: \`node tests/qa.js --seed ${r.seed}${r.chaos?' --chaos':''}\`). Длительность: ${r.durationMin} мин.`,'');
L.push('## Команды','','| Команда | Игроки (профиль) | Время до финала | Проверок | Провалено | Ошибок JS |','|---|---|---|---|---|---|');
r.teams.forEach(t=>L.push(`| ${t.name} | ${t.players.map(p=>p.name+' ('+p.profile+')').join(', ')} | ${t.minutes?t.minutes+' мин':'не дошла'} | ${t.checks} | ${t.failed} | ${t.players.reduce((a,p)=>a+p.jsErrors,0)} |`));
L.push('','## Уровни','','| Команда | '+Object.keys(LV).map(k=>LV[k]).join(' | ')+' |','|---|'+Object.keys(LV).map(()=>'---').join('|')+'|');
r.teams.forEach(t=>L.push(`| ${t.name} | `+Object.keys(LV).map(k=>{const v=t.levels[k];return v?(v.ok?'✅':'⚠️')+' '+v.sec+' с':'—'}).join(' | ')+' |'));
L.push('','Экран «Результаты» у ведущей в конце прогона:','','```',(r.hostFin||'нет данных').trim().slice(0,1500),'```','');
L.push('## Найденные проблемы',''); if(!r.bugs.length)L.push('Не найдено.');
r.bugs.forEach(b=>{L.push(`### #${b.id} [${b.sev}] ${b.title}`,'',`- Команда: ${b.team}; этап: ${b.level}${b.room?'; комната: '+b.room:''}; сид: ${b.seed}`);
  (b.players||[]).forEach(p=>{L.push(`- **${p.name}** (${p.profile}), сейчас в «${p.room}»${p.shot?`, скриншот: \`${p.shot}\``:''}`);if(p.actions.length)L.push('  - последние действия: '+p.actions.join(' → '));if(p.js.length)L.push('  - ошибки консоли: '+p.js.join(' | '));if(p.net.length)L.push('  - ошибки сети: '+p.net.join(' | '))});L.push('')});
L.push('## Все проваленные проверки','');fails.forEach(c=>L.push(`- ${c.team} · ${LV[c.level]||c.level}: ${c.msg}`));if(!fails.length)L.push('Нет.');
return L.join('\n')};
