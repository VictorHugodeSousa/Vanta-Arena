const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const helpers=source.slice(source.indexOf('const SCOUT_PRESENTATION='),source.indexOf('const TIER_ORDER='));
const profile=source.split(/\r?\n/).find(x=>x.startsWith('function renderManualScouting('));
const samples=source.split(/\r?\n/).find(x=>x.startsWith('function scoutingCardSamples('));
const ctx={esc:x=>String(x)};vm.createContext(ctx);vm.runInContext(helpers+'\n'+samples+'\n'+profile,ctx);
for(const [key,low,high] of [['kd',.8,1.1],['adr',60,80],['winrate',45,55],['kast',60,70],['hltvRating2Last81Games',.8,1.1]]){
 assert.equal(ctx.scoutingClass(key,low-.01),'scout-low');assert.equal(ctx.scoutingClass(key,low),'scout-neutral');assert.equal(ctx.scoutingClass(key,high),'scout-neutral');assert.equal(ctx.scoutingClass(key,high+.01),'scout-high');
}
for(const [value,color] of [[0,'gray'],[4999,'gray'],[5000,'lightblue'],[9999,'lightblue'],[10000,'blue'],[14999,'blue'],[15000,'purple'],[19999,'purple'],[20000,'pink'],[24999,'pink'],[25000,'red'],[29999,'red'],[30000,'gold']])assert.equal(ctx.scoutingClass('premier',value),'premier-'+color);
for(const key of ['games','winsInWinrateSample','faceitElo','gcPoints','hs','premierSeason5Games'])assert.equal(ctx.scoutingClass(key,0),'scout-neutral');
assert.equal(ctx.scoutingClass('kd',null),'scout-neutral');assert.equal(ctx.scoutingFormat('kd',null),'SEM DADOS');assert.equal(ctx.scoutingFormat('kd','  '),'SEM DADOS');
for(const [key,value,expected] of [['games',81,'81'],['winsInWinrateSample',25,'25'],['premier',1553,'1.553'],['faceitElo',1000,'1.000'],['gcPoints',1122,'1.122'],['kd',.4,'0,40'],['adr',39.8,'39,8'],['winrate',30,'30%'],['kast',51.1,'51,1%'],['hltvRating2Last81Games',.42,'0,42']])assert.equal(ctx.scoutingFormat(key,value),expected);
assert.equal(ctx.scoutingLabel('kdAdrSampleGames'),'Partidas analisadas (K/D e ADR)');assert.equal(ctx.scoutingLabel('faceitElo'),'Elo FACEIT');assert.equal(ctx.scoutingLabel('outraMedidaEspecial'),'Outra Medida Especial');
const metrics={kd:.4,adr:39.8,winrate:30,kast:51.1,premier:1553,extras:{kdAdrSampleGames:81,winrateSampleGames:84,winsInWinrateSample:25,hltvRating2Last81Games:.42,premierSeason5Peak:1553,faceitElo:1000,gcPoints:1122,outraMedidaEspecial:7}};
const player={scoutingAnalyses:[{origin:'manual',source:'Org',period:'Geral',mode:'Premier',metrics}]};const before=JSON.stringify(player),html=ctx.renderManualScouting(player),card=ctx.scoutingCardSamples(metrics);
for(const s of ['DESEMPENHO','RANKINGS','INFORMAÇÕES ADICIONAIS','Partidas analisadas (K/D e ADR)','Partidas analisadas (Win Rate)','HLTV Rating 2.0','Elo FACEIT','Pontos Gamers Club','Outra Medida Especial','81 partidas analisadas','84 partidas analisadas','scout-low','premier-gray'])assert.ok(html.includes(s),s);
assert.ok(card.includes('K/D e ADR: 81 partidas'));assert.ok(card.includes('Win Rate: 84 partidas'));assert.equal(JSON.stringify(player),before);
console.log('Apresentação: rótulos, cores, limites, formatos e amostras: OK');
