import { supabase, isSupabaseConfigured } from './client';

export interface FavoriteRecord {
  id?: string;
  user_id?: string;
  job_id: string;
  created_at?: string;
}

const STORAGE_KEY_FAVORITES = 'remotehunter_favorite_job_ids_v1';

export function getLocalFavoriteJobIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveLocalFavoriteJobIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(ids));
  } catch {}
}

/**
 * Carrega favoritos gravados no Supabase
 */
export async function loadFavoritesFromSupabase(): Promise<string[]> {
  const local = getLocalFavoriteJobIds();
  if (!isSupabaseConfigured()) return local;

  try {
    const { data, error } = await (supabase.from('favorites') as any).select('job_id');
    if (!error && data && data.length > 0) {
      const ids = data.map((r: any) => r.job_id).filter(Boolean);
      const merged = Array.from(new Set([...local, ...ids]));
      saveLocalFavoriteJobIds(merged);
      return merged;
    }
  } catch {}

  return local;
}

/**
 * Salva um favorito no Supabase e localmente
 */
export async function addFavoriteToSupabase(jobId: string): Promise<boolean> {
  const current = getLocalFavoriteJobIds();
  if (!current.includes(jobId)) {
    saveLocalFavoriteJobIds([...current, jobId]);
  }

  if (!isSupabaseConfigured()) return true;

  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userId) {
      await (supabase.from('favorites') as any).upsert(
        { user_id: userId, job_id: jobId },
        { onConflict: 'user_id,job_id' }
      );
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove um favorito do Supabase e localmente
 */
export async function removeFavoriteFromSupabase(jobId: string): Promise<boolean> {
  const current = getLocalFavoriteJobIds();
  saveLocalFavoriteJobIds(current.filter(id => id !== jobId));

  if (!isSupabaseConfigured()) return true;

  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userId) {
      await (supabase.from('favorites') as any)
        .delete()
        .match({ user_id: userId, job_id: jobId });
    }
    return true;
  } catch {
    return false;
  }
}
