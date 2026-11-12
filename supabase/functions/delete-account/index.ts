// SealedVault – smazání účtu (povinné pro App Store / Google Play).
// Volá ho přihlášený uživatel z appky; smaže jeho data, push tokeny, záznamy alertů a nakonec účet.
// Tajný klíč (service role) je jen tady na serveru – Supabase ho funkci předá sám, v appce není.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  // kdo volá: ověřit přihlášení z hlavičky Authorization (token uživatele)
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !who.user) return json({ error: 'unauthorized' }, 401);
  const uid = who.user.id;

  // data uživatele (tabulky mají i on delete cascade – mažeme výslovně, ať je jasné, co se děje)
  for (const table of ['user_data', 'push_tokens', 'alert_log']) {
    const { error } = await admin.from(table).delete().eq('user_id', uid);
    if (error) return json({ error: `${table}: ${error.message}` }, 500);
  }
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
