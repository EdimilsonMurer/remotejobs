import { ConnectorRegistry } from '../connectors/registry';
import { DeduplicationEngine } from '../pipeline/deduplicator';
import { runPreFilter } from '../pipeline/pre-filter';
import { GeminiClassifier } from '../pipeline/gemini-classifier';
import { getSupabaseServerClient } from '../lib/supabase/server';
import * as fs from 'fs';
import * as path from 'path';

export interface SourceLogRecord {
  id: string;
  platform_slug: string;
  platform_name: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  jobs_found: number;
  jobs_new: number;
  jobs_updated: number;
  jobs_discarded: number;
  jobs_analyzed: number;
  execution_time_ms: number;
  error_message: string | null;
  started_at: string;
  finished_at: string;
}

export interface PipelineTelemetry {
  last_run_at: string | null;
  total_runs: number;
  active_jobs_count: number;
  high_compatibility_count: number;
  logs: SourceLogRecord[];
}

const TELEMETRY_FILE = path.resolve(process.cwd(), 'src/data/pipelineTelemetry.json');

export class PipelineWorker {
  private deduplicator: DeduplicationEngine;
  private classifier: GeminiClassifier;
  private isRunning: boolean = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private intervalHours: number = 6;

  constructor(intervalHours = 6) {
    this.intervalHours = intervalHours;
    this.deduplicator = new DeduplicationEngine();
    this.classifier = new GeminiClassifier();
  }

  /**
   * Obtém os registros de telemetria acumulados
   */
  getTelemetry(): PipelineTelemetry {
    try {
      if (fs.existsSync(TELEMETRY_FILE)) {
        const raw = fs.readFileSync(TELEMETRY_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[Worker] Falha ao ler telemetria:', err);
    }

    return {
      last_run_at: null,
      total_runs: 0,
      active_jobs_count: 0,
      high_compatibility_count: 0,
      logs: []
    };
  }

  /**
   * Salva telemetria em disco
   */
  private saveTelemetry(telemetry: PipelineTelemetry) {
    try {
      const dir = path.dirname(TELEMETRY_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(telemetry, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[Worker] Falha ao salvar telemetria:', err);
    }
  }

  /**
   * Executa um ciclo completo de ingestão e telemetria
   */
  async runCycle(): Promise<SourceLogRecord[]> {
    if (this.isRunning) {
      console.warn('[Worker] Ciclo de ingestão já está em andamento. Ignorando requisição duplicada.');
      return [];
    }

    this.isRunning = true;
    console.log(`\n================================================================`);
    console.log(`[Worker] INICIANDO CICLO DE INGESTÃO AUTOMATIZADA`);
    console.log(`Data/Hora: ${new Date().toISOString()}`);
    console.log(`================================================================\n`);

    const registry = ConnectorRegistry.getInstance();
    const connectors = registry.getAllConnectors();
    const cycleLogs: SourceLogRecord[] = [];

    let supabaseClient: any = null;
    try {
      supabaseClient = getSupabaseServerClient();
    } catch {
      // Offline/Local cache mode
    }

    // Carrega vagas existentes em cache para atualização incremental
    const liveJobsFile = path.resolve(process.cwd(), 'src/data/liveCuratedJobs.json');
    let cachedJobs: any[] = [];
    if (fs.existsSync(liveJobsFile)) {
      try {
        cachedJobs = JSON.parse(fs.readFileSync(liveJobsFile, 'utf-8'));
      } catch {}
    }

    // Carrega snapshot existente no DeduplicationEngine (do Supabase ou do cache)
    const existingSnapshots: any[] = [];
    if (supabaseClient) {
      try {
        const { data: dbJobs } = await supabaseClient
          .from('jobs')
          .select('id, platform_slug, external_id, canonical_url, url, description_hash, company, title, location');
        if (dbJobs && Array.isArray(dbJobs)) {
          for (const row of dbJobs) {
            existingSnapshots.push({
              id: row.id,
              platform_slug: row.platform_slug,
              external_id: row.external_id,
              normalized_url: row.canonical_url || row.url || '',
              description_hash: row.description_hash || '',
              title_company_location_key: DeduplicationEngine.generateTitleKey(row.company, row.title, row.location)
            });
          }
        }
      } catch (err: any) {
        console.warn('[Worker] Erro ao carregar vagas existentes do Supabase:', err?.message);
      }
    }

    // Complementa com o cache local
    for (const c of cachedJobs) {
      if (!existingSnapshots.some(s => s.platform_slug === c.platform_slug && s.external_id === c.external_id)) {
        existingSnapshots.push({
          id: c.external_id,
          platform_slug: c.platform_slug,
          external_id: c.external_id,
          normalized_url: c.canonical_url || c.url || '',
          description_hash: c.description_hash || '',
          title_company_location_key: DeduplicationEngine.generateTitleKey(c.company, c.title, c.location)
        });
      }
    }

    this.deduplicator.loadExistingJobs(existingSnapshots);
    console.log(`[Worker] Deduplicador inicializado com ${existingSnapshots.length} registros existentes.`);

    const seenIdsInThisCycle = new Set<string>();

    for (const connector of connectors) {
      const startTime = Date.now();
      const startedAt = new Date().toISOString();
      let status: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'SUCCESS';
      let jobsFound = 0;
      let jobsNew = 0;
      let jobsUpdated = 0;
      let jobsDiscarded = 0;
      let jobsAnalyzed = 0;
      let errorMessage: string | null = null;

      try {
        console.log(`[Worker] Coletando: ${connector.name} (${connector.slug})...`);
        const rawJobs = await connector.collect();
        jobsFound = rawJobs.length;

        for (const job of rawJobs) {
          const decision = this.deduplicator.evaluate(job);

          if (decision.action === 'UPDATE_LAST_SEEN') {
            seenIdsInThisCycle.add(job.external_id);
            jobsUpdated++;
            // Atualiza last_seen no cache
            const existing = cachedJobs.find(c => c.external_id === job.external_id);
            if (existing) {
              existing.last_seen_at = new Date().toISOString();
              existing.status = 'ACTIVE';
            }
            if (supabaseClient && decision.matched_job_id) {
              await supabaseClient
                .from('jobs')
                .update({ last_seen_at: new Date().toISOString(), status: 'ACTIVE' })
                .eq('id', decision.matched_job_id)
                .catch(() => {});
            }
            continue;
          }

          if (decision.action === 'DUPLICATE_CROSS_SOURCE') {
            jobsDiscarded++;
            continue;
          }

          const preFilter = runPreFilter(job);
          if (preFilter.priority === 'DISCARD') {
            jobsDiscarded++;
            continue;
          }

          jobsNew++;

          // Analisa a vaga sem teto arbitrário: se couber no Gemini classifica por IA, caso contrário fallback heurístico calibrado
          let analysis;
          try {
            if (preFilter.shouldSendToGemini) {
              analysis = await this.classifier.classifyJob(job);
            } else {
              analysis = this.classifier.classifyJobHeuristic(job);
            }
          } catch (classErr: any) {
            console.warn(`   [Worker] Fallback para heurística em ${job.title}: ${classErr.message}`);
            analysis = this.classifier.classifyJobHeuristic(job);
          }

          jobsAnalyzed++;
          seenIdsInThisCycle.add(job.external_id);

          const jobWithAnalysis = {
            ...job,
            analysis,
            status: 'ACTIVE',
            last_seen_at: new Date().toISOString()
          };

          // Atualiza cache em memória
          const idx = cachedJobs.findIndex(c => c.external_id === job.external_id);
          if (idx >= 0) {
            cachedJobs[idx] = jobWithAnalysis;
          } else {
            cachedJobs.unshift(jobWithAnalysis);
          }

          // Persiste no Supabase caso configurado
          if (supabaseClient) {
            try {
              const { data: pData } = await supabaseClient
                .from('platforms')
                .select('id')
                .eq('slug', connector.slug)
                .maybeSingle();

              const platformId = pData ? pData.id : null;
              const jobPayload: Record<string, any> = {
                platform_slug: connector.slug,
                external_id: job.external_id,
                title: job.title,
                company: job.company,
                url: job.url,
                canonical_url: job.canonical_url || job.url,
                source_url: job.source_url || job.url,
                description: job.description || '',
                country: job.country || 'Brasil',
                location: job.location || 'Remoto',
                remote: job.remote ?? true,
                employment_type: job.employment_type || 'Freelance',
                salary_min: job.salary_min || null,
                salary_max: job.salary_max || null,
                salary_currency: job.salary_currency || 'USD',
                status: 'ACTIVE',
                last_seen_at: new Date().toISOString()
              };
              if (platformId) jobPayload.platform_id = platformId;

              const { data: insJob } = await supabaseClient
                .from('jobs')
                .upsert(jobPayload, { onConflict: 'platform_slug,external_id' })
                .select('id')
                .maybeSingle();

              if (insJob?.id) {
                let engStatus = (analysis.english_status as string) || 'NONE';
                if (engStatus === 'READING_ONLY') engStatus = 'PARTIAL';

                await supabaseClient.from('job_analysis').upsert({
                  job_id: insJob.id,
                  external_id: job.external_id,
                  english_status: engStatus,
                  portuguese_required: analysis.portuguese_required,
                  portuguese_level: analysis.portuguese_level,
                  brazil_eligible: analysis.brazil_eligible,
                  remote_eligible: analysis.remote_eligible,
                  job_category: analysis.job_category,
                  experience_level: analysis.experience_level,
                  salary_detected: analysis.salary_detected,
                  salary_min: analysis.salary_min,
                  salary_max: analysis.salary_max,
                  salary_currency: analysis.salary_currency,
                  compatibility_score: analysis.compatibility_score,
                  confidence: analysis.confidence,
                  reason: analysis.reason,
                  analysis_version: analysis.analysis_version || 'v2-heuristic',
                  analyzed_at: new Date().toISOString()
                }, { onConflict: 'job_id' });
              }
            } catch (dbErr: any) {
              console.warn(`[Worker] Erro ao persistir ${job.title} no Supabase:`, dbErr.message);
            }
          }
        }
      } catch (err: any) {
        status = 'FAILED';
        errorMessage = err.message || 'Erro desconhecido na coleta';
        console.error(`[Worker] Falha em ${connector.slug}:`, errorMessage);
      }

      const executionTimeMs = Date.now() - startTime;
      const finishedAt = new Date().toISOString();

      const logRecord: SourceLogRecord = {
        id: `log-${Date.now()}-${connector.slug}`,
        platform_slug: connector.slug,
        platform_name: connector.name,
        status,
        jobs_found: jobsFound,
        jobs_new: jobsNew,
        jobs_updated: jobsUpdated,
        jobs_discarded: jobsDiscarded,
        jobs_analyzed: jobsAnalyzed,
        execution_time_ms: executionTimeMs,
        error_message: errorMessage,
        started_at: startedAt,
        finished_at: finishedAt
      };

      cycleLogs.push(logRecord);

      // Salva no Supabase se disponível
      if (supabaseClient) {
        try {
          const { data: pData } = await supabaseClient
            .from('platforms')
            .select('id')
            .eq('slug', connector.slug)
            .single();

          if (pData) {
            await supabaseClient.from('source_logs').insert({
              platform_id: pData.id,
              status,
              jobs_found: jobsFound,
              jobs_new: jobsNew,
              jobs_updated: jobsUpdated,
              error_message: errorMessage,
              execution_time_ms: executionTimeMs,
              started_at: startedAt,
              finished_at: finishedAt
            });
          }
        } catch (dbErr: any) {
          console.warn(`[Worker] Erro ao registrar source_logs no Supabase:`, dbErr.message);
        }
      }
    }

    // Regra da Seção 7: Se vaga deixou de ser vista, marca CLOSED
    for (const cached of cachedJobs) {
      if (!seenIdsInThisCycle.has(cached.external_id)) {
        cached.missed_cycles = (cached.missed_cycles || 0) + 1;
        if (cached.missed_cycles >= 3) {
          cached.status = 'CLOSED';
        }
      } else {
        cached.missed_cycles = 0;
        cached.status = 'ACTIVE';
      }
    }

    // Salva o cache de vagas atualizado
    try {
      fs.writeFileSync(liveJobsFile, JSON.stringify(cachedJobs, null, 2), 'utf-8');
      console.log(`[Worker] Snapshot atualizado com ${cachedJobs.length} vagas.`);
    } catch (err) {
      console.warn(`[Worker] Erro ao gravar snapshot:`, err);
    }

    // Atualiza histórico de telemetria
    const currentTelemetry = this.getTelemetry();
    const updatedTelemetry: PipelineTelemetry = {
      last_run_at: new Date().toISOString(),
      total_runs: currentTelemetry.total_runs + 1,
      active_jobs_count: cachedJobs.filter(j => j.status !== 'CLOSED').length,
      high_compatibility_count: cachedJobs.filter(j => (j.analysis?.compatibility_score || 0) >= 80).length,
      logs: [...cycleLogs, ...currentTelemetry.logs].slice(0, 50) // Guarda os últimos 50 logs
    };

    this.saveTelemetry(updatedTelemetry);
    this.isRunning = false;

    console.log(`\n================================================================`);
    console.log(`[Worker] CICLO FINALIZADO COM SUCESSO!`);
    console.log(`================================================================\n`);

    return cycleLogs;
  }

  /**
   * Inicia o agendamento contínuo em background (cron-like interval)
   */
  startScheduler() {
    console.log(`[Worker] Agendador iniciado: executando a cada ${this.intervalHours} horas.`);
    
    // Executa a primeira rodada imediatamente
    this.runCycle();

    const intervalMs = this.intervalHours * 60 * 60 * 1000;
    this.intervalTimer = setInterval(() => {
      this.runCycle();
    }, intervalMs);
  }

  /**
   * Encerra o agendador
   */
  stopScheduler() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      console.log('[Worker] Agendador finalizado.');
    }
  }
}

// Suporte para execução direta via CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const isOnce = process.argv.includes('--once');
  const worker = new PipelineWorker(6);

  if (isOnce) {
    worker.runCycle().then(() => process.exit(0));
  } else {
    worker.startScheduler();

    process.on('SIGINT', () => {
      worker.stopScheduler();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      worker.stopScheduler();
      process.exit(0);
    });
  }
}
