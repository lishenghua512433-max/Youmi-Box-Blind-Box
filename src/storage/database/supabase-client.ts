import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

let envLoaded = false;

/**
 * Parse a .env file and set variables into process.env
 * Works on Windows, Linux, macOS without any external dependency
 */
function parseEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function loadEnv(): void {
  if (envLoaded || (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY)) {
    return;
  }

  // 1) Try .env.local / .env files (works on Windows/Linux/macOS)
  try {
    const projectRoot = resolve(process.cwd());
    parseEnvFile(resolve(projectRoot, '.env.local'));
    parseEnvFile(resolve(projectRoot, '.env'));
    if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
      envLoaded = true;
      return;
    }
  } catch {
    // file read failed, continue
  }

  // 2) Try dotenv package if available
  try {
    require('dotenv').config({ path: resolve(process.cwd(), '.env.local') });
    require('dotenv').config();
    if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
      envLoaded = true;
      return;
    }
  } catch {
    // dotenv not available
  }

  // 3) Coze platform specific: load from workload identity (Linux only)
  try {
    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }

    envLoaded = true;
  } catch {
    // Silently fail - Coze platform not available (e.g. local Windows deployment)
  }
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
    throw new Error('COZE_SUPABASE_URL is not set');
  }
  if (!anonKey) {
    throw new Error('COZE_SUPABASE_ANON_KEY is not set');
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
    key = anonKey;
  } else {
    const serviceRoleKey = getSupabaseServiceRoleKey();
    key = serviceRoleKey ?? anonKey;
  }

  const globalOptions: Record<string, any> = {};
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
