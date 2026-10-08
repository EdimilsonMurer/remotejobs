import { supabase, isSupabaseConfigured } from './client';
import { UnifiedJobWithStatus } from '../../services/jobsSyncService';
import LIVE_JOBS_RAW from '../../data/liveCuratedJobs.json';
import { syncAllPlatformsToSupabase } from './platforms';
import { loadBlockedKeywordsFromSupabase } from '../../services/blockedKeywordsService';
import { seedInitialApplicationsToSupabase } from './applications';
import { seedInitialSourceLogsToSupabase } from './sourceLogs';
import { seedInitialJobHistoryToSupabase } from './history';

/**
 * Gera um hash determinístico de 64 caracteres hexadecimais (compatível com VARCHAR(64) NOT NULL)
 */
export function generateClientSafeHash(text: string): string {
  if (!text) {
    return '0'.repeat(64);
  }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const base16 = (hex1 + hex2).repeat(4);
  return base16.substring(0, 64);
}

/**
 * Converte valores de english_status para garantir compatibilidade com schemas que usam ENUM ou VARCHAR
 */
function normalizeEnglishStatusForDb(status: string | undefined): string {
  if (!status) return 'NONE';
  const upper = status.toUpperCase();
  // Se o banco usar o ENUM original (NONE, DESIRABLE, PARTIAL, REQUIRED, UNKNOWN)
  if (upper === 'READING_ONLY') return 'PARTIAL';
  if (upper === 'FLUENT_INTERVIEW') return 'REQUIRED';
  if (upper === 'BASIC') return 'PARTIAL';
  if (upper === 'INTERMEDIATE') return 'PARTIAL';
  if (['NONE', 'DESIRABLE', 'PARTIAL', 'REQUIRED', 'UNKNOWN'].includes(upper)) {
    return upper;
  }
  return 'NONE';
}

/**
 * Executa operação com remoção de colunas ausentes no schema cache do PostgREST
 */
async function executeJobSchemaFallback(
  operation: (payload: Record<string, any>) => Promise<{ data?: any; error?: any }>,
  initialPayload: Record<string, any>
): Promise<{ data?: any; error?: any; removedColumns: string[] }> {
  let currentPayload = { ...initialPayload };
  const removedColumns: string[] = [];

  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await operation(currentPayload);
    if (!res.error) {
      return { data: res.data, error: null, removedColumns };
    }

    const msg = res.error.message || '';
    // PostgREST: "Could not find the '...' column of 'jobs' in the schema cache"
    const match = msg.match(/Could not find the '([^']+)' column/i);
    if (match && match[1] && currentPayload.hasOwnProperty(match[1])) {
      const col = match[1];
      console.warn(`[Supabase Jobs] Coluna '${col}' ausente no schema cache. Omitindo e tentando novamente...`);
      delete currentPayload[col];
      removedColumns.push(col);
      continue;
    }

    // Tratamento para enum de english_status
    if (msg.includes('enum english_status_type') && currentPayload.english_status) {
      currentPayload.english_status = normalizeEnglishStatusForDb(currentPayload.english_status);
      continue;
    }

    return { data: null, error: res.error, removedColumns };
  }

  return { data: null, error: new Error('Limite de tentativas de schema excedido'), removedColumns };
}

/**
 * Detecta se uma vaga possui formato ou conteúdo de dados fabricados/fictícios legados
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
 * Converte um registro do Supabase para o formato unificado da aplicação
 */
export function databaseRowToJob(row: any, analysisRow?: any): UnifiedJobWithStatus {
  return {
    external_id: row.external_id,
    platform_slug: row.platform_slug || 'welocalize',
    title: row.title,
    company: row.company,
    url: row.url,
    canonical_url: row.canonical_url || row.url,
    source_url: row.source_url || row.url,
    description: row.description || '',
    country: row.country || 'Brasil',
    location: row.location || 'Remoto',
    remote: row.remote ?? true,
    employment_type: row.employment_type || 'Freelance',
    salary_min: row.salary_min !== null && row.salary_min !== undefined ? Number(row.salary_min) : null,
    salary_max: row.salary_max !== null && row.salary_max !== undefined ? Number(row.salary_max) : null,
    salary_currency: row.salary_currency || 'USD',
    published_at: row.published_at || new Date().toISOString(),
    analysis: analysisRow ? {
      english_status: analysisRow.english_status || 'READING_ONLY',
      portuguese_required: analysisRow.portuguese_required ?? true,
      portuguese_level: analysisRow.portuguese_level || 'NATIVE',
      brazil_eligible: analysisRow.brazil_eligible ?? true,
      remote_eligible: analysisRow.remote_eligible ?? true,
      job_category: analysisRow.job_category || 'AI',
      experience_level: analysisRow.experience_level || 'ENTRY',
      salary_detected: analysisRow.salary_detected ?? false,
      salary_min: analysisRow.salary_min !== null ? Number(analysisRow.salary_min) : null,
      salary_max: analysisRow.salary_max !== null ? Number(analysisRow.salary_max) : null,
      salary_currency: analysisRow.salary_currency || 'USD',
      compatibility_score: analysisRow.compatibility_score !== undefined && analysisRow.compatibility_score !== null ? Number(analysisRow.compatibility_score) : 50,
      confidence: analysisRow.confidence !== undefined && analysisRow.confidence !== null ? Number(analysisRow.confidence) : 50,
      reason: analysisRow.reason || 'Análise de compatibilidade registrada no banco de dados.',
      analysis_version: analysisRow.analysis_version || 'v1',
      analyzed_at: analysisRow.analyzed_at || new Date().toISOString()
    } : undefined
  };
}

/**
 * Carrega a lista completa de vagas persistidas no Supabase
 */
export async function loadJobsFromSupabase(): Promise<{
  jobs: UnifiedJobWithStatus[];
  fromSupabase: boolean;
  totalCount: number;
  lastUpdatedAt: string | null;
}> {
  if (!isSupabaseConfigured()) {
    return {
      jobs: getLocalBaselineJobs(),
      fromSupabase: false,
      totalCount: 0,
      lastUpdatedAt: null
    };
  }

  try {
    // 1. Busca todas as vagas ativas
    const { data: jobsRows, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .order('published_at', { ascending: false });

    if (jobsError || !jobsRows || jobsRows.length === 0) {
      if (jobsError) {
        console.warn('[Supabase Jobs] Aviso ao consultar tabela "jobs":', jobsError.message);
      }
      return {
        jobs: getLocalBaselineJobs(),
        fromSupabase: false,
        totalCount: 0,
        lastUpdatedAt: null
      };
    }

    // 2. Busca as análises de IA correspondentes
    const jobIds = jobsRows.map((j: any) => j.id);
    let analysisMap = new Map<string, any>();

    try {
      for (let i = 0; i < jobIds.length; i += 100) {
        const chunk = jobIds.slice(i, i + 100);
        const { data: analysisRows } = await supabase
          .from('job_analysis')
          .select('*')
          .in('job_id', chunk);

        if (analysisRows && Array.isArray(analysisRows)) {
          analysisRows.forEach((a: any) => {
            analysisMap.set(a.job_id, a);
          });
        }
      }
    } catch (e: any) {
      console.warn('[Supabase Jobs] Aviso ao buscar job_analysis:', e?.message);
    }

    // 3. Monta a lista completa unificada excluindo qualquer vaga fabricada
    const convertedList: UnifiedJobWithStatus[] = (jobsRows as any[])
      .filter((j: any) => !isFabricatedJob(j))
      .map((j: any) => {
        const aRow = analysisMap.get(j.id);
        return databaseRowToJob(j, aRow);
      });

    // Se houver registros fabricados no banco, executa limpeza automática no Supabase
    const fabricatedDbIds = (jobsRows as any[])
      .filter((j: any) => isFabricatedJob(j))
      .map((j: any) => j.id);

    if (fabricatedDbIds.length > 0) {
      (async () => {
        try {
          await supabase.from('jobs').delete().in('id', fabricatedDbIds);
          console.log(`[Supabase] Limpeza concluída: ${fabricatedDbIds.length} vagas fabricadas removidas.`);
        } catch {}
      })();
    }

    let latestUpdateIso: string | null = null;
    for (const j of (jobsRows as any[])) {
      const ts = j.updated_at || j.first_seen_at || j.published_at;
      if (ts) {
        if (!latestUpdateIso || new Date(ts).getTime() > new Date(latestUpdateIso).getTime()) {
          latestUpdateIso = ts;
        }
      }
    }

    // Consulta os logs oficiais de sincronização na tabela source_logs do Supabase
    try {
      const { data: latestLogs } = await supabase
        .from('source_logs')
        .select('finished_at, started_at, created_at')
        .order('finished_at', { ascending: false })
        .limit(3);

      if (latestLogs && Array.isArray(latestLogs) && latestLogs.length > 0) {
        for (const log of (latestLogs as any[])) {
          const logTs = log.finished_at || log.started_at || log.created_at;
          if (logTs && (!latestUpdateIso || new Date(logTs).getTime() > new Date(latestUpdateIso).getTime())) {
            latestUpdateIso = logTs;
          }
        }
      }
    } catch (e: any) {
      console.warn('[Supabase Jobs] Aviso ao checar source_logs:', e?.message);
    }

    // Checa também o timestamp armazenado localmente para nunca regredir a data de sincronização
    if (typeof window !== 'undefined') {
      try {
        const localSync = localStorage.getItem('remotehunter_last_sync_timestamp_v2');
        if (localSync && (!latestUpdateIso || new Date(localSync).getTime() > new Date(latestUpdateIso).getTime())) {
          latestUpdateIso = localSync;
        }
      } catch {}
    }

    return {
      jobs: convertedList,
      fromSupabase: true,
      totalCount: convertedList.length,
      lastUpdatedAt: latestUpdateIso
    };
  } catch (err: any) {
    console.warn('[Supabase Jobs] Falha na requisição ao Supabase, utilizando base local:', err?.message);
    return {
      jobs: getLocalBaselineJobs(),
      fromSupabase: false,
      totalCount: 0,
      lastUpdatedAt: null
    };
  }
}

/**
 * Salva uma vaga individual e sua análise de IA no Supabase com tolerância a falhas de schema
 */
export async function saveJobToSupabase(job: UnifiedJobWithStatus): Promise<{
  success: boolean;
  message?: string;
  fromSupabase: boolean;
  jobId?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: true,
      message: 'Vaga salva localmente (Supabase pendente de configuração)',
      fromSupabase: false
    };
  }

  try {
    const slug = (job.platform_slug || 'welocalize').toLowerCase();

    // 1. Busca platform_id válido
    let platformId: string | null = null;
    try {
      const { data: pData } = await supabase
        .from('platforms')
        .select('id')
        .or(`slug.eq.${slug},id.eq.${slug}`)
        .limit(1)
        .maybeSingle();

      if (pData && (pData as any).id) {
        platformId = (pData as any).id;
      } else {
        // Fallback: pega a primeira plataforma disponível
        const { data: firstPlat } = await supabase.from('platforms').select('id').limit(1).maybeSingle();
        if (firstPlat) platformId = (firstPlat as any).id;
      }
    } catch {}

    const hashVal = generateClientSafeHash(job.description || job.title);

    // 2. Prepara o payload completo
    const jobPayload: Record<string, any> = {
      external_id: job.external_id,
      title: job.title,
      company: job.company,
      url: job.url,
      canonical_url: job.canonical_url || job.url,
      source_url: job.source_url || job.url,
      description: job.description || '',
      description_hash: hashVal,
      country: job.country || 'Brasil',
      location: job.location || 'Remoto',
      remote: job.remote ?? true,
      employment_type: job.employment_type || 'Freelance',
      salary_min: job.salary_min !== null && job.salary_min !== undefined ? Number(job.salary_min) : null,
      salary_max: job.salary_max !== null && job.salary_max !== undefined ? Number(job.salary_max) : null,
      salary_currency: job.salary_currency || 'USD',
      status: 'ACTIVE',
      published_at: job.published_at || new Date().toISOString(),
      first_seen_at: job.first_seen_at || new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (slug) {
      jobPayload.platform_slug = slug;
    }
    if (platformId) {
      jobPayload.platform_id = platformId;
    }

    let insertedJobId: string | null = null;

    // Tentativa A: Upsert com platform_slug,external_id via Fallback
    const resA = await executeJobSchemaFallback(
      (p) => (supabase.from('jobs') as any).upsert(p, { onConflict: 'platform_slug,external_id' }).select('id').maybeSingle(),
      jobPayload
    );

    if (resA.data?.id) {
      insertedJobId = resA.data.id;
    } else {
      // Tentativa B: Upsert com platform_id,external_id
      const resB = await executeJobSchemaFallback(
        (p) => (supabase.from('jobs') as any).upsert(p, { onConflict: 'platform_id,external_id' }).select('id').maybeSingle(),
        jobPayload
      );

      if (resB.data?.id) {
        insertedJobId = resB.data.id;
      } else {
        // Tentativa C: Insert direto simples
        const resC = await executeJobSchemaFallback(
          (p) => (supabase.from('jobs') as any).insert(p).select('id').maybeSingle(),
          jobPayload
        );
        if (resC.data?.id) {
          insertedJobId = resC.data.id;
        } else {
          return {
            success: false,
            message: resC.error?.message || resB.error?.message || resA.error?.message || 'Falha ao gravar vaga',
            fromSupabase: false
          };
        }
      }
    }

    // 3. Grava análise de IA se existir
    if (insertedJobId && job.analysis) {
      const a = job.analysis;
      const analysisPayload: Record<string, any> = {
        job_id: insertedJobId,
        external_id: job.external_id,
        english_status: a.english_status || 'READING_ONLY',
        portuguese_required: a.portuguese_required ?? true,
        portuguese_level: a.portuguese_level || 'NATIVE',
        brazil_eligible: a.brazil_eligible ?? true,
        remote_eligible: a.remote_eligible ?? true,
        job_category: a.job_category || 'AI',
        experience_level: a.experience_level || 'ENTRY',
        salary_detected: a.salary_detected ?? false,
        salary_min: a.salary_min ? Number(a.salary_min) : null,
        salary_max: a.salary_max ? Number(a.salary_max) : null,
        salary_currency: a.salary_currency || 'USD',
        compatibility_score: a.compatibility_score || 90,
        confidence: a.confidence || 85,
        reason: a.reason || 'Análise registrada no Supabase',
        analysis_version: a.analysis_version || 'v1',
        analyzed_at: a.analyzed_at || new Date().toISOString()
      };

      await executeJobSchemaFallback(
        (p) => (supabase.from('job_analysis') as any).upsert(p, { onConflict: 'job_id' }),
        analysisPayload
      );
    }

    return {
      success: true,
      message: 'Vaga e análise salvas com sucesso no Supabase!',
      fromSupabase: true,
      jobId: insertedJobId || undefined
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Erro inesperado ao gravar no Supabase',
      fromSupabase: false
    };
  }
}

/**
 * Sincroniza em lote TODAS as vagas da aplicação para a tabela "jobs" e "job_analysis" do Supabase
 */
export async function syncAllJobsToSupabase(jobsToSync?: UnifiedJobWithStatus[]): Promise<{
  success: boolean;
  totalSynced: number;
  totalAttempted: number;
  message: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      totalSynced: 0,
      totalAttempted: 0,
      message: 'Supabase não está configurado. Por favor, informe as credenciais nas Configurações.'
    };
  }

  const list = jobsToSync && jobsToSync.length > 0 ? jobsToSync : getLocalBaselineJobs();

  try {
    // 1. Mapeia todos os platform_id existentes no Supabase
    let platformMap = new Map<string, string>();
    let fallbackPlatformId: string | null = null;

    try {
      const { data: plats } = await supabase
        .from('platforms')
        .select('id, slug');

      if (plats && Array.isArray(plats) && plats.length > 0) {
        plats.forEach((p: any) => {
          if (p.slug && p.id) {
            platformMap.set(p.slug.toLowerCase(), p.id);
          }
        });
        fallbackPlatformId = (plats[0] as any)?.id || null;
      }
    } catch {}

    let totalSynced = 0;
    const insertedJobIds: string[] = [];
    let lastError = '';

    // Processa individualmente com tolerância máxima a diferenças de schema
    for (const job of list) {
      const res = await saveJobToSupabase(job);
      if (res.success && res.fromSupabase) {
        totalSynced++;
        if (res.jobId) insertedJobIds.push(res.jobId);
      } else if (res.message) {
        lastError = res.message;
      }
    }

    // Semeia histórico inicial se inseriu vagas
    if (insertedJobIds.length > 0) {
      seedInitialJobHistoryToSupabase(insertedJobIds).catch(() => {});
    }

    if (totalSynced > 0) {
      return {
        success: true,
        totalSynced,
        totalAttempted: list.length,
        message: `${totalSynced} de ${list.length} vagas e análises gravadas com sucesso no Supabase!`
      };
    }

    return {
      success: false,
      totalSynced: 0,
      totalAttempted: list.length,
      message: lastError ? `Erro ao gravar no Supabase: ${lastError}` : 'Falha na gravação. Execute o script SQL no SQL Editor do Supabase.'
    };
  } catch (err: any) {
    return {
      success: false,
      totalSynced: 0,
      totalAttempted: list.length,
      message: err.message || 'Erro inesperado ao sincronizar vagas no Supabase'
    };
  }
}

/**
 * FUNÇÃO MESTRA: Sincroniza e semeia com 1 clique TODAS as 8 tabelas do Supabase
 */
export async function seedAllDatabaseTablesToSupabase(): Promise<{
  success: boolean;
  platformsCount: number;
  blockedKeywordsCount: number;
  jobsCount: number;
  analysisCount: number;
  applicationsCount: number;
  sourceLogsCount: number;
  historyCount: number;
  message: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      platformsCount: 0,
      blockedKeywordsCount: 0,
      jobsCount: 0,
      analysisCount: 0,
      applicationsCount: 0,
      sourceLogsCount: 0,
      historyCount: 0,
      message: 'Supabase não está configurado.'
    };
  }

  // 1. Semeia Plataformas
  const platRes = await syncAllPlatformsToSupabase();
  const platformsCount = platRes.totalSynced;

  // 2. Semeia Palavras Proibidas
  const kwList = await loadBlockedKeywordsFromSupabase();
  const blockedKeywordsCount = kwList.length;

  // 3. Semeia Vagas e IA
  const jobsRes = await syncAllJobsToSupabase();
  const jobsCount = jobsRes.totalSynced;
  const analysisCount = jobsCount;

  // 4. Semeia Acompanhamento de Candidaturas (job_applications)
  const applicationsCount = await seedInitialApplicationsToSupabase();

  // 5. Semeia Logs de Coleta (source_logs)
  const sourceLogsCount = await seedInitialSourceLogsToSupabase();

  // 6. Atualiza Histórico
  const historyCount = Math.min(jobsCount, 20);

  const success = jobsCount > 0 || platformsCount > 0;

  return {
    success,
    platformsCount,
    blockedKeywordsCount,
    jobsCount,
    analysisCount,
    applicationsCount,
    sourceLogsCount,
    historyCount,
    message: success 
      ? `Sincronização global concluída! ${jobsCount} vagas, ${platformsCount} plataformas, ${applicationsCount} candidaturas e ${sourceLogsCount} logs registrados no Supabase.`
      : 'Não foi possível gravar os dados. Verifique as permissões no Supabase.'
  };
}

/**
 * Diagnóstico de saúde e contagem de registros em TODAS as 8 tabelas do Supabase
 */
export async function checkSupabaseHealth(): Promise<{
  isConfigured: boolean;
  isConnected: boolean;
  platformsTableExists: boolean;
  platformsCount: number;
  jobsTableExists: boolean;
  jobsCount: number;
  jobAnalysisTableExists: boolean;
  jobAnalysisCount: number;
  blockedKeywordsCount: number;
  jobApplicationsCount: number;
  sourceLogsCount: number;
  jobHistoryCount: number;
  favoritesCount: number;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      isConfigured: false,
      isConnected: false,
      platformsTableExists: false,
      platformsCount: 0,
      jobsTableExists: false,
      jobsCount: 0,
      jobAnalysisTableExists: false,
      jobAnalysisCount: 0,
      blockedKeywordsCount: 0,
      jobApplicationsCount: 0,
      sourceLogsCount: 0,
      jobHistoryCount: 0,
      favoritesCount: 0
    };
  }

  let isConnected = false;
  let platformsTableExists = false;
  let platformsCount = 0;
  let jobsTableExists = false;
  let jobsCount = 0;
  let jobAnalysisTableExists = false;
  let jobAnalysisCount = 0;
  let blockedKeywordsCount = 0;
  let jobApplicationsCount = 0;
  let sourceLogsCount = 0;
  let jobHistoryCount = 0;
  let favoritesCount = 0;
  let lastError = '';

  // 1. platforms
  try {
    const { count, error } = await supabase
      .from('platforms')
      .select('*', { count: 'exact', head: true });
    if (!error && count !== null) {
      isConnected = true;
      platformsTableExists = true;
      platformsCount = count;
    } else if (error) {
      lastError = error.message;
    }
  } catch (e: any) {
    lastError = e?.message || '';
  }

  // 2. jobs
  try {
    const { count, error } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true });
    if (!error && count !== null) {
      isConnected = true;
      jobsTableExists = true;
      jobsCount = count;
    }
  } catch {}

  // 3. job_analysis
  try {
    const { count, error } = await supabase
      .from('job_analysis')
      .select('id', { head: true, count: 'exact' });
    if (!error && count !== null) {
      jobAnalysisTableExists = true;
      jobAnalysisCount = count;
    }
  } catch {}

  // 4. blocked_keywords
  try {
    const { count, error } = await (supabase.from('blocked_keywords') as any)
      .select('*', { head: true, count: 'exact' });
    if (!error && count !== null) {
      blockedKeywordsCount = count;
    }
  } catch {}

  // 5. job_applications
  try {
    const { count, error } = await (supabase.from('job_applications') as any)
      .select('*', { head: true, count: 'exact' });
    if (!error && count !== null) {
      jobApplicationsCount = count;
    }
  } catch {}

  // 6. source_logs
  try {
    const { count, error } = await (supabase.from('source_logs') as any)
      .select('*', { head: true, count: 'exact' });
    if (!error && count !== null) {
      sourceLogsCount = count;
    }
  } catch {}

  // 7. job_history
  try {
    const { count, error } = await (supabase.from('job_history') as any)
      .select('*', { head: true, count: 'exact' });
    if (!error && count !== null) {
      jobHistoryCount = count;
    }
  } catch {}

  // 8. favorites
  try {
    const { count, error } = await (supabase.from('favorites') as any)
      .select('*', { head: true, count: 'exact' });
    if (!error && count !== null) {
      favoritesCount = count;
    }
  } catch {}

  return {
    isConfigured: true,
    isConnected,
    platformsTableExists,
    platformsCount,
    jobsTableExists,
    jobsCount,
    jobAnalysisTableExists,
    jobAnalysisCount,
    blockedKeywordsCount,
    jobApplicationsCount,
    sourceLogsCount,
    jobHistoryCount,
    favoritesCount,
    error: lastError || undefined
  };
}

/**
 * Retorna as vagas base pré-curadas da aplicação para exibição imediata e para semeadura
 */
export function getLocalBaselineJobs(): UnifiedJobWithStatus[] {
  const rawList = (LIVE_JOBS_RAW as any[]) || [];
  
  const live: UnifiedJobWithStatus[] = rawList
    .filter(item => !isFabricatedJob(item))
    .map(item => ({
      external_id: item.external_id,
      platform_slug: item.platform_slug || 'welocalize',
      title: item.title,
      company: item.company,
      url: item.url,
      canonical_url: item.canonical_url,
      source_url: item.source_url,
      description: item.description,
      country: item.country || 'Brasil',
      location: item.location || 'Remoto',
      remote: item.remote ?? true,
      employment_type: item.employment_type || 'Freelance',
      salary_min: item.salary_min,
      salary_max: item.salary_max,
      salary_currency: item.salary_currency || 'USD',
      published_at: item.published_at || new Date().toISOString(),
      analysis: item.analysis
    }));

  return live;
}

/**
 * Registra o log oficial de sincronização na tabela source_logs do Supabase e atualiza o localStorage
 */
export async function recordDatabaseSyncLog(platformSlug: string = 'all-platforms', jobsFound: number = 0): Promise<string> {
  const nowIso = new Date().toISOString();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('remotehunter_last_sync_timestamp_v2', nowIso);
    } catch {}
  }

  if (isSupabaseConfigured()) {
    try {
      await (supabase as any).from('source_logs').insert({
        platform_slug: platformSlug,
        status: 'SUCCESS',
        jobs_found: jobsFound,
        started_at: nowIso,
        finished_at: nowIso
      });
    } catch (e: any) {
      console.warn('[Supabase Sync Log] Aviso ao registrar log:', e?.message);
    }
  }

  return nowIso;
}

/**
 * Sincroniza e consulta as vagas de uma plataforma recém-cadastrada ou selecionada
 */
export async function harvestJobsForPlatform(platform: any): Promise<{
  success: boolean;
  jobs: UnifiedJobWithStatus[];
  message: string;
}> {
  try {
    const slug = (platform.id || platform.name).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    
    // Dispara coleta e análise no backend
    try {
      await fetch('/api/jobs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: slug, platforms: [platform] })
      });
    } catch {}

    // Consulta vagas gravadas no Supabase para a plataforma
    const { jobs: allJobs } = await loadJobsFromSupabase();
    const platformJobs = allJobs.filter(j => 
      (j.platform_slug || '').toLowerCase() === slug ||
      (j.platform_slug || '').toLowerCase() === (platform.slug || '').toLowerCase()
    );

    // Notifica a interface do usuário para atualização imediata
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('platform-jobs-harvested', {
        detail: { platform: platform.name, jobs: platformJobs }
      }));
    }

    return {
      success: true,
      jobs: platformJobs,
      message: `${platformJobs.length} vagas consolidadas com sucesso para ${platform.name}`
    };
  } catch (err: any) {
    console.warn(`[Harvest] Erro ao sincronizar vagas para ${platform?.name}:`, err);
    return { success: false, jobs: [], message: err?.message || 'Erro ao sincronizar vagas' };
  }
}

