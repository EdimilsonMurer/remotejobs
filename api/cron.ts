import { ConnectorRegistry } from '../src/connectors/registry';
import { DeduplicationEngine } from '../src/pipeline/deduplicator';
import { runPreFilter } from '../src/pipeline/pre-filter';
import { GeminiClassifier } from '../src/pipeline/gemini-classifier';
import { getSupabaseServerClient } from '../src/lib/supabase/server';
import { generateDescriptionHash } from '../src/pipeline/hasher';

export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  console.log('[API Cron] Iniciando ciclo de ingestão automatizada no backend...');

  try {
    const registry = ConnectorRegistry.getInstance();
    const connectors = registry.getAllConnectors();
    const deduplicator = new DeduplicationEngine();
    const classifier = new GeminiClassifier();

    let supabaseClient: any = null;
    try {
      supabaseClient = getSupabaseServerClient();
    } catch {}

    // 1. Deduplicação Real: Carrega vagas existentes do Supabase
    if (supabaseClient) {
      try {
        const { data: dbJobs } = await supabaseClient
          .from('jobs')
          .select('id, platform_slug, external_id, canonical_url, url, description_hash, company, title, location');

        if (dbJobs && Array.isArray(dbJobs)) {
          const snapshots = dbJobs.map((row: any) => ({
            id: row.id,
            platform_slug: row.platform_slug,
            external_id: row.external_id,
            normalized_url: row.canonical_url || row.url || '',
            description_hash: row.description_hash || '',
            title_company_location_key: DeduplicationEngine.generateTitleKey(row.company, row.title, row.location)
          }));
          deduplicator.loadExistingJobs(snapshots);
          console.log(`[API Cron] ${snapshots.length} vagas existentes carregadas para deduplicação real.`);
        }
      } catch (err: any) {
        console.warn('[API Cron] Falha ao carregar vagas existentes para deduplicação:', err?.message);
      }
    }

    const results: any[] = [];
    let totalFound = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    let totalAnalyzed = 0;

    // 2. Coleta de todas as plataformas registradas
    for (const connector of connectors) {
      const cStart = Date.now();
      let connectorFound = 0;
      let connectorNew = 0;
      let connectorUpdated = 0;
      let connectorAnalyzed = 0;

      try {
        const jobs = await connector.collect();
        connectorFound = jobs.length;
        totalFound += jobs.length;

        for (const job of jobs) {
          const decision = deduplicator.evaluate(job);

          // Se a vaga já existe sem alteração, apenas atualiza last_seen_at no Supabase
          if (decision.action === 'UPDATE_LAST_SEEN') {
            connectorUpdated++;
            totalUpdated++;
            if (supabaseClient && decision.matched_job_id) {
              await supabaseClient
                .from('jobs')
                .update({ last_seen_at: new Date().toISOString(), status: 'ACTIVE' })
                .eq('id', decision.matched_job_id);
            }
            continue;
          }

          if (decision.action === 'DUPLICATE_CROSS_SOURCE') {
            continue;
          }

          // Pré-filtro para classificação determinística de prioridade
          const preFilter = runPreFilter(job);
          if (preFilter.priority === 'DISCARD') {
            continue;
          }

          connectorNew++;
          totalNew++;

          // Analisa a vaga elegível sem limites artificiais de quota
          try {
            let analysis;
            if (preFilter.shouldSendToGemini) {
              analysis = await classifier.classifyJob(job);
            } else {
              analysis = classifier.classifyJobHeuristic(job);
            }

            connectorAnalyzed++;
            totalAnalyzed++;

            // Salva no Supabase se configurado
            if (supabaseClient) {
              const { data: pData } = await supabaseClient
                .from('platforms')
                .select('id')
                .eq('slug', connector.slug)
                .limit(1)
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
                description_hash: generateDescriptionHash(job.description || job.title),
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

              if (platformId) {
                jobPayload.platform_id = platformId;
              }

              let insertedJob: any = null;
              const { data: ins1, error: err1 } = await supabaseClient
                .from('jobs')
                .upsert(jobPayload, { onConflict: 'platform_slug,external_id' })
                .select('id')
                .maybeSingle();

              if (!err1 && ins1) {
                insertedJob = ins1;
              } else if (platformId) {
                const { data: ins2 } = await supabaseClient
                  .from('jobs')
                  .upsert(jobPayload, { onConflict: 'platform_id,external_id' })
                  .select('id')
                  .maybeSingle();
                insertedJob = ins2;
              }

              if (insertedJob && insertedJob.id) {
                let engStatus = (analysis.english_status as string) || 'NONE';
                if (engStatus === 'READING_ONLY') engStatus = 'PARTIAL';

                await supabaseClient.from('job_analysis').upsert({
                  job_id: insertedJob.id,
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
            }
          } catch (err: any) {
            console.warn(`[API Cron] Erro ao analisar ${job.title}:`, err.message);
          }
        }

        const logEntry = {
          platform: connector.name,
          slug: connector.slug,
          jobs_found: connectorFound,
          jobs_new: connectorNew,
          jobs_updated: connectorUpdated,
          analyzed: connectorAnalyzed,
          duration_ms: Date.now() - cStart,
          status: 'SUCCESS'
        };
        results.push(logEntry);

        if (supabaseClient) {
          try {
            const { data: pLog } = await supabaseClient
              .from('platforms')
              .select('id')
              .eq('slug', connector.slug)
              .limit(1)
              .maybeSingle();

            const logPayload: Record<string, any> = {
              platform_slug: connector.slug,
              status: 'SUCCESS',
              jobs_found: connectorFound,
              jobs_new: connectorNew,
              jobs_updated: connectorUpdated,
              finished_at: new Date().toISOString()
            };
            if (pLog?.id) logPayload.platform_id = pLog.id;

            const { error: logErr } = await supabaseClient.from('source_logs').insert(logPayload);
            if (logErr && logPayload.platform_id) {
              delete logPayload.platform_slug;
              await supabaseClient.from('source_logs').insert(logPayload);
            }
          } catch {}
        }
      } catch (err: any) {
        results.push({
          platform: connector.name,
          slug: connector.slug,
          error: err.message,
          status: 'FAILED'
        });

        if (supabaseClient) {
          try {
            const { data: pLog } = await supabaseClient
              .from('platforms')
              .select('id')
              .eq('slug', connector.slug)
              .limit(1)
              .maybeSingle();

            const logPayload: Record<string, any> = {
              platform_slug: connector.slug,
              status: 'FAILED',
              error_message: err.message,
              finished_at: new Date().toISOString()
            };
            if (pLog?.id) logPayload.platform_id = pLog.id;

            const { error: logErr } = await supabaseClient.from('source_logs').insert(logPayload);
            if (logErr && logPayload.platform_id) {
              delete logPayload.platform_slug;
              await supabaseClient.from('source_logs').insert(logPayload);
            }
          } catch {}
        }
      }
    }

    if (supabaseClient) {
      try {
        await (supabaseClient as any).from('source_logs').insert({
          platform_slug: 'all-cron',
          status: 'SUCCESS',
          jobs_found: totalFound,
          jobs_new: totalNew,
          jobs_updated: totalUpdated,
          started_at: new Date(startTime).toISOString(),
          finished_at: new Date().toISOString()
        });
      } catch {}
    }

    return res.status(200).json({
      success: true,
      message: 'Ciclo de coleta e análise concluído com sucesso!',
      total_found: totalFound,
      total_new: totalNew,
      total_updated: totalUpdated,
      total_analyzed: totalAnalyzed,
      duration_ms: Date.now() - startTime,
      platforms: results,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[API Cron] Erro geral:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao executar ciclo de coleta',
      duration_ms: Date.now() - startTime
    });
  }
}
