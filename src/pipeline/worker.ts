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
          seenIdsInThisCycle.add(job.external_id);
          const decision = this.deduplicator.evaluate(job);

          if (decision.action === 'UPDATE_LAST_SEEN') {
            jobsUpdated++;
            // Atualiza last_seen no cache
            const existing = cachedJobs.find(c => c.external_id === job.external_id);
            if (existing) {
              existing.last_seen_at = new Date().toISOString();
            }
            continue;
          }

          if (decision.action === 'DUPLICATE_CROSS_SOURCE') {
            jobsDiscarded++;
            continue;
          }

          const preFilter = runPreFilter(job);
          if (!preFilter.shouldSendToGemini) {
            jobsDiscarded++;
            continue;
          }

          jobsNew++;

          // Apenas vagas prioritárias recebem análise com limite de quota por ciclo
          if (preFilter.priority === 'HIGH' && jobsAnalyzed < 3) {
            console.log(`   [Worker] Analisando: "${job.title.substring(0, 40)}..."`);
            try {
              const analysis = await this.classifier.classifyJob(job);
              jobsAnalyzed++;

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
            } catch (classErr: any) {
              console.warn(`   [Worker] Fallback para heurística em ${job.title}: ${classErr.message}`);
              const fallbackAnalysis = this.classifier.classifyJobHeuristic(job);
              const jobWithAnalysis = {
                ...job,
                analysis: fallbackAnalysis,
                status: 'ACTIVE',
                last_seen_at: new Date().toISOString()
              };
              const idx = cachedJobs.findIndex(c => c.external_id === job.external_id);
              if (idx >= 0) cachedJobs[idx] = jobWithAnalysis;
              else cachedJobs.unshift(jobWithAnalysis);
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
