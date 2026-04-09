// access-shim Edge Function (expanded auth parsing)
// Routes: /access-shim/login
// Accepts anon key via: apikey, x-api-key, x-apikey, authorization (any of: Bearer <key>, <key>, 'Token <key>')
// Debug with ?debug=1 to see header names and parsed auth mode (no secrets logged)
const baseCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, x-api-key, x-apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8",
  "Connection": "keep-alive"
};
function withCors(init) {
  return {
    headers: baseCorsHeaders,
    ...init
  };
}
function json(body, init) {
  return new Response(JSON.stringify(body), withCors(init));
}
const PROJECT_URL = Deno.env.get("SUPABASE_URL");
function parseAuthorizationHeader(raw) {
  if (!raw) return {
    key: null,
    mode: 'none'
  };
  const v = raw.trim();
  if (!v) return {
    key: null,
    mode: 'empty'
  };
  const lower = v.toLowerCase();
  // Standard
  if (lower.startsWith('bearer ')) return {
    key: v.slice(7).trim(),
    mode: 'bearer'
  };
  // Some builders send just the token without scheme
  if (!v.includes(' ')) return {
    key: v,
    mode: 'raw'
  };
  // Accept other common prefixes like 'token ' or 'apikey '
  if (lower.startsWith('token ')) return {
    key: v.slice(6).trim(),
    mode: 'token'
  };
  if (lower.startsWith('apikey ')) return {
    key: v.slice(7).trim(),
    mode: 'apikey-scheme'
  };
  // Fallback: try last segment
  const parts = v.split(/\s+/);
  const last = parts[parts.length - 1];
  return last ? {
    key: last.trim(),
    mode: 'fallback'
  } : {
    key: null,
    mode: 'unrecognized'
  };
}
function extractAnonKey(headers) {
  for (const k of [
    'apikey',
    'x-api-key',
    'x-apikey'
  ]){
    const v = headers.get(k);
    if (v && v.trim()) return {
      key: v.trim(),
      source: k
    };
  }
  const { key, mode } = parseAuthorizationHeader(headers.get('authorization'));
  return {
    key,
    source: 'authorization',
    mode
  };
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response(null, withCors());
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const route = parts.slice(1).join('/');
  try {
    if (req.method === 'POST' && route === 'login') {
      const extracted = extractAnonKey(req.headers);
      if (!extracted.key) {
        const debug = url.searchParams.get('debug') === '1';
        if (debug) {
          const seen = [];
          req.headers.forEach((_, k)=>seen.push(k));
          return json({
            error: 'unauthorized',
            message: 'Missing anon key',
            seen_headers: seen.sort(),
            parsed: extracted
          }, {
            status: 401
          });
        }
        return json({
          error: 'unauthorized',
          message: "Provide anon key via 'apikey', 'x-api-key', 'x-apikey', or Authorization header (Bearer <key> or raw token)"
        }, {
          status: 401
        });
      }
      let payload = null;
      try {
        payload = await req.json();
      } catch  {}
      const email = payload?.email?.trim();
      const password = payload?.password;
      if (!email || !password) return json({
        error: 'invalid_request',
        message: 'email and password are required'
      }, {
        status: 400
      });
      if (!PROJECT_URL) return json({
        error: 'server_config',
        message: 'Missing SUPABASE_URL'
      }, {
        status: 500
      });
      const authUrl = `${PROJECT_URL}/auth/v1/token?grant_type=password`;
      const upstream = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'apikey': extracted.key,
          'Authorization': `Bearer ${extracted.key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });
      const data = await upstream.json().catch(()=>({}));
      if (!upstream.ok) {
        const status = upstream.status;
        const message = data && (data.error_description || data.error || data.message) || 'Authentication failed';
        return json({
          error: 'auth_error',
          message
        }, {
          status
        });
      }
      return json(data, {
        status: 200
      });
    }
    return json({
      error: 'not_found',
      message: 'Route not found'
    }, {
      status: 404
    });
  } catch (err) {
    console.error('Unhandled error', err);
    return json({
      error: 'server_error',
      message: 'Unexpected error'
    }, {
      status: 500
    });
  }
});
