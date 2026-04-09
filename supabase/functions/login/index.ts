// supabase/functions/login/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req)=>{
  // CORS (Adalo will hit this from apps.adalo.com / preview domains)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders(req)
    });
  }
  try {
    const { email, password } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabase = createClient(supabaseUrl, anonKey);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      return json({
        ok: false,
        error: error.message
      }, 401, req);
    }
    // data.session contains access_token/refresh_token/expires_in
    return json({
      ok: true,
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      expires_in: data.session?.expires_in,
      token_type: data.session?.token_type,
      user: {
        id: data.user?.id,
        email: data.user?.email
      }
    }, 200, req);
  } catch (e) {
    return json({
      ok: false,
      error: String(e)
    }, 500, req);
  }
});
function corsHeaders(req) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}
function json(body, status, req) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req)
    }
  });
}
