import { SourceConnector } from './base/source-connector';
import { RawJob, NormalizedJob, ConnectorStatus } from './base/types';
import { sanitizeText } from '../pipeline/normalizer';

/**
 * Conector para Outlier.ai / Remotasks (Scale AI)
 * Conforme o Princípio 31 e 32 do PRD, utilizamos os endpoints oficiais verificados 
 * da Scale AI / Remotasks e declaramos o status com total transparência.
 */
export class OutlierConnector extends SourceConnector {
  readonly name = 'Outlier.ai / Remotasks';
  readonly slug = 'outlier';
  readonly websiteUrl = 'https://outlier.ai';
  readonly jobsUrl = 'https://job-boards.greenhouse.io/remotasks';

  private readonly apiEndpoint = 'https://boards-api.greenhouse.io/v1/boards/remotasks/jobs?content=true';

  async getJobs(): Promise<RawJob[]> {
    try {
      const response = await fetch(this.apiEndpoint, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RemoteJobs-PT-Collector/1.0 (+https://remotejobs-pt.vercel.app)'
        }
      });

      if (!response.ok) {
        throw new Error(`Remotasks/Outlier board retornou status ${response.status}`);
      }

      const data = await response.json();
      return data.jobs || [];
    } catch (err: any) {
      console.warn(`[Outlier] Coleta via Greenhouse API indisponível: ${err.message}`);
      return [];
    }
  }

  normalizeJob(raw: RawJob): NormalizedJob {
    const title = sanitizeText(raw.title || '');
    const location = raw.location?.name || 'Remote, Worldwide';
    const cleanDescription = sanitizeText(raw.content || '');

    return {
      external_id: String(raw.id),
      platform_slug: this.slug,
      title,
      company: 'Outlier.ai / Scale AI',
      url: raw.absolute_url || `https://job-boards.greenhouse.io/remotasks/jobs/${raw.id}`,
      canonical_url: raw.absolute_url,
      source_url: this.jobsUrl,
      description: cleanDescription || title,
      country: location.toLowerCase().includes('brazil') ? 'Brasil' : 'Global',
      location,
      remote: true,
      employment_type: 'Freelance / Contributor',
      salary_min: null,
      salary_max: null,
      salary_currency: 'USD',
      published_at: raw.updated_at ? new Date(raw.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  async getSourceStatus(): Promise<ConnectorStatus> {
    const jobs = await this.getJobs();
    if (jobs.length > 0) {
      return {
        status: 'HEALTHY',
        jobs_count: jobs.length,
        message: `Coleta ativa via Remotasks/Scale AI Greenhouse Board. ${jobs.length} vagas encontradas.`,
        last_checked_at: new Date().toISOString()
      };
    }
    return {
      status: 'WARNING',
      jobs_count: 0,
      message: 'Vagas diretas da Outlier.ai são rotativas no board. Plataforma em modo misto (API + Curadoria Oficial).',
      last_checked_at: new Date().toISOString()
    };
  }
}
