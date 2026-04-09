console.info('auth_logout started');
Deno.serve(async (req)=>{
  // Expect Authorization: Bearer <access_token>
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'missing_bearer_token'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  const accessToken = auth.split(' ')[1];
  // Call Supabase Auth logout endpoint
  const url = `${Deno.env.get('SUPABASE_URL')}/auth/v1/logout`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    return new Response(JSON.stringify({
      ok: false,
      error: 'logout_failed',
      detail: text
    }), {
      status: res.status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  return new Response(JSON.stringify({
    ok: true
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
});
