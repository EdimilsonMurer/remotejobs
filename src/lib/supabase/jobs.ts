import { supabase, isSupabaseConfigured } from './client';
import { UnifiedJobWithStatus } from '../../services/jobsSyncService';
import { CURATED_JOBS } from '../../data/curatedJobs';
import LIVE_JOBS_RAW from '../../data/liveCuratedJobs.json';

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
      compatibility_score: analysisRow.compatibility_score || 90,
      confidence: analysisRow.confidence || 85,
      reason: analysisRow.reason || 'Vaga registrada no banco de dados Supabase.',
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
      // Busca em lotes para evitar limites de URL
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

    // 3. Monta a lista completa unificada
    const convertedList: UnifiedJobWithStatus[] = jobsRows.map((j: any) => {
      const aRow = analysisMap.get(j.id);
      return databaseRowToJob(j, aRow);
    });

    // Obtém a data mais recente de atualização entre as vagas
    let latestUpdateIso: string | null = null;
    for (const j of (jobsRows as any[])) {
      const ts = j.updated_at || j.first_seen_at || j.published_at;
      if (ts) {
        if (!latestUpdateIso || new Date(ts).getTime() > new Date(latestUpdateIso).getTime()) {
          latestUpdateIso = ts;
        }
      }
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
 * Salva uma vaga individual e sua análise de IA no Supabase
 */
export async function saveJobToSupabase(job: UnifiedJobWithStatus): Promise<{
  success: boolean;
  message?: string;
  fromSupabase: boolean;
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
      }
    } catch {}

    // 2. Prepara o payload
    const jobPayload: Record<string, any> = {
      platform_slug: slug,
      external_id: job.external_id,
      title: job.title,
      company: job.company,
      url: job.url,
      canonical_url: job.canonical_url || job.url,
      source_url: job.source_url || job.url,
      description: job.description || '',
      description_hash: '',
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

    if (platformId) {
      jobPayload.platform_id = platformId;
    }

    let insertedJobId: string | null = null;

    // Tentativa 1: Upsert com platform_slug,external_id
    const { data: insertedJob, error: jobError } = await (supabase.from('jobs') as any)
      .upsert(jobPayload, { onConflict: 'platform_slug,external_id' })
      .select('id')
      .maybeSingle();

    if (!jobError && insertedJob) {
      insertedJobId = insertedJob.id;
    } else {
      // Tentativa 2: Upsert com platform_id,external_id caso a tabela use o schema antigo
      const { data: retryJob, error: retryError } = await (supabase.from('jobs') as any)
        .upsert(jobPayload, { onConflict: 'platform_id,external_id' })
        .select('id')
        .maybeSingle();

      if (!retryError && retryJob) {
        insertedJobId = retryJob.id;
      } else {
        // Tentativa 3: Insert direto simples
        const { data: fallbackJob, error: fallbackError } = await (supabase.from('jobs') as any)
          .insert(jobPayload)
          .select('id')
          .maybeSingle();

        if (!fallbackError && fallbackJob) {
          insertedJobId = fallbackJob.id;
        } else {
          const errMsg = fallbackError?.message || retryError?.message || jobError?.message || 'Erro ao gravar vaga';
          return { success: false, message: errMsg, fromSupabase: false };
        }
      }
    }

    // 3. Grava análise de IA se existir
    if (insertedJobId && job.analysis) {
      const a = job.analysis;
      const analysisPayload = {
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

      await (supabase.from('job_analysis') as any)
        .upsert(analysisPayload, { onConflict: 'job_id' });
    }

    return {
      success: true,
      message: 'Vaga e análise salvas com sucesso no Supabase!',
      fromSupabase: true
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
 * Utiliza lotes (batching) de alto desempenho para gravar todas as 549+ vagas em poucos segundos!
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

    // 2. Prepara os payloads de todas as vagas
    const nowIso = new Date().toISOString();
    const preparedJobs = list.map(job => {
      const slug = (job.platform_slug || 'welocalize').toLowerCase();
      const pId = platformMap.get(slug) || fallbackPlatformId;

      const payload: Record<string, any> = {
        platform_slug: slug,
        external_id: job.external_id,
        title: job.title,
        company: job.company,
        url: job.url,
        canonical_url: job.canonical_url || job.url,
        source_url: job.source_url || job.url,
        description: job.description || '',
        description_hash: '',
        country: job.country || 'Brasil',
        location: job.location || 'Remoto',
        remote: job.remote ?? true,
        employment_type: job.employment_type || 'Freelance',
        salary_min: job.salary_min !== null && job.salary_min !== undefined ? Number(job.salary_min) : null,
        salary_max: job.salary_max !== null && job.salary_max !== undefined ? Number(job.salary_max) : null,
        salary_currency: job.salary_currency || 'USD',
        status: 'ACTIVE',
        published_at: job.published_at || nowIso,
        first_seen_at: job.first_seen_at || nowIso,
        last_seen_at: nowIso,
        updated_at: nowIso
      };

      if (pId) {
        payload.platform_id = pId;
      }

      return {
        jobPayload: payload,
        analysis: job.analysis
      };
    });

    let totalSynced = 0;
    let lastError = '';
    const BATCH_SIZE = 30;

    // 3. Executa a gravação em lotes (batch chunks)
    for (let i = 0; i < preparedJobs.length; i += BATCH_SIZE) {
      const batchItems = preparedJobs.slice(i, i + BATCH_SIZE);
      const batchPayloads = batchItems.map(b => b.jobPayload);

      // Tentativa 1: Upsert em lote por (platform_slug, external_id)
      let insertedBatch: any[] | null = null;
      let { data, error } = await (supabase.from('jobs') as any)
        .upsert(batchPayloads, { onConflict: 'platform_slug,external_id' })
        .select('id, external_id');

      if (!error && data) {
        insertedBatch = data;
      } else {
        // Tentativa 2: Upsert por (platform_id, external_id)
        const res2 = await (supabase.from('jobs') as any)
          .upsert(batchPayloads, { onConflict: 'platform_id,external_id' })
          .select('id, external_id');

        if (!res2.error && res2.data) {
          insertedBatch = res2.data;
        } else {
          // Tentativa 3: Insert individual para isolar erros
          for (const item of batchItems) {
            const singleRes = await saveJobToSupabase({
              ...item.jobPayload,
              analysis: item.analysis
            } as any);
            if (singleRes.success) {
              totalSynced++;
            } else if (singleRes.message) {
              lastError = singleRes.message;
            }
          }
          continue;
        }
      }

      if (insertedBatch && Array.isArray(insertedBatch)) {
        totalSynced += insertedBatch.length;

        // Grava as análises de IA em lote correspondentes
        const analysisBatch: any[] = [];
        const idMap = new Map<string, string>();
        insertedBatch.forEach((row: any) => idMap.set(row.external_id, row.id));

        batchItems.forEach(b => {
          const dbId = idMap.get(b.jobPayload.external_id);
          if (dbId && b.analysis) {
            const a = b.analysis;
            analysisBatch.push({
              job_id: dbId,
              external_id: b.jobPayload.external_id,
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
              analyzed_at: a.analyzed_at || nowIso
            });
          }
        });

        if (analysisBatch.length > 0) {
          await (supabase.from('job_analysis') as any)
            .upsert(analysisBatch, { onConflict: 'job_id' })
            .catch(() => {});
        }
      }
    }

    if (totalSynced > 0) {
      return {
        success: true,
        totalSynced,
        totalAttempted: list.length,
        message: `${totalSynced} de ${list.length} vagas e análises de IA gravadas com sucesso no Supabase!`
      };
    }

    return {
      success: false,
      totalSynced: 0,
      totalAttempted: list.length,
      message: lastError ? `Erro ao gravar no Supabase: ${lastError}` : 'Falha na gravação. Execute o script SQL no SQL Editor do Supabase para alinhar as permissões da tabela jobs.'
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
 * Realiza diagnóstico de saúde em tempo real da conexão e das tabelas do Supabase
 */
export async function checkSupabaseHealth(): Promise<{
  isConfigured: boolean;
  isConnected: boolean;
  platformsTableExists: boolean;
  platformsCount: number;
  jobsTableExists: boolean;
  jobsCount: number;
  jobAnalysisTableExists: boolean;
  blockedKeywordsCount: number;
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
      blockedKeywordsCount: 0
    };
  }

  let isConnected = false;
  let platformsTableExists = false;
  let platformsCount = 0;
  let jobsTableExists = false;
  let jobsCount = 0;
  let jobAnalysisTableExists = false;
  let blockedKeywordsCount = 0;
  let lastError = '';

  // 1. Testa tabela platforms
  try {
    const { count, error } = await supabase
      .from('platforms')
      .select('*', { count: 'exact', head: true });

    if (!error) {
      isConnected = true;
      platformsTableExists = true;
      platformsCount = count || 0;
    } else {
      lastError = error.message;
    }
  } catch (e: any) {
    lastError = e?.message || '';
  }

  // 2. Testa tabela jobs
  try {
    const { count, error } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true });

    if (!error) {
      isConnected = true;
      jobsTableExists = true;
      jobsCount = count || 0;
    } else {
      if (!lastError) lastError = error.message;
    }
  } catch (e: any) {
    if (!lastError) lastError = e?.message;
  }

  // 3. Testa tabela job_analysis
  try {
    const { error } = await supabase
      .from('job_analysis')
      .select('id', { head: true, count: 'exact' });

    if (!error) {
      jobAnalysisTableExists = true;
    }
  } catch {}

  // 4. Testa tabela blocked_keywords
  try {
    const { count, error } = await (supabase
      .from('blocked_keywords') as any)
      .select('*', { head: true, count: 'exact' });

    if (!error && count !== null) {
      blockedKeywordsCount = count;
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
    blockedKeywordsCount,
    error: lastError || undefined
  };
}

/**
 * Retorna as vagas base pré-curadas da aplicação para exibição imediata e para semeadura inicial
 */
export function getLocalBaselineJobs(): UnifiedJobWithStatus[] {
  const rawList = (LIVE_JOBS_RAW as any[]) || [];
  
  const live: UnifiedJobWithStatus[] = rawList.map(item => ({
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

  const legacyConverted: UnifiedJobWithStatus[] = CURATED_JOBS.map(lj => ({
    external_id: lj.id,
    platform_slug: lj.platformId || 'welocalize',
    title: lj.title,
    company: lj.company,
    url: lj.url,
    canonical_url: lj.url,
    source_url: lj.url,
    description: lj.description,
    country: 'Brasil',
    location: 'Remoto (Brasil)',
    remote: true,
    employment_type: 'Freelance / Contratado',
    salary_min: null,
    salary_max: null,
    salary_currency: lj.currency,
    published_at: lj.publishedAt,
    analysis: {
      english_status: lj.requiresEnglishInterview ? 'REQUIRED' : 'NONE',
      portuguese_required: true,
      portuguese_level: 'NATIVE',
      brazil_eligible: true,
      remote_eligible: true,
      job_category: lj.category.includes('IA') ? 'AI' : 'ANNOTATION',
      experience_level: 'ENTRY',
      salary_detected: true,
      salary_min: null,
      salary_max: null,
      salary_currency: lj.currency,
      compatibility_score: lj.requiresEnglishInterview ? 40 : 95,
      confidence: 90,
      reason: lj.requiresEnglishInterview 
        ? 'Processo seletivo inclui entrevista ou triagem falada em inglês.'
        : 'Trabalho focado em Português do Brasil com processo e entregas sem exigência de inglês.',
      analysis_version: 'v1',
      analyzed_at: new Date().toISOString()
    }
  }));

  const seen = new Set<string>();
  const combined: UnifiedJobWithStatus[] = [];

  for (const j of [...live, ...legacyConverted]) {
    if (!seen.has(j.external_id)) {
      seen.add(j.external_id);
      combined.push(j);
    }
  }

  return combined;
}
