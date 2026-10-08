import { NormalizedJob } from '../connectors/base/types';
import { JobAnalysis } from '../types/job';

export interface UnifiedJobWithStatus extends NormalizedJob {
  analysis?: JobAnalysis;
  is_new?: boolean;
  first_seen_at?: string;
  is_seen?: boolean;
  is_hidden?: boolean;
}

const STORAGE_KEY_KNOWN_IDS = 'remotehunter_known_job_ids_v2';
const STORAGE_KEY_NEW_IDS = 'remotehunter_new_job_ids_v2';
const STORAGE_KEY_SEEN_IDS = 'remotehunter_seen_job_ids_v2';
const STORAGE_KEY_HIDDEN_IDS = 'remotehunter_hidden_job_ids_v2';
const STORAGE_KEY_LAST_SYNC = 'remotehunter_last_sync_timestamp_v2';

export interface SyncState {
  knownIds: Set<string>;
  newIds: Set<string>;
  seenIds: Set<string>;
  hiddenIds: Set<string>;
  lastSyncAt: string | null;
}

/**
 * Formata data e hora da última sincronização no padrão brasileiro
 * Exemplo: 06/10/2026 às 10:35
 */
export function formatSyncDateTime(isoDate?: string | null): string {
  if (!isoDate) {
    const now = new Date();
    const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${date} às ${time}`;
  }
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) {
      const now = new Date();
      const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `${date} às ${time}`;
    }
    const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${date} às ${time}`;
  } catch {
    const now = new Date();
    const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${date} às ${time}`;
  }
}

/**
 * Lê o estado armazenado localmente
 */
export function getStoredSyncState(): SyncState {
  try {
    const knownRaw = localStorage.getItem(STORAGE_KEY_KNOWN_IDS);
    const newRaw = localStorage.getItem(STORAGE_KEY_NEW_IDS);
    const seenRaw = localStorage.getItem(STORAGE_KEY_SEEN_IDS);
    const hiddenRaw = localStorage.getItem(STORAGE_KEY_HIDDEN_IDS);
    const lastSync = localStorage.getItem(STORAGE_KEY_LAST_SYNC);

    return {
      knownIds: new Set(knownRaw ? JSON.parse(knownRaw) : []),
      newIds: new Set(newRaw ? JSON.parse(newRaw) : []),
      seenIds: new Set(seenRaw ? JSON.parse(seenRaw) : []),
      hiddenIds: new Set(hiddenRaw ? JSON.parse(hiddenRaw) : []),
      lastSyncAt: lastSync || null
    };
  } catch (e) {
    console.error('[JobsSyncService] Erro ao carregar estado:', e);
    return {
      knownIds: new Set(),
      newIds: new Set(),
      seenIds: new Set(),
      hiddenIds: new Set(),
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
    localStorage.setItem(STORAGE_KEY_HIDDEN_IDS, JSON.stringify(Array.from(state.hiddenIds)));
    if (state.lastSyncAt) {
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, state.lastSyncAt);
    }
  } catch (e) {
    console.error('[JobsSyncService] Erro ao salvar estado:', e);
  }
}

/**
 * Detecta e filtra qualquer vaga fictícia/fabricada remanescente
 */
export function isFabricatedJob(job: { external_id?: string; title?: string; description?: string }): boolean {
  if (!job) return false;
  const id = String(job.external_id || '');
  const desc = String(job.description || '');
  if (/^(welo|outlier|turing|app|align|one|click|data)-\d+$/i.test(id)) return true;
  if (/^mercor-(ai-evaluator|prompt-specialist|code-reviewer|cultural-alignment|math-reasoning|content-safety)/i.test(id)) return true;
  if (/-dynamic-[12]$/i.test(id)) return true;
  if (desc.includes('Sem exigência de entrevista oral em inglês. Pagamento em')) return true;
  if (desc.includes('Processo 100% online sem entrevistas faladas')) return true;
  return false;
}

/**
 * Aplica os marcadores is_new, is_seen e is_hidden à lista de vagas com base no estado salvo
 */
export function applyNewJobFlags(jobs: UnifiedJobWithStatus[]): UnifiedJobWithStatus[] {
  let state = getStoredSyncState();
  const cleanJobs = jobs.filter(j => !isFabricatedJob(j));

  // Se for a primeira inicialização no navegador, define o baseline com as vagas existentes
  if (state.knownIds.size === 0 && cleanJobs.length > 0) {
    const allIds = new Set(cleanJobs.map(j => j.external_id));
    
    state = {
      knownIds: allIds,
      newIds: new Set(),
      seenIds: new Set(),
      hiddenIds: new Set(),
      lastSyncAt: state.lastSyncAt || new Date().toISOString()
    };
    saveSyncState(state);
  }

  return cleanJobs.map(job => {
    const isNew = state.newIds.has(job.external_id) && !state.seenIds.has(job.external_id);
    const isSeen = state.seenIds.has(job.external_id);
    const isHidden = state.hiddenIds.has(job.external_id);

    return {
      ...job,
      is_new: isNew,
      is_seen: isSeen,
      is_hidden: isHidden,
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

  const cleanExisting = existingJobs.filter(j => !isFabricatedJob(j));
  const cleanIncoming = freshIncomingJobs.filter(j => !isFabricatedJob(j));

  // Se não havia estado anterior, usa a lista atual como base
  const previousKnownIds = state.knownIds.size > 0 
    ? state.knownIds 
    : new Set(cleanExisting.map(j => j.external_id));

  const newlyDiscoveredIds: string[] = [];
  const updatedKnownIds = new Set(previousKnownIds);

  // Combina e identifica novidades
  const mergedMap = new Map<string, UnifiedJobWithStatus>();

  // Primeiro adiciona as existentes
  for (const job of cleanExisting) {
    mergedMap.set(job.external_id, { 
      ...job,
      is_hidden: state.hiddenIds.has(job.external_id)
    });
  }

  // Agora compara e insere as recebidas
  for (const fresh of cleanIncoming) {
    const isBrandNew = !previousKnownIds.has(fresh.external_id);

    if (isBrandNew) {
      newlyDiscoveredIds.push(fresh.external_id);
      updatedKnownIds.add(fresh.external_id);
      state.newIds.add(fresh.external_id);
      // Remove de visto caso estivesse por algum motivo
      state.seenIds.delete(fresh.external_id);
    }

    const isCurrentNew = state.newIds.has(fresh.external_id) && !state.seenIds.has(fresh.external_id);
    const isHidden = state.hiddenIds.has(fresh.external_id);

    mergedMap.set(fresh.external_id, {
      ...fresh,
      is_new: isCurrentNew,
      is_seen: state.seenIds.has(fresh.external_id),
      is_hidden: isHidden,
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
 * Oculta uma vaga para não aparecer mais na listagem principal do app,
 * mas preserva seus dados no banco e no controle de sincronização.
 */
export function hideJob(jobId: string): void {
  const state = getStoredSyncState();
  state.hiddenIds.add(jobId);
  saveSyncState(state);
}

/**
 * Restaura (desoculta) uma vaga para voltar a aparecer na listagem principal.
 */
export function unhideJob(jobId: string): void {
  const state = getStoredSyncState();
  state.hiddenIds.delete(jobId);
  saveSyncState(state);
}

/**
 * Restaura todas as vagas ocultadas.
 */
export function unhideAllJobs(): void {
  const state = getStoredSyncState();
  state.hiddenIds.clear();
  saveSyncState(state);
}

/**
 * Retorna o conjunto de IDs ocultados.
 */
export function getHiddenJobIds(): Set<string> {
  const state = getStoredSyncState();
  return state.hiddenIds;
}
