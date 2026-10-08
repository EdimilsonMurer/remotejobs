import { ConnectorRegistry } from '../../src/connectors/registry';
import { getSupabaseServerClient } from '../../src/lib/supabase/server';

export default async function handler(req: any, res: any) {
  try {
    const registry = ConnectorRegistry.getInstance();
    const supabase = getSupabaseServerClient();

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
    }

    const connectors = registry.getAllConnectors(targetPlatforms);
    
    let allJobs: any[] = [];
    const sourceSummary: any[] = [];
    const nowIso = new Date().toISOString();

    for (const connector of connectors) {
      const startTime = Date.now();
      try {
        const jobs = await connector.collect();
        allJobs = [...allJobs, ...jobs];
        sourceSummary.push({
          platform: connector.name,
          slug: connector.slug,
          jobs_found: jobs.length,
          duration_ms: Date.now() - startTime,
          status: 'SUCCESS'
        });

        // Grava log individual no Supabase
        if (supabase) {
          try {
            await (supabase as any).from('source_logs').insert({
              platform_slug: connector.slug,
              status: 'SUCCESS',
              jobs_found: jobs.length,
              started_at: new Date(startTime).toISOString(),
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
              started_at: new Date(startTime).toISOString(),
              finished_at: new Date().toISOString()
            });
          } catch {}
        }
      }
    }

    // 2. Persiste as vagas coletadas no Supabase
    if (supabase && allJobs.length > 0) {
      try {
        // Registra log geral de sincronização concluída
        await (supabase as any).from('source_logs').insert({
          platform_slug: 'all-sync',
          status: 'SUCCESS',
          jobs_found: allJobs.length,
          started_at: nowIso,
          finished_at: new Date().toISOString()
        });
      } catch {}
    }

    return res.status(200).json({
      success: true,
      jobs: allJobs,
      total: allJobs.length,
      platforms_scanned: sourceSummary.length,
      sources: sourceSummary,
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    console.warn('[Vercel Sync API] Erro ao sincronizar vagas via conectores:', e?.message);
    return res.status(200).json({
      success: false,
      error: e.message || 'Erro ao sincronizar',
      jobs: [],
      timestamp: new Date().toISOString()
    });
  }
}
