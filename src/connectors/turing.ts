import { SourceConnector } from './base/source-connector';
import { RawJob, NormalizedJob } from './base/types';
import { sanitizeText } from '../pipeline/normalizer';

export class TuringConnector extends SourceConnector {
  readonly name = 'Turing';
  readonly slug = 'turing';
  readonly websiteUrl = 'https://www.turing.com';
  readonly jobsUrl = 'https://job-boards.greenhouse.io/turing';

  private readonly apiEndpoint = 'https://boards-api.greenhouse.io/v1/boards/turing/jobs?content=true';

  async getJobs(): Promise<RawJob[]> {
    const response = await fetch(this.apiEndpoint, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RemoteJobs-PT-Collector/1.0 (+https://remotejobs-pt.vercel.app)'
      }
    });

    if (!response.ok) {
      throw new Error(`Turing API retornou status HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.jobs || [];
  }

  normalizeJob(raw: RawJob): NormalizedJob {
    const title = sanitizeText(raw.title || '');
    const location = raw.location?.name || 'Remote';
    
    // Higieniza HTML e entidades
    const cleanDescription = sanitizeText(raw.content || '');

    const isRemote = 
      location.toLowerCase().includes('remote') || 
      title.toLowerCase().includes('remote') ||
      cleanDescription.toLowerCase().includes('remote');

    return {
      external_id: String(raw.id),
      platform_slug: this.slug,
      title,
      company: 'Turing',
      url: raw.absolute_url || `https://job-boards.greenhouse.io/turing/jobs/${raw.id}`,
      canonical_url: raw.absolute_url,
      source_url: this.jobsUrl,
      description: cleanDescription || title,
      country: location.toLowerCase().includes('brazil') ? 'Brasil' : 'Global',
      location,
      remote: isRemote,
      employment_type: 'Full-time / Contract',
      salary_min: null,
      salary_max: null,
      salary_currency: 'USD',
      published_at: raw.updated_at ? new Date(raw.updated_at).toISOString() : new Date().toISOString(),
    };
  }
}
