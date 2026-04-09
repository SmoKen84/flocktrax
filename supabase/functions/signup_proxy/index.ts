// Signup proxy with multi-encoding support (JSON, form-urlencoded, multipart) + headers & query params fallback
// Enable diagnostics with ?debug=1. Avoids logging sensitive data; now includes a bounded echo of the received password with endmarks for troubleshooting.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    detectSessionInUrl: false
  }
});
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
function normalizeWeakPasswordMessage(msg, details) {
  const text = `${msg} ${typeof details === 'string' ? details : ''}`.toLowerCase();
  if (/breach|compromised|pwned|have i been pwned|hibp/.test(text)) {
    return {
      message: "Password appears in known breach datasets.",
      hint: "Choose a unique password not seen in breaches. Prefer a manager-generated password (16+ chars)."
    };
  }
  if (/too guessable|very guessable|weak|common words|patterns|dictionary/.test(text)) {
    return {
      message: "Password is too guessable (low entropy).",
      hint: "Use 16+ characters without dictionary words or patterns. Mix words with numbers and symbols or use a generator."
    };
  }
  if (/length|at least \d+/.test(text)) {
    return {
      message: "Password does not meet minimum length requirements.",
      hint: "Increase to at least 12–16 characters (depending on policy)."
    };
  }
  return {
    message: "Password too weak.",
    hint: "Use 16+ chars with upper, lower, number, and symbol. Avoid common words and breached passwords."
  };
}
function classifyPassword(pw) {
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const length = [
    ...pw
  ].length; // codepoint length
  const trimmedEqual = pw === pw.trim();
  const nonAscii = /[^\x00-\x7F]/.test(pw);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(pw);
  const toHex = (arr)=>Array.from(arr).map((b)=>b.toString(16).padStart(2, '0')).join('');
  const head = toHex(bytes.slice(0, Math.min(6, bytes.length)));
  const tail = toHex(bytes.slice(Math.max(0, bytes.length - 6)));
  return {
    length,
    hasLower,
    hasUpper,
    hasDigit,
    hasSymbol,
    trimmed: trimmedEqual,
    nonAscii,
    headHex: head,
    tailHex: tail
  };
}
function redactedEcho(pw) {
  // For debugging transport only. Bounded length and explicit endmarks.
  // Shows up to 40 characters to avoid huge payloads.
  const maxLen = 40;
  const shown = pw.slice(0, maxLen);
  return `>${shown}<`;
}
function mapAuthError(err, debugInfo) {
  const code = err?.status ?? err?.code;
  const error_code = err?.error_code || err?.name || err?.error;
  const msg = err?.msg || err?.message || String(err);
  const details = err?.details ?? err?.hint ?? err?.error_description;
  const isWeak = error_code === "weak_password" || error_code === "AuthWeakPasswordError" || /weak password|too guessable|very guessable|breach|compromised/i.test(`${msg} ${details ?? ''}`) || /at least one character of each/i.test(msg);
  if (isWeak) {
    const info = normalizeWeakPasswordMessage(msg, details);
    return {
      status: 422,
      body: {
        error: "weak_password",
        message: info.message,
        hint: info.hint,
        details: details ?? msg,
        debug: debugInfo
      }
    };
  }
  if (error_code === "user_already_exists" || /already registered|user exists|duplicate/i.test(msg)) {
    return {
      status: 409,
      body: {
        error: "email_in_use",
        message: "Email is already registered. Try logging in instead.",
        debug: debugInfo
      }
    };
  }
  if (error_code === "over_email_send_rate_limit" || code === 429) {
    return {
      status: 429,
      body: {
        error: "rate_limited",
        message: "Too many attempts. Please wait a minute and try again.",
        debug: debugInfo
      }
    };
  }
  if (/invalid email/i.test(msg)) {
    return {
      status: 400,
      body: {
        error: "invalid_email",
        message: "Please enter a valid email address.",
        debug: debugInfo
      }
    };
  }
  return {
    status: code && Number.isInteger(code) ? code : 400,
    body: {
      error: error_code || "signup_failed",
      message: "Signup failed. Please try again.",
      details: msg,
      debug: debugInfo
    }
  };
}
async function parseBody(req) {
  const ctype = req.headers.get("content-type") || "";
  // JSON
  if (ctype.includes("application/json")) {
    const obj = await req.json().catch(()=>({}));
    return normalizeFields(obj);
  }
  // Form URL Encoded
  if (ctype.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const obj = {};
    params.forEach((v, k)=>obj[k] = v);
    return normalizeFields(obj);
  }
  // Multipart form
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    const obj = {};
    for (const [k, v] of form.entries()){
      if (typeof v === "string") obj[k] = v;
    }
    return normalizeFields(obj);
  }
  // Fallback: try JSON, then urlencoded
  try {
    const obj = await req.json();
    return normalizeFields(obj);
  } catch (_) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const obj = {};
    params.forEach((v, k)=>obj[k] = v);
    return normalizeFields(obj);
  }
}
function normalizeFields(raw) {
  if (!raw || typeof raw !== "object") return {};
  const email = pick(raw, [
    "email",
    "Email",
    "e",
    "user",
    "username"
  ]);
  const password = pick(raw, [
    "password",
    "pwd",
    "pass",
    "Password"
  ]);
  let data = undefined;
  if (raw.data && typeof raw.data === "object") data = raw.data;
  return {
    email,
    password,
    data
  };
}
function pick(obj, keys) {
  for (const k of keys){
    const v = obj?.[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}
function coalesceEmailPassword(body, req, url) {
  let email = body.email;
  let password = body.password;
  // 1) Custom headers
  if (!email) email = req.headers.get("x-email") ?? undefined;
  if (!password) password = req.headers.get("x-password") ?? undefined;
  // 2) Query params
  if (!email) email = url.searchParams.get("email") ?? undefined;
  if (!password) password = url.searchParams.get("password") ?? undefined;
  return {
    email,
    password
  };
}
Deno.serve(async (req)=>{
  try {
    const url = new URL(req.url);
    if (req.method !== "POST") {
      return json({
        error: "method_not_allowed",
        message: "Use POST"
      }, 405);
    }
    if (!url.pathname.endsWith("/signup_proxy")) {
      return json({
        error: "not_found",
        message: "Route not found"
      }, 404);
    }
    const debug = url.searchParams.get("debug") === "1";
    const parsed = await parseBody(req);
    const { email: email0, password: password0 } = coalesceEmailPassword(parsed, req, url);
    const email = (email0 || "").trim();
    const password = password0 || "";
    if (!email || !password) {
      return json({
        error: "missing_fields",
        message: "Email and password are required.",
        debug: debug ? {
          emailPresent: !!email,
          passwordPresent: !!password
        } : undefined
      }, 400);
    }
    const debugInfo = debug ? {
      ...classifyPassword(password),
      passwordEcho: redactedEcho(password)
    } : undefined;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: parsed.data ? {
        data: parsed.data
      } : undefined
    });
    if (error) {
      const mapped = mapAuthError(error, debugInfo);
      return json(mapped.body, mapped.status);
    }
    return json({
      user: data.user,
      session: data.session,
      message: data.session ? "Signup successful" : "Signup successful. Check your email to confirm your account.",
      debug: debugInfo
    }, 200);
  } catch (e) {
    console.error("signup_proxy error", e);
    return json({
      error: "internal_error",
      message: "Unexpected error. Please try again."
    }, 500);
  }
});
