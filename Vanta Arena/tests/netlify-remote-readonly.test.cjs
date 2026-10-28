const fs = require('node:fs');
const vm = require('node:vm');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync('publicar/config.js','utf8'),context);
const config=context.window.VANTA_CONFIG;
const headers={apikey:config.supabasePublishableKey,Origin:'https://example.netlify.app'};
const request=async path=>fetch(config.supabaseUrl+path,{headers,signal:AbortSignal.timeout(12000)});
(async()=>{
 const [state,roles,drafts,news]=await Promise.all([
  request('/rest/v1/site_state?select=data&id=eq.1'),
  request('/rest/v1/cms_roles?select=user_id&limit=1'),
  request('/rest/v1/news_posts?select=id&status=eq.draft&limit=1'),
  request('/rest/v1/news_posts?select=image_url&status=eq.published'),
 ]);
 console.log('Leitura pública de site_state:',state.status,'CORS:',state.headers.get('access-control-allow-origin')||'ausente');
 if(state.ok){
  const rows=await state.json();const players=rows[0]?.data?.players||[];const images={data:0,https:0,http:0,relative:0,missingRelative:0,none:0,other:0};
  for(const p of players){const s=typeof p.image==='string'?p.image:'';if(!s)images.none++;else if(s.startsWith('data:'))images.data++;else if(s.startsWith('https://'))images.https++;else if(s.startsWith('http://'))images.http++;else if(s.startsWith('./')||s.startsWith('assets/')){images.relative++;if(!fs.existsSync('publicar/'+s))images.missingRelative++;}else images.other++;}
  console.log('Imagens dos jogadores (somente contagem):',JSON.stringify(images));
 }
 if(news.ok){const rows=await news.json();const images={https:0,http:0,relative:0,missingRelative:0,none:0,other:0};for(const p of rows){const s=typeof p.image_url==='string'?p.image_url:'';if(!s)images.none++;else if(s.startsWith('https://'))images.https++;else if(s.startsWith('http://'))images.http++;else if(s.startsWith('./')||s.startsWith('assets/')){images.relative++;if(!fs.existsSync('publicar/'+s))images.missingRelative++;}else images.other++;}console.log('Imagens das notícias publicadas (somente contagem):',JSON.stringify(images));const imageUrls=rows.map(p=>p.image_url).filter(x=>typeof x==='string'&&x.startsWith('https://'));for(const imageUrl of imageUrls){try{const image=await fetch(imageUrl,{method:'HEAD',signal:AbortSignal.timeout(12000)});console.log('Imagem HTTPS de notícia: HTTP',image.status);}catch{console.log('Imagem HTTPS de notícia: indisponível para verificação');}}}else console.log('Leitura de notícias públicas: HTTP',news.status);
 for(const [name,response] of [['cms_roles',roles],['rascunhos',drafts]]){
  let count='não acessível';if(response.ok){const body=await response.json();count=Array.isArray(body)?body.length:'resposta inesperada';}
  console.log('Leitura anônima',name,': HTTP',response.status,'linhas:',count);
 }
 const lib=await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',{method:'HEAD',signal:AbortSignal.timeout(12000)});
 console.log('Biblioteca Supabase no CDN: HTTP',lib.status);
})().catch(e=>{console.error('Não foi possível verificar os serviços HTTPS:',e.cause?.code||e.message);process.exitCode=1;});
