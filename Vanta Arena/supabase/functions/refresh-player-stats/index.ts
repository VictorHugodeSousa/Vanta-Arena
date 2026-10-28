// Adapter entrypoint for provider integrations. No provider secret belongs in the browser.
// Configure secrets with Supabase after reviewing the provider terms and approved schemas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return Response.json({ error: "Supabase is not configured" }, { status: 500, headers: cors });

  const supabase = createClient(url, anon, { global: { headers: { Authorization: request.headers.get("Authorization") || "" } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401, headers: cors });
  const { data: role } = await supabase.from("cms_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!role || !["owner", "editor"].includes(role.role)) return Response.json({ error: "Editor access required" }, { status: 403, headers: cors });

  const { playerId, steamId64 } = await request.json();
  if (typeof playerId !== "string" || typeof steamId64 !== "string" || !/^\d{17}$/.test(steamId64)) {
    return Response.json({ error: "A player ID and valid SteamID64 are required" }, { status: 400, headers: cors });
  }

  // Leetify: official public API documents GET /v3/profile and /v3/profile/matches.
  // Do not persist Leetify responses: its developer guidelines explicitly prohibit storage.
  // CSRep API: request/approval and X-API-Key required. Its current public reference must
  // define the player lookup path and schema before enabling requests or persistence here.
  // This endpoint intentionally avoids guessed URLs, response fields, or synthetic stats.
  const leetifyKey = Deno.env.get("LEETIFY_API_KEY");
  const csrepKey = Deno.env.get("CSREP_API_KEY");
  // A conservative cache window prevents repeated calls after provider integration is enabled.
  const { data: cached } = await supabase.from("external_player_stats").select("updated_at")
    .eq("player_id", playerId).eq("source", "csrep").maybeSingle();
  const fresh = cached?.updated_at && Date.now() - new Date(cached.updated_at).getTime() < 6 * 60 * 60 * 1000;
  return Response.json({
    playerId,
    steamId64,
    leetify: null,
    csrep: null,
    message: fresh ? "Os dados CSRep em cache ainda estão atualizados." : `Integração aguardando configuração/documentação aprovada (${leetifyKey ? "Leetify configurada" : "sem chave Leetify"}; ${csrepKey ? "CSRep configurada" : "sem chave CSRep"}). Nenhum dado foi inventado ou persistido.`,
  }, { headers: cors });
});
