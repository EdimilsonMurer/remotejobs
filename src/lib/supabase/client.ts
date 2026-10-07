import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/database.types';

export const getSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  let localUrl = '';
  let localKey = '';

  try {
    localUrl = localStorage.getItem('remotehunter_supabase_url') || '';
    localKey = localStorage.getItem('remotehunter_supabase_anon_key') || '';
  } catch {}

  const url = (localUrl || envUrl).trim();
  const anonKey = (localKey || envKey).trim();

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
    source: isConfigured ? (localUrl ? 'local' : 'env') : 'none'
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
