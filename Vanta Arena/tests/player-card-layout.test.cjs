const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8'),css=fs.readFileSync('styles.css','utf8');
const helpers=source.slice(source.indexOf('const SCOUT_PRESENTATION='),source.indexOf('const TIER_ORDER='));
const selector=source.slice(source.indexOf('function scoutingKey('),source.indexOf('function rosterFiltered('));
const line=name=>source.split(/\r?\n/).find(x=>x.startsWith('function '+name+'('));
const ctx={db:{players:[]},ui:{scoutingKey:''},selectedTeam:()=>null,hash:()=>0,esc:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),portrait:p=>`<img class="player-art" src="${p.image?'foto':'avatar'}">`,ico:()=>'<svg></svg>'};
vm.createContext(ctx);vm.runInContext(helpers+'\n'+selector+'\n'+line('shortScoutingSource')+'\n'+line('renderPlayerCard'),ctx);
function player(nick,metrics,extra={}){const p={id:nick,nick,name:'Nome',flag:'',role:'AWPer',rank:1,...extra};p.scoutingAnalyses=metrics?[{origin:'manual',source:extra.source||'CSRep / GC',period:'Período muito extenso que não deve aparecer no card',mode:'Premier',analyzedAt:'2026-10-28',metrics}]:[];return p;}
const empty=player('EMPTY',null),partial=player('PARTIAL',{kd:0}),chico=player('Chico',{kd:.4,adr:39.8,winrate:30,games:84,extras:{kdAdrSampleGames:81,winrateSampleGames:84}},{image:'foto'}),long=player('NICKNAME-MUITO-COMPRIDO-ABCDEFGHIJ',{kd:1.5},{source:'Uma fonte excepcionalmente longa que não deve inundar o card'});
ctx.db.players=[empty,partial,chico,long];ctx.ui.scoutingKey=JSON.stringify(['CSRep / GC','Período muito extenso que não deve aparecer no card','Premier']);
const a=ctx.renderPlayerCard(empty);assert.equal((a.match(/>—<\/strong>/g)||[]).length,4);assert.doesNotMatch(a,/SEM DADOS/);assert.match(a,/src="avatar"/);
const b=ctx.renderPlayerCard(partial);assert.match(b,/>0,00<\/strong>/);assert.equal((b.match(/>—<\/strong>/g)||[]).length,3);
const c=ctx.renderPlayerCard(chico);for(const text of ['0,40','39,8','30%','84','scout-low','scout-neutral','Scouting · CSRep / GC','src="foto"'])assert.ok(c.includes(text),text);
for(const text of ['Período muito extenso','2026-10-28','81 partidas','84 partidas','kdAdrSampleGames'])assert.ok(!c.includes(text),text);
ctx.ui.scoutingKey=JSON.stringify([long.scoutingAnalyses[0].source,long.scoutingAnalyses[0].period,'Premier']);const d=ctx.renderPlayerCard(long);assert.ok(d.includes(long.nick));assert.ok(!d.includes(long.scoutingAnalyses[0].source));
assert.match(css,/container-type:inline-size/);assert.match(css,/@container \(max-width:245px\)/);assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(css,/text-overflow:ellipsis/);
console.log('Cards: vazio, parcial, zero, métricas, nome longo, fotos e regras responsivas: OK');
