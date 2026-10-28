const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app.js', 'utf8');
const start = source.indexOf('const PLAYER_IMPORT_FIELDS=');
const end = source.indexOf('async function importJSON(', start);
assert.ok(start >= 0 && end > start);
const original = { eventName: 'Teste', players: [{ id: 'real-1', nick: 'ORIGINAL', name: 'Nome antigo', steamId64: '76561198000000001', tier: 'B', role: 'AWPer', image: 'https://example.test/photo.png', externalStats: { csrep: { kd: 1.1 } }, matches: [{ id: 'hist' }], custom: 'preservado' }], draft: { teams: [{ id: 'time' }], log: [] }, competition: { matches: [{ id: 'partida', playerStats: [{ playerId: 'real-1', kills: 20 }] }] } };
let remote = structuredClone(original), version = 'v1', simulateConflict = false, saved = 0;
const notices = [];
const client = { from(table) { assert.equal(table, 'site_state'); return {
  select() { return { eq() { return { async maybeSingle() { return { data: { data: structuredClone(remote), updated_at: version }, error: null }; } }; } }; },
  update(body) { return { eq() { return { eq(_field, expected) { return { select() { return { async maybeSingle() { if (simulateConflict || expected !== version) return { data: null, error: null }; remote = structuredClone(body.data); saved++; version = 'v2'; return { data: { updated_at: version }, error: null }; } }; } }; } }; } }; },
}; } };
const ctx = { ROLES: ['AWPer','Rifler'], safeSrc: s => /^https:\/\//.test(s) ? s : '', uid: () => 'new-generated', clone: x => structuredClone(x), db: structuredClone(original), cloudConfigured: true, cloud: client, canEdit: () => true, ui: { modal: { type: 'admin' }, adminTab: 'data' }, renderModal() {}, render() {}, toast(message) { notices.push(message); }, normalizeCompetition: x => x, localStorage: {}, download() {}, esc: String };
vm.createContext(ctx);
vm.runInContext(source.slice(start,end), ctx);
const file = rows => ({ size: 100, async text() { return JSON.stringify({ players: rows }); } });
const rows = [
  { steamId64: '76561198000000001', tier: 'A', bio: 'Avaliação', matches: [{ kills: 999 }], externalStats: { leetify: { kd: 99 } } },
  { nick: 'NOVO', steamId64: '76561198000000002', tier: 'S', role: 'Rifler' },
  { nick: 'REPETIDO', steamId64: '76561198000000003' },
  { nick: 'REPETIDO', steamId64: '76561198000000003' },
  { nick: 'ORIGINAL', steamId64: '76561198000000004' },
];
(async () => {
  assert.throws(() => ctx.parsePlayerImport({ players: [{ nick: 'x', steamId64: '123' }] }), /SteamID64/);
  await ctx.preparePlayerImport(file(rows));
  assert.equal(vm.runInContext('playerImport.preview.map(x=>x.status).join(",")', ctx), 'existing,new,duplicate,duplicate,conflict');
  assert.deepEqual(remote, original);
  vm.runInContext("playerImport.mode='update'", ctx);
  await ctx.confirmPlayerImport();
  assert.equal(saved, 1); assert.equal(remote.players.length, 2);
  assert.equal(remote.players[0].tier, 'A'); assert.equal(remote.players[0].bio, 'Avaliação');
  for (const field of ['id','nick','name','image','externalStats','matches','custom']) assert.deepEqual(remote.players[0][field], original.players[0][field]);
  assert.deepEqual(remote.draft, original.draft); assert.deepEqual(remote.competition, original.competition);
  assert.match(notices.at(-1), /1 novo\(s\), 1 atualizado\(s\), 3 ignorado\(s\)/);
  await ctx.preparePlayerImport(file([{ id:'real-1', tier:'D' }]));
  vm.runInContext("playerImport.mode='update'", ctx); simulateConflict=true;
  await ctx.confirmPlayerImport();
  assert.equal(saved, 1); assert.equal(remote.players[0].tier, 'A'); assert.match(notices.at(-1), /mudou desde a prévia/);
  simulateConflict=false;
  await ctx.preparePlayerImport(file([{ id:'real-1', tier:'D' }]));
  await ctx.confirmPlayerImport();
  assert.equal(saved, 1); assert.equal(remote.players[0].tier, 'A');
  console.log('Importação: validação, duplicados, atualização parcial, preservação e conflito de versão: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
