import { createClient, SupabaseClient } from '@supabase/supabase-js';

let envLoaded = false;

function loadEnv(): void {
  if (envLoaded || (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY)) {
    return;
  }

  // On Vercel / standard hosting platforms, env vars are injected by the platform.
  // On local dev, .env.local / .env files are auto-loaded by Next.js.
  // No need for manual file parsing or child_process.

  envLoaded = true;
}

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

function getSupabaseCredentials(): SupabaseCredentials {
  loadEnv();

  const url = process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('COZE_SUPABASE_URL is not set. Please configure it in your hosting platform environment variables.');
  }
  if (!anonKey) {
    throw new Error('COZE_SUPABASE_ANON_KEY is not set. Please configure it in your hosting platform environment variables.');
  }

  return { url, anonKey };
}

function getSupabaseServiceRoleKey(): string | undefined {
  loadEnv();
  return process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
}

function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  let key: string;
  if (token) {
    // User-facing requests (with auth token) use anon key + RLS
    key = anonKey;
  } else {
    // Server-side API routes MUST use service_role_key to bypass RLS
    // If not configured, throw a clear error instead of silently falling back
    // to anon_key (which gets blocked by RLS and causes confusing 500 errors)
    const serviceRoleKey = getSupabaseServiceRoleKey();
    if (!serviceRoleKey) {
      throw new Error(
        'COZE_SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Server-side API routes require the service role key to bypass Row Level Security (RLS). ' +
        'Please add it to your environment variables. ' +
        'You can find it in Supabase Dashboard → Settings → API → service_role key.'
      );
    }
    key = serviceRoleKey;
  }

  const globalOptions: Record<string, unknown> = {};
  if (token) {
    globalOptions.headers = { Authorization: `Bearer ${token}` };
  }
  return createClient(url, key, {
    global: globalOptions,
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export { loadEnv, getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient };
