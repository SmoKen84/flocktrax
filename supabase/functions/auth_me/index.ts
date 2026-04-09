console.info('auth_me started');
Deno.serve(async (req)=>{
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    return new Response(JSON.stringify({
      error: 'missing_bearer_token'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  const accessToken = auth.split(' ')[1];
  // Introspect the token via /auth/v1/user
  const url = `${Deno.env.get('SUPABASE_URL')}/auth/v1/user`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    return new Response(JSON.stringify({
      error: 'user_lookup_failed',
      detail: text
    }), {
      status: res.status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  const payload = await res.json();
  // payload has shape: { id, email, role, app_metadata, user_metadata, ... }
  const out = {
    user_id: payload.id || null,
    email: payload.email || null,
    role: payload.role || null,
    // If expires_at is embedded in JWT, Adalo may not need it; keep optional
    expires_at: null
  };
  return new Response(JSON.stringify(out), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
});
