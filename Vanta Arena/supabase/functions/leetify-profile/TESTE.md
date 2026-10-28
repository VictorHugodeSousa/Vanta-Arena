# Teste inicial da Leetify

Esta função é uma prova de conexão privada. Ela não altera o site, não grava a resposta da Leetify e só consulta o jogador indicado no secret `LEETIFY_TEST_PLAYER_ID`. O usuário deve estar autenticado como `owner` ou `editor` em `cms_roles`. Há um limite global de uma tentativa a cada 60 segundos, inclusive quando a Leetify retorna erro.

## 1. Escolha um jogador

No painel da VANTA ARENA, cadastre o SteamID64 de 17 dígitos de um jogador e salve. No SQL Editor do Supabase, execute esta consulta somente de leitura para descobrir o `id` do cadastro:

```sql
select p->>'id' as id, p->>'nick' as nick, p->>'steamId64' as steam_id64
from public.site_state s
cross join lateral jsonb_array_elements(s.data->'players') p
where s.id = 1;
```

Escolha um jogador que possua uma conta registrada e disponível na Leetify. Copie o `id` interno da VANTA ARENA, não o SteamID64.

## 2. Configure o jogador de teste

Em Edge Functions → Secrets, crie `LEETIFY_TEST_PLAYER_ID` com o `id` copiado. Confira que `LEETIFY_API_KEY` já está configurada. Não coloque nenhuma dessas chaves no frontend. O Supabase fornece `SUPABASE_URL` e os dicionários `SUPABASE_PUBLISHABLE_KEYS` e `SUPABASE_SECRET_KEYS`, com chaves `default`. A função também aceita as variáveis legadas `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` caso os dicionários não estejam disponíveis. A chave secreta do Supabase é usada somente no servidor.

## 3. Ative o limite de consultas

No SQL Editor, abra o conteúdo de `supabase/migrations/202610280002_leetify_test_rate_limit.sql`, revise-o e execute-o uma vez. Ele cria uma tabela e uma função para controlar o intervalo entre consultas; não guarda dados retornados pela Leetify. A função falha de forma segura se o limitador não estiver disponível. Não execute as outras migrações por este procedimento.

## 4. Publique somente a função de teste

Em Edge Functions, escolha **Deploy a new function → Via Editor**, nomeie a função `leetify-profile`, cole o conteúdo de `supabase/functions/leetify-profile/index.ts` e selecione **Deploy function**. Mantenha a verificação de JWT ativada. A publicação é feita por você; nenhum deploy foi executado automaticamente.

Para testar, use uma sessão real de usuário autenticado, não a chave pública no lugar do JWT. O cliente envia o token de sessão no cabeçalho `Authorization` e a chave pública em `apikey`. A função valida o token no Supabase Auth e verifica o papel do usuário na tabela `cms_roles`. O JWT deve ser compatível com a verificação configurada no projeto; se a plataforma rejeitar uma sessão válida antes de a função ser executada, confira os detalhes do erro e a configuração de assinatura do projeto no Supabase.

## 5. Faça uma única consulta

Abra a VANTA ARENA no navegador, entre como administrador com papel `owner` ou `editor` e abra o Console das ferramentas de desenvolvimento. Cole e execute:

```js
(async () => {
  const { data, error } = await cloud.functions.invoke('leetify-profile', { body: {} });
  if (error) {
    const details = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    console.log('Falha:', details || error.message);
    return;
  }
  console.log('Resposta Leetify (temporária):', data);
})();
```

Uma resposta com `available: true` contém o perfil retornado pela API. `available: false` indica ausência de perfil ou dados disponíveis. A resposta é entregue apenas à sessão que fez a consulta, sem atualização dos cards ou da Tabela MVP. Evite salvar, exportar ou compartilhar a resposta; limpe o console depois do teste. Para repetir, aguarde pelo menos 60 segundos.

Se receber `401`, entre novamente no site; `403` indica ausência de papel de editor; `422` indica SteamID64 ausente ou inválido; `429` indica limite; `503` pode indicar que o SQL ainda não foi aplicado. Erros da Leetify são devolvidos sem expor a chave. Consulte os logs do Supabase apenas para diagnóstico técnico, sem registrar os dados do perfil.

Antes de exibir esses dados no site, implemente a atribuição e os links exigidos pelas [diretrizes da Leetify](https://leetify.com/blog/leetify-api-developer-guidelines/); os valores devem ser apresentados como fornecidos pela API, sem armazená-los ou recalculá-los.
