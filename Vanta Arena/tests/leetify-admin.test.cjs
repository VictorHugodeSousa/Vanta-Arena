const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app.js', 'utf8');
const start = source.indexOf('let leetifyTestBusy=');
const end = source.indexOf('const byId=', start);
assert.ok(start >= 0 && end > start);
let calls = 0;
let response;
const ctx = {
  cloud: { functions: { async invoke(name, options) { calls++; assert.equal(name, 'leetify-profile'); assert.deepEqual(Object.keys(options.body), []); if (response instanceof Error) throw response; return response; } } },
  canEdit: () => true,
  ui: { modal: { type: 'admin' }, adminTab: 'external' },
  renderModal() {},
};
vm.createContext(ctx);
vm.runInContext(source.slice(start, end), ctx);
async function run(value, expected) {
  response = value;
  await ctx.testLeetify();
  assert.match(vm.runInContext('leetifyTestResult', ctx), expected);
}
(async () => {
  await run({ data: { available: true, profile: { private: 'do not show' } }, error: null }, /Conexão realizada\. Perfil encontrado/);
  assert.doesNotMatch(vm.runInContext('leetifyTestResult', ctx), /do not show/);
  await run({ data: { available: false }, error: null }, /Perfil indisponível/);
  await run({ data: null, error: { context: { status: 401 } } }, /autenticação/);
  await run({ data: null, error: { context: { status: 403 } } }, /permissão/);
  await run({ data: null, error: { context: { status: 429 } } }, /Limite de requisições/);
  await run({ data: null, error: { context: { status: 404 } } }, /Função ou jogador/);
  await run({ data: null, error: { context: { status: 502 } } }, /Falha de comunicação/);
  await run(new Error('offline'), /Falha de comunicação/);
  ctx.canEdit = () => false;
  const previous = calls;
  await ctx.testLeetify();
  assert.equal(calls, previous);
  assert.match(vm.runInContext('leetifyTestResult', ctx), /Erro de autenticação/);
  console.log('Teste administrativo: estados de conexão, permissão, limite e falha validados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
