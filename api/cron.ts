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
                  .single();

                if (pData) {
                  const { data: insertedJob } = await supabaseClient
                    .from('jobs')
                    .upsert({
                      platform_id: pData.id,
                      external_id: job.external_id,
                      title: job.title,
                      company: job.company,
                      url: job.url,
                      canonical_url: job.canonical_url,
                      source_url: job.source_url,
                      description: job.description,
                      description_hash: generateDescriptionHash(job.description),
                      location: job.location,
                      remote: job.remote,
                      employment_type: job.employment_type,
                      status: 'ACTIVE',
                      last_seen_at: new Date().toISOString()
                    }, { onConflict: 'platform_id,external_id' })
                    .select('id')
                    .single();

                  if (insertedJob) {
                    await supabaseClient.from('job_analysis').upsert({
                      job_id: insertedJob.id,
                      english_status: analysis.english_status,
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
              }
            } catch (err: any) {
              console.warn(`[Cron] Erro ao classificar ${job.title}:`, err.message);
            }
          }
        }

        results.push({
          platform: connector.name,
          slug: connector.slug,
          jobs_found: jobs.length,
          analyzed: connectorAnalyzed,
          duration_ms: Date.now() - cStart,
          status: 'SUCCESS'
        });
      } catch (err: any) {
        results.push({
          platform: connector.name,
          slug: connector.slug,
          error: err.message,
          status: 'FAILED'
        });
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
