import { supabase, isSupabaseConfigured } from '../lib/supabase/client';

export const DEFAULT_BLOCKED_KEYWORDS: string[] = [
  'italiano',
  'italian',
  'alemão',
  'alemao',
  'german',
  'francês',
  'frances',
  'french',
  'japonês',
  'japones',
  'japanese',
  'mandarim',
  'mandarin',
  'chinês',
  'chines',
  'chinese',
  'russo',
  'russian',
  'coreano',
  'korean'
];

const STORAGE_KEY_BLOCKED_KEYWORDS = 'remotehunter_blocked_keywords_v2';

/**
 * Normaliza uma palavra para comparação (remove acentos e converte para minúsculas)
 */
export function normalizeKeyword(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Retorna as palavras proibidas salvas no localStorage ou os padrões
 */
export function getBlockedKeywords(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BLOCKED_KEYWORDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Purge unwanted blocked words like english/inglês/espanhol if present from v1/v2
        const cleaned = parsed.filter(w => {
          const n = normalizeKeyword(w);
          return !['ingles', 'english', 'espanhol', 'spanish', 'bilingue', 'bilingual'].includes(n);
        });
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY_BLOCKED_KEYWORDS, JSON.stringify(cleaned));
          return cleaned;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('[BlockedKeywords] Erro ao carregar:', e);
  }
  return DEFAULT_BLOCKED_KEYWORDS;
}

/**
 * Carrega a lista oficial de palavras proibidas diretamente do Supabase PostgreSQL
 */
export async function loadBlockedKeywordsFromSupabase(): Promise<string[]> {
  const localList = getBlockedKeywords();

  if (!isSupabaseConfigured()) {
    return localList;
  }

  try {
    const { data, error } = await supabase
      .from('blocked_keywords')
      .select('term')
      .order('term', { ascending: true });

    if (error) {
      console.warn('[BlockedKeywords] Erro ao consultar Supabase:', error.message);
      return localList;
    }

    if (data && data.length > 0) {
      const termsFromDb = Array.from(
        new Set(data.map((row: any) => row.term.trim()).filter(Boolean))
      );

      // Salva no localStorage para manter atualizado em qualquer aba/janela
      localStorage.setItem(STORAGE_KEY_BLOCKED_KEYWORDS, JSON.stringify(termsFromDb));
      window.dispatchEvent(new CustomEvent('blocked-keywords-updated', { detail: termsFromDb }));
      return termsFromDb;
    }

    // Se o banco está conectado mas vazio, faz semeadura inicial
    if (data && data.length === 0) {
      console.log('🌱 [BlockedKeywords] Semeando termos padrão no Supabase...');
      await Promise.all(DEFAULT_BLOCKED_KEYWORDS.map(term =>
        (supabase.from('blocked_keywords') as any).upsert(
          { term, category: 'IDIOMA_ESTRANGEIRO' },
          { onConflict: 'term' }
        )
      ));
    }

    return localList;
  } catch (err: any) {
    console.warn('[BlockedKeywords] Falha de conexão com Supabase:', err?.message);
    return localList;
  }
}

/**
 * Salva a lista de palavras proibidas localmente e no Supabase
 */
export function saveBlockedKeywords(keywords: string[]): void {
  try {
    const unique = Array.from(new Set(keywords.map(k => k.trim()).filter(Boolean)));
    localStorage.setItem(STORAGE_KEY_BLOCKED_KEYWORDS, JSON.stringify(unique));
    // Dispara evento customizado para sincronização de abas e componentes
    window.dispatchEvent(new CustomEvent('blocked-keywords-updated', { detail: unique }));

    // Sincroniza com Supabase se disponível
    if (isSupabaseConfigured()) {
      Promise.all(unique.map(term => 
        (supabase.from('blocked_keywords') as any).upsert(
          { term, category: 'IDIOMA_ESTRANGEIRO' },
          { onConflict: 'term' }
        )
      )).catch(err => {
        console.warn('[BlockedKeywords] Erro ao sincronizar com Supabase:', err);
      });
    }
  } catch (e) {
    console.error('[BlockedKeywords] Erro ao salvar:', e);
  }
}

/**
 * Adiciona uma nova palavra proibida (grava no localStorage e no Supabase)
 */
export function addBlockedKeyword(keyword: string): string[] {
  const clean = keyword.trim().toLowerCase();
  if (!clean) return getBlockedKeywords();
  
  const current = getBlockedKeywords();
  const normalizedNew = normalizeKeyword(clean);
  
  if (!current.some(k => normalizeKeyword(k) === normalizedNew)) {
    const updated = [...current, clean];
    saveBlockedKeywords(updated);
    
    // Gravação direta no Supabase
    if (isSupabaseConfigured()) {
      (supabase.from('blocked_keywords') as any).upsert(
        { term: clean, category: 'IDIOMA_ESTRANGEIRO' },
        { onConflict: 'term' }
      ).catch((err: any) => console.warn('[Supabase] Erro ao gravar palavra:', err));
    }
    
    return updated;
  }
  return current;
}

/**
 * Remove uma palavra proibida (remove do localStorage e deleta da tabela do Supabase)
 */
export function removeBlockedKeyword(keyword: string): string[] {
  const normalizedTarget = normalizeKeyword(keyword);
  const current = getBlockedKeywords();
  const updated = current.filter(k => normalizeKeyword(k) !== normalizedTarget);
  saveBlockedKeywords(updated);

  // Deleta diretamente da tabela no Supabase
  if (isSupabaseConfigured()) {
    (supabase.from('blocked_keywords') as any)
      .delete()
      .eq('term', keyword.trim().toLowerCase())
      .then(() => {
        // Também tenta remover a versão exata caso haja diferenças de acentuação
        (supabase.from('blocked_keywords') as any)
          .delete()
          .ilike('term', keyword.trim())
          .catch(() => {});
      })
      .catch((err: any) => console.warn('[Supabase] Erro ao deletar palavra:', err));
  }

  return updated;
}

/**
 * Restaura as palavras padrão
 */
export function resetDefaultBlockedKeywords(): string[] {
  saveBlockedKeywords(DEFAULT_BLOCKED_KEYWORDS);
  return DEFAULT_BLOCKED_KEYWORDS;
}

/**
 * Limpa todas as palavras
 */
export function clearAllBlockedKeywords(): string[] {
  saveBlockedKeywords([]);
  if (isSupabaseConfigured()) {
    (supabase.from('blocked_keywords') as any)
      .delete()
      .neq('term', '__dummy_impossible_key__')
      .catch((err: any) => console.warn('[Supabase] Erro ao limpar palavras:', err));
  }
  return [];
}

/**
 * Verifica se um texto ou vaga contém alguma das palavras proibidas
 */
export function checkJobForBlockedKeywords(
  title: string,
  description: string,
  keywords?: string[]
): {
  isBlocked: boolean;
  matchedTerms: string[];
} {
  const activeKeywords = keywords || getBlockedKeywords();
  if (!activeKeywords || activeKeywords.length === 0) {
    return { isBlocked: false, matchedTerms: [] };
  }

  const combinedNormalized = normalizeKeyword(`${title} ${description}`);
  const matchedTerms: string[] = [];

  for (const keyword of activeKeywords) {
    const normKey = normalizeKeyword(keyword);
    if (!normKey) continue;

    // Busca como palavra completa ou expressão exata (evita falsos positivos em substrings curtas)
    const escaped = normKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');

    if (regex.test(combinedNormalized)) {
      matchedTerms.push(keyword);
    }
  }

  return {
    isBlocked: matchedTerms.length > 0,
    matchedTerms
  };
}

// Inicializa escuta automática de hidratação do Supabase/Vercel
if (typeof window !== 'undefined') {
  loadBlockedKeywordsFromSupabase().catch(() => {});
  window.addEventListener('supabase-configured-from-vercel', () => {
    loadBlockedKeywordsFromSupabase().catch(() => {});
  });
}
