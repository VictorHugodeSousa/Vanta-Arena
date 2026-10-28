const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app.js', 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

function boot(hash, request) {
  const elements = new Map();
  const handlers = {};
  function element(selector) {
    if (selector === '[data-home-carousel]') return null;
    if (!elements.has(selector)) elements.set(selector, { innerHTML: '', textContent: '', classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, querySelectorAll() { return []; }, setAttribute() {} });
    return elements.get(selector);
  }
  const client = {
    auth: { async getUser() { return { data: { user: null } }; }, onAuthStateChange() {} },
    from(table) {
      if (table === 'site_state') return { select() { return { eq() { return { maybeSingle() { return request(); } }; } }; } };
      if (table === 'news_posts') return { select() { return { async order() { return { data: [], error: null }; } }; } };
      throw Error('Unexpected table: ' + table);
    },
  };
  const document = { querySelector: element, querySelectorAll() { return []; }, addEventListener(name, fn) { (handlers[name] ||= []).push(fn); }, visibilityState: 'visible' };
  const location = { hash, pathname: '/', search: '', reload() {} };
  const window = { VANTA_CONFIG: { supabaseUrl: 'https://example.test', supabasePublishableKey: 'public' }, supabase: { createClient() { return client; } }, sessionStorage: {}, addEventListener() {}, scrollTo() {} };
  const storage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const context = { window, document, location, history: { replaceState() {} }, localStorage: { getItem() { throw Error('Cloud must not read local state'); } }, sessionStorage: storage, console, URL, setInterval() { return 1; }, clearInterval() {}, setTimeout() {}, clearTimeout() {} };
  window.sessionStorage = storage;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, element, handlers };
}

const state = players => ({ data: { data: { players, draft: { teams: [], log: [], status: 'setup', maxPlayers: 5 }, competition: { matches: [] }, eventName: 'CAVERNA GAMER CUP' } }, error: null });

(async () => {
  const pending = deferred();
  const app = boot('#inicio', () => pending.promise);
  await tick();
  assert.match(app.element('#mainContent').innerHTML, /CARREGANDO/);
  assert.doesNotMatch(app.element('#mainContent').innerHTML, /ATLAS|FROST|FLUX|KRYPT/);
  pending.resolve(state([{ id: 'real', nick: 'Chico', name: 'Chico', role: 'AWPer', rank: 1, externalStats: {} }]));
  await tick(); await tick();
  assert.match(app.element('#mainContent').innerHTML, /Chico/);
  assert.doesNotMatch(app.element('#mainContent').innerHTML, /ATLAS|FROST|FLUX|KRYPT/);
  vm.runInContext("ui.route='profile';ui.playerId='real';render()", app.context);
  assert.match(app.element('#mainContent').innerHTML, /Chico/);
  vm.runInContext("route('players')", app.context);
  assert.match(app.element('#mainContent').innerHTML, /Chico/);

  const direct = deferred();
  const profile = boot('#jogador/real', () => direct.promise);
  await tick();
  assert.match(profile.element('#mainContent').innerHTML, /CARREGANDO/);
  direct.resolve(state([{ id: 'real', nick: 'Chico', name: 'Chico', role: 'AWPer', rank: 1, externalStats: {} }]));
  await tick(); await tick();
  assert.match(profile.element('#mainContent').innerHTML, /PERFIL DO JOGADOR/);

  const empty = boot('#inicio', async () => state([]));
  await tick(); await tick();
  assert.match(empty.element('#mainContent').innerHTML, /Nenhum jogador cadastrado/);

  const missing = boot('#inicio', async () => ({ data: null, error: null }));
  await tick(); await tick();
  assert.match(missing.element('#mainContent').innerHTML, /Nenhum jogador cadastrado/);

  let attempts = 0;
  const failed = boot('#inicio', async () => ++attempts === 1 ? { data: null, error: { message: 'offline' } } : state([]));
  await tick(); await tick();
  assert.match(failed.element('#mainContent').innerHTML, /TENTAR NOVAMENTE/);
  const retry = { matches() { return false; }, closest(selector) { return selector === '[data-action="retry-cloud"]' ? {} : null; } };
  for (const fn of failed.handlers.click) fn({ target: retry });
  await tick(); await tick();
  assert.match(failed.element('#mainContent').innerHTML, /Nenhum jogador cadastrado/);
  console.log('Carregamento remoto, espera, perfil direto, navegação, vazio e nova tentativa: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
