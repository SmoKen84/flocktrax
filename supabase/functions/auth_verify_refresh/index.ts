console.info('auth_verify_refresh started');
Deno.serve(async (req)=>{
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'method_not_allowed'
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    const { refresh_token } = await req.json().catch(()=>({
        refresh_token: null
      }));
    if (!refresh_token) {
      return new Response(JSON.stringify({
        error: 'missing_refresh_token'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Exchange refresh token for new session
    const tokenUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/token?grant_type=refresh_token`;
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refresh_token
      })
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      return new Response(JSON.stringify({
        valid: false,
        error: 'refresh_failed',
        detail
      }), {
        status: tokenRes.status,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    const tokenJson = await tokenRes.json();
    const access_token = tokenJson.access_token ?? null;
    const new_refresh_token = tokenJson.refresh_token ?? refresh_token;
    // If we obtained an access token, fetch the user for a flat response
    let user_id = null;
    let email = null;
    let role = null;
    if (access_token) {
      const userUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/user`;
      const userRes = await fetch(userUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
          'Accept': 'application/json'
        }
      });
      if (userRes.ok) {
        const u = await userRes.json();
        user_id = u.id ?? null;
        email = u.email ?? null;
        role = u.role ?? null;
      }
    }
    return new Response(JSON.stringify({
      valid: true,
      access_token,
      refresh_token: new_refresh_token,
      user_id,
      email,
      role
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: 'unexpected_error',
      detail: String(e)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
