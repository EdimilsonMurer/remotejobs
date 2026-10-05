import { SourceConnector } from './base/source-connector';
import { RawJob, NormalizedJob } from './base/types';

export class WelocalizeConnector extends SourceConnector {
  readonly name = 'Welocalize';
  readonly slug = 'welocalize';
  readonly websiteUrl = 'https://www.welocalize.com';
  readonly jobsUrl = 'https://jobs.lever.co/weloglobal?department=Welocalize';

  private readonly apiEndpoint = 'https://api.lever.co/v0/postings/weloglobal?mode=json';

  async getJobs(): Promise<RawJob[]> {
    const response = await fetch(this.apiEndpoint, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RemoteJobs-PT-Collector/1.0 (+https://remotejobs-pt.vercel.app)'
      }
    });

    if (!response.ok) {
      throw new Error(`Welocalize API retornou status HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Formato inesperado retornado pela API da Welocalize');
    }

    return data;
  }

  normalizeJob(raw: RawJob): NormalizedJob {
    const textTitle = (raw.text || '').replace(/^\*/, '').trim();
    const location = raw.categories?.location || 'Remote, Worldwide';
    const commitment = raw.categories?.commitment || 'Contract / Freelance';
    
    // Concatena descrição principal com instruções adicionais
    const descriptionPlain = raw.descriptionPlain || '';
    const additionalPlain = raw.additionalPlain || '';
    const fullDescription = `${descriptionPlain}\n\n${additionalPlain}`.trim();

    const isRemote = 
      location.toLowerCase().includes('remote') || 
      location.toLowerCase().includes('worldwide') ||
      raw.workplaceType === 'remote' ||
      fullDescription.toLowerCase().includes('fully remote') ||
      fullDescription.toLowerCase().includes('work from home');

    // Determina país
    let country = 'Global';
    if (location.toLowerCase().includes('brazil') || fullDescription.toLowerCase().includes('brazil')) {
      country = 'Brasil';
    } else if (location.toLowerCase().includes('portugal')) {
      country = 'Portugal';
    }

    // Data de publicação (Lever retorna timestamp em milissegundos)
    const publishedAt = raw.createdAt 
      ? new Date(raw.createdAt).toISOString() 
      : new Date().toISOString();

    return {
      external_id: String(raw.id),
      platform_slug: this.slug,
      title: textTitle,
      company: 'Welocalize / Welo Data',
      url: raw.hostedUrl || `https://jobs.lever.co/weloglobal/${raw.id}`,
      canonical_url: raw.applyUrl || raw.hostedUrl,
      source_url: this.jobsUrl,
      description: fullDescription || textTitle,
      country,
      location,
      remote: isRemote,
      employment_type: commitment,
      salary_min: null,
      salary_max: null,
      salary_currency: 'USD',
      published_at: publishedAt,
    };
  }
}
