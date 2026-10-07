import { ConnectorRegistry } from '../../src/connectors/registry';

export default async function handler(req: any, res: any) {
  try {
    const registry = ConnectorRegistry.getInstance();
    const connectors = registry.getAllConnectors();
    
    let allJobs: any[] = [];
    const sourceSummary: any[] = [];

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
      } catch (err: any) {
        sourceSummary.push({
          platform: connector.name,
          slug: connector.slug,
          jobs_found: 0,
          error: err.message,
          status: 'FAILED'
        });
      }
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
