const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve('publicar');
const expected = ['app.js', 'config.js', 'index.html', 'styles.css'];
assert.deepEqual(fs.readdirSync(root).sort(), expected);
for (const name of expected) assert.deepEqual(fs.readFileSync(path.join(root,name)), fs.readFileSync(name));
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const css = fs.readFileSync(path.join(root,'styles.css'),'utf8');
const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(x=>x[1]);
refs.push(...[...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(x=>x[1]));
const locals = refs.filter(x=>! /^(?:https?:|data:|#|\/\/)/i.test(x));
for (const ref of locals) assert.ok(fs.existsSync(path.join(root,ref.split(/[?#]/)[0])),`Arquivo ausente: ${ref}`);
const context = {window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'config.js'),'utf8'),context);
const cfg = context.window.VANTA_CONFIG;
assert.match(cfg.supabaseUrl,/^https:\/\//);assert.match(cfg.supabasePublishableKey,/^sb_publishable_/);
for(const name of expected){const content=fs.readFileSync(path.join(root,name),'utf8');assert.doesNotMatch(content,/sb_secret_[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);}
const server=http.createServer((req,res)=>{
 const file=req.url==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
 if(!expected.includes(file)){res.writeHead(404);return res.end();}
 const ext=path.extname(file),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
 res.writeHead(200,{'Content-Type':mime[ext]});fs.createReadStream(path.join(root,file)).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const name of ['/',...expected.map(x=>'/'+x)]){const result=await fetch(base+name);assert.equal(result.status,200,name);assert.ok((await result.text()).length>0,name);}
  assert.equal((await fetch(base+'/database.sql')).status,404);
  console.log('Pacote e servidor HTTP estático: OK; referências locais e cópias verificadas.');
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
