import { supabase, isSupabaseConfigured } from './client';

export interface CustomSnippet {
  id: string;
  title: string;
  content: string;
  category?: string;
}

export interface CandidateProfileData {
  id?: string;
  user_id?: string | null;
  free_notes: string;
  custom_snippets: CustomSnippet[];
  created_at?: string;
  updated_at?: string;
}

export const STORAGE_KEY_CANDIDATE_NOTES = 'remotehunter_candidate_notes_v1';

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfileData = {
  free_notes: '',
  custom_snippets: []
};

/**
 * Carrega os dados do Bloco de Notas do Candidato.
 * PRIMEIRO busca do Supabase (prioridade absoluta na nuvem).
 */
export async function loadCandidateNotes(): Promise<{
  data: CandidateProfileData;
  source: 'supabase' | 'local';
}> {
  // 1. PRIMEIRO CONSULTA O SUPABASE
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await (supabase as any)
        .from('candidate_notes')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const row = data[0];
        const loaded: CandidateProfileData = {
          id: row.id,
          user_id: row.user_id,
          free_notes: row.free_notes || '',
          custom_snippets: Array.isArray(row.custom_snippets)
            ? row.custom_snippets
            : (typeof row.custom_snippets === 'string' ? JSON.parse(row.custom_snippets) : []),
          created_at: row.created_at,
          updated_at: row.updated_at
        };

        try {
          localStorage.setItem(STORAGE_KEY_CANDIDATE_NOTES, JSON.stringify(loaded));
        } catch {}

        return { data: loaded, source: 'supabase' };
      }
    } catch (err) {
      console.warn('[CandidateNotes] Falha ao carregar do Supabase:', err);
    }
  }

  // 2. Cache local como fallback apenas se Supabase não estiver disponível
  let localData: CandidateProfileData = { ...DEFAULT_CANDIDATE_PROFILE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CANDIDATE_NOTES);
    if (raw) {
      const parsed = JSON.parse(raw);
      localData = {
        ...DEFAULT_CANDIDATE_PROFILE,
        ...parsed,
        custom_snippets: Array.isArray(parsed.custom_snippets) ? parsed.custom_snippets : []
      };
    }
  } catch (e) {
    console.warn('[CandidateNotes] Erro ao ler cache local:', e);
  }

  return { data: localData, source: 'local' };
}

/**
 * Salva os dados do Bloco de Notas.
 * PRIMEIRO grava no Supabase (regra obrigatória de persistência).
 */
export async function saveCandidateNotesToSupabase(
  profile: CandidateProfileData
): Promise<{ success: boolean; id?: string; error?: string }> {
  // PRIMEIRO GRAVA NO SUPABASE
  if (!isSupabaseConfigured()) {
    try {
      localStorage.setItem(STORAGE_KEY_CANDIDATE_NOTES, JSON.stringify(profile));
    } catch {}
    return { 
      success: false, 
      error: 'Supabase não conectado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel ou na aba Configurações.' 
    };
  }

  try {
    const payload = {
      free_notes: profile.free_notes || '',
      custom_snippets: profile.custom_snippets || [],
      updated_at: new Date().toISOString()
    };

    let resultId = profile.id;

    if (profile.id) {
      // Atualiza registro existente
      const { data, error } = await (supabase as any)
        .from('candidate_notes')
        .update(payload)
        .eq('id', profile.id)
        .select('id')
        .single();

      if (error) throw error;
      resultId = data?.id || profile.id;
    } else {
      // Verifica se já existe registro antes de inserir para não duplicar
      const { data: existing, error: selectErr } = await (supabase as any)
        .from('candidate_notes')
        .select('id')
        .limit(1);

      if (!selectErr && existing && existing.length > 0) {
        const existingId = existing[0].id;
        const { error } = await (supabase as any)
          .from('candidate_notes')
          .update(payload)
          .eq('id', existingId);

        if (error) throw error;
        resultId = existingId;
      } else {
        const { data, error } = await (supabase as any)
          .from('candidate_notes')
          .insert([payload])
          .select('id')
          .single();

        if (error) throw error;
        resultId = data?.id;
      }
    }

    if (resultId) {
      profile.id = resultId;
    }

    // Após confirmação do Supabase, atualiza cache local
    try {
      localStorage.setItem(STORAGE_KEY_CANDIDATE_NOTES, JSON.stringify(profile));
    } catch {}

    return { success: true, id: resultId };
  } catch (err: any) {
    console.error('[CandidateNotes] Erro ao gravar no Supabase:', err);
    // Salva em cache local como contingência em caso de falha de rede
    try {
      localStorage.setItem(STORAGE_KEY_CANDIDATE_NOTES, JSON.stringify(profile));
    } catch {}
    return { success: false, error: err?.message || 'Falha ao gravar no Supabase' };
  }
}
