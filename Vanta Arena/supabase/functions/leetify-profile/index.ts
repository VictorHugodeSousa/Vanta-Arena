import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store, private",
  "Pragma": "no-cache",
};

function reply(body: Record<string, unknown>, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...cors, ...headers } });
}

function defaultProjectKey(mapName: string, legacyName: string): string | undefined {
  const raw = Deno.env.get(mapName);
  if (raw) {
    try {
      const value = JSON.parse(raw)?.default;
      if (typeof value === "string" && value.trim()) return value;
    } catch { }
  }
  return Deno.env.get(legacyName) || undefined;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return reply({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = defaultProjectKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const serviceKey = defaultProjectKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  const leetifyKey = Deno.env.get("LEETIFY_API_KEY");
  const testPlayerId = Deno.env.get("LEETIFY_TEST_PLAYER_ID");
  if (!url || !publicKey || !serviceKey || !leetifyKey || !testPlayerId) {
    return reply({ error: "Configuração da função incompleta. Confira os secrets do Supabase." }, 500);
  }

  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i);
  if (!match) return reply({ error: "Autenticação necessária." }, 401);
  const token = match[1];
  const client = createClient(url, publicKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) return reply({ error: "Sessão inválida ou expirada." }, 401);
    const { data: role, error: roleError } = await client.from("cms_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (roleError) return reply({ error: "Não foi possível verificar a permissão." }, 503);
    if (!role || !["owner", "editor"].includes(role.role)) return reply({ error: "Acesso restrito a editores." }, 403);

    const { data: state, error: stateError } = await client.from("site_state").select("data").eq("id", 1).maybeSingle();
    if (stateError) return reply({ error: "Não foi possível carregar o cadastro de jogadores." }, 503);
    const players = state?.data?.players;
    const player = Array.isArray(players) ? players.find((item: { id?: unknown }) => item?.id === testPlayerId) : null;
    if (!player) return reply({ error: "Jogador de teste não encontrado no cadastro." }, 404);
    if (typeof player.steamId64 !== "string" || !/^\d{17}$/.test(player.steamId64)) {
      return reply({ error: "O jogador de teste precisa ter um SteamID64 válido cadastrado." }, 422);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: claimed, error: limitError } = await admin.rpc("claim_leetify_test_request");
    if (limitError) return reply({ error: "Limitador indisponível. Verifique a migração SQL antes de testar." }, 503);
    if (claimed !== true) return reply({ error: "Aguarde antes de consultar novamente. Limite: uma consulta por minuto." }, 429, { "Retry-After": "60" });

    const endpoint = new URL("https://api-public.cs-prod.leetify.com/v3/profile");
    endpoint.searchParams.set("steam64_id", player.steamId64);
    let upstream: Response;
    try {
      upstream = await fetch(endpoint, { headers: { "_leetify_key": leetifyKey, "Accept": "application/json" }, signal: AbortSignal.timeout(10000) });
    } catch {
      return reply({ error: "A Leetify não respondeu. Tente novamente mais tarde." }, 502);
    }
    if (upstream.status === 404 || upstream.status === 204) return reply({ available: false, message: "Perfil ou dados não disponíveis na Leetify." }, 200);
    if (upstream.status === 429) return reply({ error: "A Leetify limitou as consultas. Aguarde antes de tentar novamente." }, 429);
    if (upstream.status === 401 || upstream.status === 403) return reply({ error: "A Leetify recusou a consulta: verifique a chave e a disponibilidade do perfil." }, 502);
    if (!upstream.ok) return reply({ error: "A consulta à Leetify falhou.", upstreamStatus: upstream.status }, 502);
    let profile: unknown;
    try { profile = await upstream.json(); } catch { return reply({ error: "Resposta inválida da Leetify." }, 502); }
    if (!profile || typeof profile !== "object" || Array.isArray(profile) || Object.keys(profile).length === 0) {
      return reply({ available: false, message: "Perfil ou dados não disponíveis na Leetify." }, 200);
    }
    return reply({ available: true, source: "Leetify", profile }, 200);
  } catch {
    return reply({ error: "Não foi possível concluir a consulta." }, 500);
  }
});
