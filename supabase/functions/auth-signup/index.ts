// deno-lint-ignore-file no-explicit-any
// Auth Signup Edge Function (root route)
// Route: POST /auth-signup
// Creates a Supabase Auth user, validates a signup code, associates farm & role, and returns session
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const url = Deno.env.get('SUPABASE_URL');
const anon = Deno.env.get('SUPABASE_ANON_KEY');
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const publicClient = createClient(url, anon, {
  auth: {
    persistSession: false
  }
});
const serviceClient = createClient(url, service, {
  auth: {
    persistSession: false
  }
});
console.info('auth-signup (root) started');
Deno.serve(async (req)=>{
  try {
    const { pathname } = new URL(req.url);
    // Accept both /auth-signup (root) and legacy /auth/signup
    const isSignup = req.method === 'POST' && (pathname === '/auth-signup' || pathname === '/auth/signup');
    if (!isSignup) {
      return new Response(JSON.stringify({
        error: 'Not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    const body = await req.json();
    if (!body?.email || !body?.password || !body?.signup_code) {
      return resp(400, {
        error: 'Missing email, password, or signup_code'
      });
    }
    // 1) Validate signup code
    const { data: codeRow, error: codeErr } = await serviceClient.from('signup_codes').select('id, farm_id, role_id, max_uses, uses, expires_at, active').eq('code', body.signup_code).maybeSingle();
    if (codeErr) throw codeErr;
    if (!codeRow) return resp(400, {
      error: 'Invalid signup code'
    });
    const now = new Date();
    if (!codeRow.active) return resp(400, {
      error: 'Signup code inactive'
    });
    if (codeRow.expires_at && new Date(codeRow.expires_at) < now) return resp(400, {
      error: 'Signup code expired'
    });
    if (codeRow.max_uses !== null && codeRow.uses !== null && codeRow.uses >= codeRow.max_uses) return resp(400, {
      error: 'Signup code exhausted'
    });
    // 2) Create auth user
    const { data: signUpData, error: signUpErr } = await publicClient.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          full_name: body.full_name ?? null
        }
      }
    });
    if (signUpErr) return resp(400, {
      error: signUpErr.message || 'Failed to sign up'
    });
    const user = signUpData.user;
    const session = signUpData.session; // May be null if email confirmations are enabled
    if (!user) return resp(400, {
      error: 'User not created'
    });
    // 3) Create profile and membership records using service role (bypass RLS)
    const { error: profileErr } = await serviceClient.from('profiles').insert({
      id: user.id,
      full_name: body.full_name ?? null
    }).select().single();
    if (profileErr && profileErr.code !== '23505') {
      return resp(500, {
        error: 'Failed to create profile'
      });
    }
    const { error: memberErr } = await serviceClient.from('farm_members').insert({
      user_id: user.id,
      farm_id: codeRow.farm_id,
      role_id: codeRow.role_id
    }).select().single();
    if (memberErr && memberErr.code !== '23505') {
      return resp(500, {
        error: 'Failed to create farm membership'
      });
    }
    // 4) Increment uses atomically
    const { error: incErr } = await serviceClient.rpc('increment_signup_code_use', {
      p_code_id: codeRow.id
    });
    if (incErr) {
      await serviceClient.from('signup_codes').update({
        uses: (codeRow.uses ?? 0) + 1
      }).eq('id', codeRow.id);
    }
    // 5) Return session or confirmation status
    if (session) {
      return resp(200, {
        user: {
          id: user.id,
          email: user.email
        },
        session
      });
    }
    return resp(200, {
      user: {
        id: user.id,
        email: user.email
      },
      status: 'check_email'
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({
      error: 'Internal error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
function resp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive'
    }
  });
}
