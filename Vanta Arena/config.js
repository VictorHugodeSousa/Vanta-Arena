/* Copie os dados de Project Settings > API no Supabase.
   Utilize SOMENTE a chave publishable (ou anon em projetos antigos).
   Nunca coloque secret / service_role no frontend. */
window.VANTA_CONFIG = {
  supabaseUrl: 'teste',
  supabasePublishableKey: 'teste',
  supabaseAdminEmail: 'teste'
};
