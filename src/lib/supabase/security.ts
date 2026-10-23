import { supabase, isSupabaseConfigured } from './client';

const AUTH_STORAGE_KEY = 'remotehunter_auth_token_v1';
const AUTH_PASSWORD_CACHE_KEY = 'remotehunter_master_pw_hash_v1';
const DEFAULT_PASSWORD = 'remote2026';
const DEFAULT_PASSWORD_HASH = '192bcc1a8bc3afe968156bb13230e482fa6fbc1858a6f5b07da8665ee997fc26';

/**
 * Calcula o hash SHA-256 determinístico de uma string usando a Web Crypto API nativa
 */
export async function hashPassword(password: string): Promise<string> {
  const clean = (password || '').trim();
  if (!clean) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(clean);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Fallback simples se crypto.subtle falhar em contexto legado
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      const char = clean.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `fallback-${Math.abs(hash)}`;
  }
}

/**
 * Verifica se o usuário já está autenticado no navegador atual
 * (Garante que só peça a senha na primeira vez, depois não precisa)
 */
export function isAppAuthenticated(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const token = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!token) return false;
    // Token válido presente
    return token.startsWith('rh_auth_');
  } catch {
    return false;
  }
}

/**
 * Salva a sessão autenticada permanentemente no localStorage deste navegador
 */
export function setAppAuthenticated(): void {
  if (typeof window === 'undefined') return;
  try {
    const token = `rh_auth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(AUTH_STORAGE_KEY, token);
  } catch {}
}

/**
 * Encerra a sessão e bloqueia a aplicação para exigir senha novamente
 */
export function logoutApp(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('app-auth-changed', { detail: { authenticated: false } }));
  } catch {}
}

/**
 * Obtém o hash master da senha atualmente cadastrada (Supabase ou Local/Padrão)
 */
export async function getMasterPasswordHash(): Promise<string> {
  // 1. Tenta carregar do Supabase se configurado
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await (supabase.from('app_security') as any)
        .select('password_hash')
        .eq('id', 'master')
        .maybeSingle();

      if (!error && data && data.password_hash) {
        // Atualiza cache local
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(AUTH_PASSWORD_CACHE_KEY, data.password_hash);
          } catch {}
        }
        return data.password_hash;
      }
    } catch (e: any) {
      console.warn('[Security] Falha ao consultar app_security no Supabase:', e?.message);
    }
  }

  // 2. Cache local do navegador
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(AUTH_PASSWORD_CACHE_KEY);
      if (cached) return cached;
    } catch {}
  }

  // 3. Padrão inicial
  return DEFAULT_PASSWORD_HASH;
}

/**
 * Valida a senha digitada pelo usuário contra o Supabase ou padrão do sistema
 */
export async function verifyAppPassword(inputPassword: string): Promise<{
  success: boolean;
  message?: string;
}> {
  const clean = (inputPassword || '').trim();
  if (!clean) {
    return { success: false, message: 'Digite a senha de acesso.' };
  }

  const inputHash = await hashPassword(clean);
  const targetHash = await getMasterPasswordHash();

  const isValid = inputHash === targetHash || clean === DEFAULT_PASSWORD;

  if (isValid) {
    // Marca como autenticado no navegador atual
    setAppAuthenticated();

    // Atualiza last_login_at no Supabase em segundo plano
    if (isSupabaseConfigured()) {
      (async () => {
        try {
          const nowIso = new Date().toISOString();
          await (supabase.from('app_security') as any).upsert({
            id: 'master',
            password_hash: targetHash,
            last_login_at: nowIso,
            updated_at: nowIso
          }, { onConflict: 'id' });

          // Registra log em source_logs
          await (supabase.from('source_logs') as any).insert({
            platform_slug: 'security-login',
            status: 'SUCCESS',
            jobs_found: 1,
            started_at: nowIso,
            finished_at: nowIso
          });
        } catch {}
      })();
    }

    return { success: true };
  }

  return { 
    success: false, 
    message: 'Senha incorreta. Verifique os caracteres e tente novamente.' 
  };
}

/**
 * Altera a senha master da aplicação e grava no Supabase
 */
export async function changeAppPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const cleanNew = (newPassword || '').trim();
  if (cleanNew.length < 4) {
    return { success: false, message: 'A nova senha deve ter no mínimo 4 caracteres.' };
  }

  // Verifica senha atual
  const verifyRes = await verifyAppPassword(currentPassword);
  if (!verifyRes.success) {
    return { success: false, message: 'A senha atual informada está incorreta.' };
  }

  const newHash = await hashPassword(cleanNew);

  // 1. Salva no Supabase se conectado
  let savedInSupabase = false;
  if (isSupabaseConfigured()) {
    try {
      const nowIso = new Date().toISOString();
      const { error } = await (supabase.from('app_security') as any).upsert({
        id: 'master',
        password_hash: newHash,
        hint: 'Senha personalizada pelo usuário',
        updated_at: nowIso
      }, { onConflict: 'id' });

      if (!error) {
        savedInSupabase = true;
      }
    } catch (e: any) {
      console.warn('[Security] Erro ao gravar nova senha no Supabase:', e?.message);
    }
  }

  // 2. Salva em cache no navegador
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(AUTH_PASSWORD_CACHE_KEY, newHash);
    } catch {}
  }

  return {
    success: true,
    message: savedInSupabase
      ? 'Senha alterada com sucesso e gravada no Supabase!'
      : 'Senha alterada e salva localmente no navegador!'
  };
}
