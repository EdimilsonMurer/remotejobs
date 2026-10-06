import { NormalizedJob } from '../connectors/base/types';
import { JobAnalysis } from '../types/job';

export interface UnifiedJobWithStatus extends NormalizedJob {
  analysis?: JobAnalysis;
  is_new?: boolean;
  first_seen_at?: string;
  is_seen?: boolean;
}

const STORAGE_KEY_KNOWN_IDS = 'remotehunter_known_job_ids_v2';
const STORAGE_KEY_NEW_IDS = 'remotehunter_new_job_ids_v2';
const STORAGE_KEY_SEEN_IDS = 'remotehunter_seen_job_ids_v2';
const STORAGE_KEY_LAST_SYNC = 'remotehunter_last_sync_timestamp_v2';

export interface SyncState {
  knownIds: Set<string>;
  newIds: Set<string>;
  seenIds: Set<string>;
  lastSyncAt: string | null;
}

/**
 * Lê o estado armazenado localmente
 */
export function getStoredSyncState(): SyncState {
  try {
    const knownRaw = localStorage.getItem(STORAGE_KEY_KNOWN_IDS);
    const newRaw = localStorage.getItem(STORAGE_KEY_NEW_IDS);
    const seenRaw = localStorage.getItem(STORAGE_KEY_SEEN_IDS);
    const lastSync = localStorage.getItem(STORAGE_KEY_LAST_SYNC);

    return {
      knownIds: new Set(knownRaw ? JSON.parse(knownRaw) : []),
      newIds: new Set(newRaw ? JSON.parse(newRaw) : []),
      seenIds: new Set(seenRaw ? JSON.parse(seenRaw) : []),
      lastSyncAt: lastSync || null
    };
  } catch (e) {
    console.error('[JobsSyncService] Erro ao carregar estado:', e);
    return {
      knownIds: new Set(),
      newIds: new Set(),
      seenIds: new Set(),
      lastSyncAt: null
    };
  }
}

/**
 * Salva o estado atual no localStorage
 */
export function saveSyncState(state: SyncState): void {
  try {
    localStorage.setItem(STORAGE_KEY_KNOWN_IDS, JSON.stringify(Array.from(state.knownIds)));
    localStorage.setItem(STORAGE_KEY_NEW_IDS, JSON.stringify(Array.from(state.newIds)));
    localStorage.setItem(STORAGE_KEY_SEEN_IDS, JSON.stringify(Array.from(state.seenIds)));
    if (state.lastSyncAt) {
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, state.lastSyncAt);
    }
  } catch (e) {
    console.error('[JobsSyncService] Erro ao salvar estado:', e);
  }
}

/**
 * Aplica os marcadores is_new e is_seen à lista de vagas com base no estado salvo
 */
export function applyNewJobFlags(jobs: UnifiedJobWithStatus[]): UnifiedJobWithStatus[] {
  let state = getStoredSyncState();

  // Se for a primeira inicialização absoluta no navegador, define o baseline
  if (state.knownIds.size === 0 && jobs.length > 0) {
    const allIds = new Set(jobs.map(j => j.external_id));
    // Destaca as 3 primeiras vagas mais recentes como "Novas" inicialmente para feedback imediato
    const initialNewIds = new Set(jobs.slice(0, 3).map(j => j.external_id));
    
    state = {
      knownIds: allIds,
      newIds: initialNewIds,
      seenIds: new Set(),
      lastSyncAt: new Date().toISOString()
    };
    saveSyncState(state);
  }

  return jobs.map(job => {
    const isNew = state.newIds.has(job.external_id) && !state.seenIds.has(job.external_id);
    const isSeen = state.seenIds.has(job.external_id);

    return {
      ...job,
      is_new: isNew,
      is_seen: isSeen,
      first_seen_at: job.first_seen_at || (isNew ? state.lastSyncAt || new Date().toISOString() : undefined)
    };
  });
}

/**
 * Atualiza o banco de dados de vagas comparando o estado anterior com o novo.
 * Vagas com external_id ausente na base anterior são identificadas e carimbadas como NOVAS.
 */
export function processDatabaseUpdate(
  existingJobs: UnifiedJobWithStatus[],
  freshIncomingJobs: UnifiedJobWithStatus[]
): {
  updatedJobs: UnifiedJobWithStatus[];
  newJobsCount: number;
  totalCount: number;
  newJobIds: string[];
  syncTimestamp: string;
} {
  const state = getStoredSyncState();
  const syncTimestamp = new Date().toISOString();

  // Se não havia estado anterior, usa a lista atual como base
  const previousKnownIds = state.knownIds.size > 0 
    ? state.knownIds 
    : new Set(existingJobs.map(j => j.external_id));

  const newlyDiscoveredIds: string[] = [];
  const updatedKnownIds = new Set(previousKnownIds);

  // Combina e identifica novidades
  const mergedMap = new Map<string, UnifiedJobWithStatus>();

  // Primeiro adiciona as existentes
  for (const job of existingJobs) {
    mergedMap.set(job.external_id, { ...job });
  }

  // Agora compara e insere as recebidas
  for (const fresh of freshIncomingJobs) {
    const isBrandNew = !previousKnownIds.has(fresh.external_id);

    if (isBrandNew) {
      newlyDiscoveredIds.push(fresh.external_id);
      updatedKnownIds.add(fresh.external_id);
      state.newIds.add(fresh.external_id);
      // Remove de visto caso estivesse por algum motivo
      state.seenIds.delete(fresh.external_id);
    }

    const isCurrentNew = state.newIds.has(fresh.external_id) && !state.seenIds.has(fresh.external_id);

    mergedMap.set(fresh.external_id, {
      ...fresh,
      is_new: isCurrentNew,
      is_seen: state.seenIds.has(fresh.external_id),
      first_seen_at: fresh.first_seen_at || (isBrandNew ? syncTimestamp : undefined)
    });
  }

  // Atualiza estado salvo
  state.knownIds = updatedKnownIds;
  state.lastSyncAt = syncTimestamp;
  saveSyncState(state);

  const updatedJobs = Array.from(mergedMap.values());
  // Ordena para que novas vagas apareçam no topo
  updatedJobs.sort((a, b) => {
    if (a.is_new && !b.is_new) return -1;
    if (!a.is_new && b.is_new) return 1;
    return (b.analysis?.compatibility_score || 0) - (a.analysis?.compatibility_score || 0);
  });

  return {
    updatedJobs,
    newJobsCount: state.newIds.size - Array.from(state.newIds).filter(id => state.seenIds.has(id)).length,
    totalCount: updatedJobs.length,
    newJobIds: newlyDiscoveredIds,
    syncTimestamp
  };
}

/**
 * Marca uma vaga individual como visualizada/lida pelo usuário
 */
export function markJobAsSeen(jobId: string): void {
  const state = getStoredSyncState();
  state.newIds.delete(jobId);
  state.seenIds.add(jobId);
  saveSyncState(state);
}

/**
 * Marca todas as vagas novas como lidas/vistas
 */
export function markAllJobsAsSeen(): void {
  const state = getStoredSyncState();
  for (const id of state.newIds) {
    state.seenIds.add(id);
  }
  state.newIds.clear();
  saveSyncState(state);
}

/**
 * Vagas simuladas de alta compatibilidade para teste imediato de atualização
 */
export const SAMPLE_FRESH_JOBS: UnifiedJobWithStatus[] = [
  {
    external_id: 'fresh-alignerr-pt-01',
    platform_slug: 'alignerr',
    title: 'AI Prompt Evaluator & Writer - Brazilian Portuguese',
    company: 'Alignerr / Labelbox',
    url: 'https://www.alignerr.com/',
    canonical_url: 'https://www.alignerr.com/',
    source_url: 'https://www.alignerr.com/',
    description: 'Avaliação de respostas e raciocínio de modelos avançados de IA em Português do Brasil. Trabalho 100% assíncrono e remoto com remuneração em Dólar ($ USD). Sem reuniões ou entrevistas orais em inglês.',
    country: 'Brasil',
    location: '100% Remoto (Brasil)',
    remote: true,
    employment_type: 'Freelance / Contratado',
    salary_min: 15,
    salary_max: 30,
    salary_currency: 'USD',
    published_at: new Date().toISOString(),
    analysis: {
      english_status: 'PARTIAL',
      portuguese_required: true,
      portuguese_level: 'NATIVE',
      brazil_eligible: true,
      remote_eligible: true,
      job_category: 'AI',
      experience_level: 'ENTRY',
      salary_detected: true,
      salary_min: 15,
      salary_max: 30,
      salary_currency: 'USD',
      compatibility_score: 96,
      confidence: 95,
      reason: 'Excelente oportunidade recém-descoberta: trabalho 100% em português brasileiro com pagamento em dólar. Avaliação por testes práticos na plataforma sem entrevista falada.',
      analysis_version: 'v1',
      analyzed_at: new Date().toISOString()
    }
  },
  {
    external_id: 'fresh-mindrift-writer-02',
    platform_slug: 'mindrift',
    title: 'AI Tutor & Content Writer - Português Brasileiro',
    company: 'Mindrift',
    url: 'https://mindrift.ai/',
    canonical_url: 'https://mindrift.ai/',
    source_url: 'https://mindrift.ai/',
    description: 'Redação e revisão de textos e respostas em português natural para refinamento de grandes modelos de linguagem (LLMs). Pagamento semanal em Dólar. Processo 100% online.',
    country: 'Brasil',
    location: 'Remoto (Brasil)',
    remote: true,
    employment_type: 'Freelance',
    salary_min: 12,
    salary_max: 22,
    salary_currency: 'USD',
    published_at: new Date().toISOString(),
    analysis: {
      english_status: 'PARTIAL',
      portuguese_required: true,
      portuguese_level: 'NATIVE',
      brazil_eligible: true,
      remote_eligible: true,
      job_category: 'AI',
      experience_level: 'ENTRY',
      salary_detected: true,
      salary_min: 12,
      salary_max: 22,
      salary_currency: 'USD',
      compatibility_score: 93,
      confidence: 90,
      reason: 'Nova oportunidade adicionada: criação e curadoria de conteúdo em português para IA. Seleção por teste de escrita assíncrono.',
      analysis_version: 'v1',
      analyzed_at: new Date().toISOString()
    }
  },
  {
    external_id: 'fresh-welo-search-rater-03',
    platform_slug: 'welocalize',
    title: 'Media Search Quality Rater - Português do Brasil (Edição Recente)',
    company: 'Welocalize / Welo Data',
    url: 'https://www.welocalize.com/careers/',
    canonical_url: 'https://www.welocalize.com/careers/',
    source_url: 'https://www.welocalize.com/careers/',
    description: 'Nova vaga aberta para avaliação de qualidade de busca e resultados de mídia para o mercado brasileiro. Horários livres de 10 a 20h/semana.',
    country: 'Brasil',
    location: '100% Remoto (Brasil)',
    remote: true,
    employment_type: 'Contract',
    salary_min: 5,
    salary_max: 10,
    salary_currency: 'USD',
    published_at: new Date().toISOString(),
    analysis: {
      english_status: 'NONE',
      portuguese_required: true,
      portuguese_level: 'NATIVE',
      brazil_eligible: true,
      remote_eligible: true,
      job_category: 'ANNOTATION',
      experience_level: 'ENTRY',
      salary_detected: true,
      salary_min: 5,
      salary_max: 10,
      salary_currency: 'USD',
      compatibility_score: 98,
      confidence: 92,
      reason: 'Vaga prioritária recém-chegada: todo o trabalho e critérios de avaliação são focados no público brasileiro. Sem nenhuma entrevista falada.',
      analysis_version: 'v1',
      analyzed_at: new Date().toISOString()
    }
  }
];
