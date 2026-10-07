import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/database.types';

export function getSupabaseServerClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 
              process.env.SUPABASE_ANON_KEY || 
              process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !key) {
    throw new Error(
      'Configuração ausente: URL e chave do Supabase são obrigatórios para operações de backend/pipeline.'
    );
  }

  return createClient<Database>(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
