import { ConnectorRegistry } from '../../src/connectors/registry';
import { DeduplicationEngine } from '../../src/pipeline/deduplicator';
import { runPreFilter } from '../../src/pipeline/pre-filter';
import { GeminiClassifier } from '../../src/pipeline/gemini-classifier';
import { getSupabaseServerClient } from '../../src/lib/supabase/server';
import { generateDescriptionHash } from '../../src/pipeline/hasher';

export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  try {
    const registry = ConnectorRegistry.getInstance();
    const deduplicator = new DeduplicationEngine();
    const classifier = new GeminiClassifier();
    const supabase: any = getSupabaseServerClient();

    // 1. Carrega todas as plataformas ativas do Supabase e do payload
    let targetPlatforms: any[] = [];
    if (req.body && Array.isArray(req.body.platforms)) {
      targetPlatforms = req.body.platforms;
    }

    if (supabase) {
      try {
        const { data: dbPlatforms } = await supabase.from('platforms').select('*');
        if (dbPlatforms && Array.isArray(dbPlatforms)) {
          targetPlatforms = [...targetPlatforms, ...dbPlatforms];
        }
      } catch (err: any) {
        console.warn('[Sync API] Aviso ao buscar plataformas do banco:', err?.message);
      }

      // Deduplicação Real: Carrega vagas existentes do Supabase
      try {
        const { data: dbJobs } = await supabase
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
        }
      } catch (dedupErr: any) {
        console.warn('[Sync API] Erro ao carregar deduplicação:', dedupErr?.message);
      }
    }

    // Se a requisição pediu apenas uma plataforma específica
    const singlePlatformSlug = req.body?.platform || req.query?.platform;
    let connectors = registry.getAllConnectors(targetPlatforms);
    if (singlePlatformSlug) {
      connectors = connectors.filter(c => c.slug === singlePlatformSlug);
    }

    let allSavedJobs: any[] = [];
    const sourceSummary: any[] = [];
    const nowIso = new Date().toISOString();

    for (const connector of connectors) {
      const cStart = Date.now();
      let jobsFound = 0;
      let jobsNew = 0;
      let jobsUpdated = 0;

      try {
        const rawJobs = await connector.collect();
        jobsFound = rawJobs.length;

        for (const job of rawJobs) {
          const decision = deduplicator.evaluate(job);

          if (decision.action === 'UPDATE_LAST_SEEN') {
            jobsUpdated++;
            if (supabase && decision.matched_job_id) {
              await supabase
                .from('jobs')
                .update({ last_seen_at: nowIso, status: 'ACTIVE' })
                .eq('id', decision.matched_job_id);
            }
            continue;
          }

          if (decision.action === 'DUPLICATE_CROSS_SOURCE') {
            continue;
          }

          const preFilter = runPreFilter(job);
          if (preFilter.priority === 'DISCARD') {
            continue;
          }

          jobsNew++;

          // Analisa por Gemini ou Heurística
          let analysis;
          try {
            if (preFilter.shouldSendToGemini) {
              analysis = await classifier.classifyJob(job);
            } else {
              analysis = classifier.classifyJobHeuristic(job);
            }
          } catch {
            analysis = classifier.classifyJobHeuristic(job);
          }

          if (supabase) {
            try {
              const { data: pData } = await supabase
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
                description_hash: generateDescriptionHash(job.description || job.title),
                country: job.country || 'Brasil',
                location: job.location || 'Remoto',
                remote: job.remote ?? true,
                employment_type: job.employment_type || 'Freelance',
                salary_min: job.salary_min || null,
                salary_max: job.salary_max || null,
                salary_currency: job.salary_currency || 'USD',
                status: 'ACTIVE',
                last_seen_at: nowIso
              };
              if (platformId) jobPayload.platform_id = platformId;

              const { data: insJob } = await supabase
                .from('jobs')
                .upsert(jobPayload, { onConflict: 'platform_slug,external_id' })
                .select('id')
                .maybeSingle();

              if (insJob?.id) {
                let engStatus = (analysis.english_status as string) || 'NONE';
                if (engStatus === 'READING_ONLY') engStatus = 'PARTIAL';

                await supabase.from('job_analysis').upsert({
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
                  analyzed_at: nowIso
                }, { onConflict: 'job_id' });

                allSavedJobs.push({
                  ...job,
                  analysis
                });
              }
            } catch (err: any) {
              console.warn(`[Sync API] Erro ao gravar vaga no Supabase:`, err?.message);
            }
          }
        }

        sourceSummary.push({
          platform: connector.name,
          slug: connector.slug,
          jobs_found: jobsFound,
          jobs_new: jobsNew,
          jobs_updated: jobsUpdated,
          duration_ms: Date.now() - cStart,
          status: 'SUCCESS'
        });

        if (supabase) {
          try {
            await (supabase as any).from('source_logs').insert({
              platform_slug: connector.slug,
              status: 'SUCCESS',
              jobs_found: jobsFound,
              jobs_new: jobsNew,
              jobs_updated: jobsUpdated,
              started_at: new Date(cStart).toISOString(),
              finished_at: new Date().toISOString()
            });
          } catch {}
        }
      } catch (err: any) {
        sourceSummary.push({
          platform: connector.name,
          slug: connector.slug,
          jobs_found: 0,
          error: err.message,
          status: 'FAILED'
        });

        if (supabase) {
          try {
            await (supabase as any).from('source_logs').insert({
              platform_slug: connector.slug,
              status: 'ERROR',
              jobs_found: 0,
              error_message: err.message,
              started_at: new Date(cStart).toISOString(),
              finished_at: new Date().toISOString()
            });
          } catch {}
        }
      }
    }

    if (supabase) {
      try {
        await (supabase as any).from('source_logs').insert({
          platform_slug: singlePlatformSlug || 'all-sync',
          status: 'SUCCESS',
          jobs_found: allSavedJobs.length,
          started_at: nowIso,
          finished_at: new Date().toISOString()
        });
      } catch {}
    }

    return res.status(200).json({
      success: true,
      jobs: allSavedJobs,
      total: allSavedJobs.length,
      platforms_scanned: sourceSummary.length,
      sources: sourceSummary,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    console.warn('[Vercel Sync API] Erro geral na sincronização backend:', e?.message);
    return res.status(200).json({
      success: false,
      error: e.message || 'Erro ao sincronizar',
      jobs: [],
      timestamp: new Date().toISOString()
    });
  }
}
