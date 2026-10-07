import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/database.types';

// Cache em memória da configuração recebida da Vercel / Servidor
let serverRuntimeConfig: { url: string; anonKey: string; isConfigured: boolean } | null = null;

export const getSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  let localUrl = '';
  let localKey = '';

  try {
    localUrl = localStorage.getItem('remotehunter_supabase_url') || '';
    localKey = localStorage.getItem('remotehunter_supabase_anon_key') || '';
  } catch {}

  const url = (serverRuntimeConfig?.url || envUrl || localUrl).trim();
  const anonKey = (serverRuntimeConfig?.anonKey || envKey || localKey).trim();

  const isConfigured = Boolean(
    url && 
    anonKey && 
    url.startsWith('https://') &&
    !url.includes('sua-instancia') &&
    !url.includes('seu-projeto')
  );

  return {
    url,
    anonKey,
    isConfigured,
    source: isConfigured 
      ? (serverRuntimeConfig?.url ? 'vercel' : (envUrl ? 'env' : 'local')) 
      : 'none'
  };
};

export const isSupabaseConfigured = (): boolean => {
  return getSupabaseConfig().isConfigured;
};

export const setCustomSupabaseConfig = (url: string, anonKey: string) => {
  try {
    if (url && anonKey) {
      localStorage.setItem('remotehunter_supabase_url', url.trim());
      localStorage.setItem('remotehunter_supabase_anon_key', anonKey.trim());
    } else {
      localStorage.removeItem('remotehunter_supabase_url');
      localStorage.removeItem('remotehunter_supabase_anon_key');
    }
  } catch {}
};

// Inicializa cliente seguro
const cfg = getSupabaseConfig();
const validUrl = cfg.isConfigured ? cfg.url : 'https://placeholder.supabase.co';
const validKey = cfg.isConfigured ? cfg.anonKey : 'placeholder-anon-key';

export let supabase: SupabaseClient<Database> = createClient<Database>(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const reinitializeSupabaseClient = () => {
  const currentCfg = getSupabaseConfig();
  const u = currentCfg.isConfigured ? currentCfg.url : 'https://placeholder.supabase.co';
  const k = currentCfg.isConfigured ? currentCfg.anonKey : 'placeholder-anon-key';
  supabase = createClient<Database>(u, k, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return currentCfg.isConfigured;
};

/**
 * Consulta a API da Vercel (/api/config) para carregar as credenciais configuradas nas
 * variáveis de ambiente do servidor, garantindo que qualquer novo navegador conecte automaticamente!
 */
export async function syncConfigFromVercel(): Promise<{ isConfigured: boolean; url: string }> {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data && data.isConfigured && data.supabaseUrl && data.supabaseAnonKey) {
        serverRuntimeConfig = {
          url: data.supabaseUrl,
          anonKey: data.supabaseAnonKey,
          isConfigured: true
        };
        reinitializeSupabaseClient();
        console.log('⚡ [Supabase] Conectado automaticamente via variáveis de ambiente da Vercel!');
        window.dispatchEvent(new CustomEvent('supabase-configured-from-vercel', { detail: serverRuntimeConfig }));
        return { isConfigured: true, url: data.supabaseUrl };
      }
    }
  } catch (e: any) {
    console.warn('[Supabase] Falha ao consultar /api/config:', e?.message);
  }
  return { isConfigured: isSupabaseConfigured(), url: getSupabaseConfig().url };
}

// Dispara hidratação imediata ao carregar o script no navegador
if (typeof window !== 'undefined') {
  syncConfigFromVercel().catch(() => {});
}
