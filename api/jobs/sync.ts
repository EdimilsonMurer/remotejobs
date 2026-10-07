import { WelocalizeConnector } from '../../src/connectors/welocalize';
import { TuringConnector } from '../../src/connectors/turing';

export default async function handler(req: any, res: any) {
  try {
    const welocalize = new WelocalizeConnector();
    const turing = new TuringConnector();
    
    const [wRaw, tRaw] = await Promise.all([
      welocalize.getJobs().catch(e => {
        console.warn('[Vercel Sync API] Welocalize fetch error:', e?.message);
        return [];
      }),
      turing.getJobs().catch(e => {
        console.warn('[Vercel Sync API] Turing fetch error:', e?.message);
        return [];
      })
    ]);

    const wNorm = wRaw.map(j => welocalize.normalizeJob(j));
    const tNorm = tRaw.map(j => turing.normalizeJob(j));
    const combined = [...wNorm, ...tNorm];

    return res.status(200).json({
      success: true,
      jobs: combined,
      total: combined.length,
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    console.warn('[Vercel Sync API] Erro ao sincronizar vagas via conector:', e?.message);
    return res.status(200).json({
      success: false,
      error: e.message || 'Erro ao sincronizar',
      jobs: [],
      timestamp: new Date().toISOString()
    });
  }
}
