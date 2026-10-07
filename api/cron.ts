import { ConnectorRegistry } from '../src/connectors/registry';
import { DeduplicationEngine } from '../src/pipeline/deduplicator';
import { runPreFilter } from '../src/pipeline/pre-filter';
import { GeminiClassifier } from '../src/pipeline/gemini-classifier';
import { getSupabaseServerClient } from '../src/lib/supabase/server';
import { generateDescriptionHash } from '../src/pipeline/hasher';

export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  console.log('[API Cron] Iniciando ciclo de coleta disparado externamente...');

  try {
    const registry = ConnectorRegistry.getInstance();
    const connectors = registry.getAllConnectors();
    const deduplicator = new DeduplicationEngine();
    const classifier = new GeminiClassifier();

    let supabaseClient: any = null;
    try {
      supabaseClient = getSupabaseServerClient();
    } catch {}

    const results: any[] = [];
    let totalFound = 0;
    let totalAnalyzed = 0;

    for (const connector of connectors) {
      const cStart = Date.now();
      try {
        const jobs = await connector.collect();
        totalFound += jobs.length;

        let connectorAnalyzed = 0;
        for (const job of jobs) {
          const decision = deduplicator.evaluate(job);
          if (decision.action === 'UPDATE_LAST_SEEN' || decision.action === 'DUPLICATE_CROSS_SOURCE') {
            continue;
          }

          const preFilter = runPreFilter(job);
          if (preFilter.priority === 'HIGH' && connectorAnalyzed < 2) {
            try {
              const analysis = await classifier.classifyJob(job);
              connectorAnalyzed++;
              totalAnalyzed++;

              // Salva no Supabase se configurado
              if (supabaseClient) {
                // Insere ou atualiza vaga no Supabase
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
                    compatibility_score: analysis.compatibility_score,
                    confidence: analysis.confidence,
                    reason: analysis.reason
                  }, { onConflict: 'job_id' });
                }
              }
            } catch (err: any) {
              console.warn(`[Cron] Erro ao classificar ${job.title}:`, err.message);
            }
          }
        }

        const logEntry = {
          platform: connector.name,
          slug: connector.slug,
          jobs_found: jobs.length,
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
              jobs_found: jobs.length,
              jobs_new: connectorAnalyzed,
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

    return res.status(200).json({
      success: true,
      message: 'Ciclo de coleta concluído com sucesso!',
      total_found: totalFound,
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
