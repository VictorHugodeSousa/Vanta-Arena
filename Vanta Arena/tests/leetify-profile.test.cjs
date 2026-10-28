const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const code = stripTypeScriptTypes(fs.readFileSync('supabase/functions/leetify-profile/index.ts', 'utf8')).replace(/^import[^\n]+\n/, '');
const jwt = 'header.payload.signature';
const env = { SUPABASE_URL: 'https://example.test', SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'sb_publishable_test' }), SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_test' }), LEETIFY_API_KEY: 'private-test-key', LEETIFY_TEST_PLAYER_ID: 'player-1' };
let handler, test, sent;
function createClient(_url, key, options) {
  if (key === 'sb_secret_test' || key === 'legacy-service') return { async rpc(name) { assert.equal(name, 'claim_leetify_test_request'); test.rpc++; return { data: test.claimed, error: test.rpcError }; } };
  assert.ok(key === 'sb_publishable_test' || key === 'legacy-anon');
  assert.equal(options.global.headers.Authorization, `Bearer ${jwt}`);
  return {
    auth: { async getUser(token) { test.token = token; return { data: { user: test.authenticated ? { id: 'user-1' } : null }, error: test.authenticated ? null : {} }; } },
    from(table) { return { select() { return { eq(_column, value) { return { async maybeSingle() { if (table === 'cms_roles') { assert.equal(value, 'user-1'); return { data: test.role ? { role: test.role } : null, error: null }; } return { data: { data: { players: [{ id: 'player-1', steamId64: '76561199020825867' }] } }, error: null }; } }; } }; } }; },
  };
}
const context = { createClient, Deno: { env: { get(name) { return env[name]; } }, serve(fn) { handler = fn; } }, Response, Request, URL, AbortSignal, fetch: async (url, options) => { sent = { url: String(url), options }; return Response.json({ steam64_id: '76561199020825867' }); } };
vm.runInNewContext(code, context);
const request = token => new Request('https://example.test', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
function reset() { test = { authenticated: true, role: 'owner', claimed: true, rpcError: null, rpc: 0, token: null }; sent = null; }

(async () => {
  reset(); let result = await handler(request(jwt));
  assert.equal(result.status, 200); assert.equal(test.token, jwt); assert.equal(test.rpc, 1);
  assert.equal(sent.url, 'https://api-public.cs-prod.leetify.com/v3/profile?steam64_id=76561199020825867');
  assert.equal(sent.options.headers._leetify_key, 'private-test-key');
  assert.equal(result.headers.get('cache-control'), 'no-store, private');
  reset(); test.role = 'editor'; assert.equal((await handler(request(jwt))).status, 200);
  reset(); test.role = null; assert.equal((await handler(request(jwt))).status, 403); assert.equal(test.rpc, 0); assert.equal(sent, null);
  reset(); test.authenticated = false; assert.equal((await handler(request(jwt))).status, 401); assert.equal(test.rpc, 0);
  reset(); assert.equal((await handler(request('sb_publishable_test'))).status, 401); assert.equal(test.rpc, 0);
  reset(); test.claimed = false; assert.equal((await handler(request(jwt))).status, 429); assert.equal(sent, null);
  reset(); test.rpcError = {}; assert.equal((await handler(request(jwt))).status, 503); assert.equal(sent, null);
  delete env.SUPABASE_PUBLISHABLE_KEYS; delete env.SUPABASE_SECRET_KEYS;
  env.SUPABASE_ANON_KEY = 'legacy-anon'; env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service';
  reset(); assert.equal((await handler(request(jwt))).status, 200);
  console.log('Autenticação, papéis, limite, chaves e chamada Leetify: OK (simulados)');
})().catch(error => { console.error(error); process.exitCode = 1; });
