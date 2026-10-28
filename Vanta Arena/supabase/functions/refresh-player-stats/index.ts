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

  const leetifyKey = Deno.env.get("LEETIFY_API_KEY");
  const csrepKey = Deno.env.get("CSREP_API_KEY");
  return Response.json({
    playerId,
    steamId64,
    leetify: null,
    csrep: null,
    message: `Integração aguardando configuração/documentação aprovada (${leetifyKey ? "Leetify configurada" : "sem chave Leetify"}; ${csrepKey ? "CSRep configurada" : "sem chave CSRep"}). Nenhum dado foi inventado ou persistido.`,
  }, { headers: cors });
});
