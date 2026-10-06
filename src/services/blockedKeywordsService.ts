export const DEFAULT_BLOCKED_KEYWORDS: string[] = [
  'italiano',
  'italian',
  'inglês',
  'ingles',
  'english',
  'bilíngue',
  'bilingue',
  'bilingual',
  'espanhol',
  'spanish',
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
  'chinese'
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
 * Retorna as palavras proibidas salvas ou os padrões
 */
export function getBlockedKeywords(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BLOCKED_KEYWORDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('[BlockedKeywords] Erro ao carregar:', e);
  }
  return DEFAULT_BLOCKED_KEYWORDS;
}

/**
 * Salva a lista de palavras proibidas
 */
export function saveBlockedKeywords(keywords: string[]): void {
  try {
    const unique = Array.from(new Set(keywords.map(k => k.trim()).filter(Boolean)));
    localStorage.setItem(STORAGE_KEY_BLOCKED_KEYWORDS, JSON.stringify(unique));
    // Dispara evento customizado para sincronização de abas e componentes
    window.dispatchEvent(new CustomEvent('blocked-keywords-updated', { detail: unique }));
  } catch (e) {
    console.error('[BlockedKeywords] Erro ao salvar:', e);
  }
}

/**
 * Adiciona uma nova palavra proibida
 */
export function addBlockedKeyword(keyword: string): string[] {
  const clean = keyword.trim().toLowerCase();
  if (!clean) return getBlockedKeywords();
  
  const current = getBlockedKeywords();
  const normalizedNew = normalizeKeyword(clean);
  
  if (!current.some(k => normalizeKeyword(k) === normalizedNew)) {
    const updated = [...current, clean];
    saveBlockedKeywords(updated);
    return updated;
  }
  return current;
}

/**
 * Remove uma palavra proibida
 */
export function removeBlockedKeyword(keyword: string): string[] {
  const normalizedTarget = normalizeKeyword(keyword);
  const current = getBlockedKeywords();
  const updated = current.filter(k => normalizeKeyword(k) !== normalizedTarget);
  saveBlockedKeywords(updated);
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
    // Se a palavra tiver mais de 2 letras, verifica limites de palavra
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
