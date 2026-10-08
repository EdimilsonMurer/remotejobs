import { SourceConnector } from './base/source-connector';
import { RawJob, NormalizedJob } from './base/types';

export class GenericDynamicConnector extends SourceConnector {
  readonly name: string;
  readonly slug: string;
  readonly websiteUrl: string;
  readonly jobsUrl: string;
  private customCategory: string;
  private customCurrency: string;
  private customPayRate: string;

  constructor(platformInfo: { name: string; slug: string; websiteUrl: string; jobsUrl: string; category?: string; currency?: string; averagePayRate?: string }) {
    super();
    this.name = platformInfo.name;
    this.slug = platformInfo.slug.toLowerCase().replace(/[^a-z0-9]/g, '-');
    this.websiteUrl = platformInfo.websiteUrl || 'https://example.com';
    this.jobsUrl = platformInfo.jobsUrl || platformInfo.websiteUrl || 'https://example.com';
    this.customCategory = platformInfo.category || 'Treinamento de IA & Trabalho Remoto';
    this.customCurrency = platformInfo.currency || 'USD';
    this.customPayRate = platformInfo.averagePayRate || '$10.00 - $35.00 / hora';
  }

  async getJobs(): Promise<RawJob[]> {
    try {
      // 1. Tenta fetch real na URL de carreiras se for pública e acessível
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(this.jobsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RemoteHunterBot/2.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();
        // Extrai títulos e menções de vagas no HTML via regex
        const matches = html.match(/<h[234][^>]*>([^<]+)<\/h[234]>/gi) || [];
        const extractedTitles = matches
          .map(m => m.replace(/<[^>]+>/g, '').trim())
          .filter(t => t.length > 8 && t.length < 150 && !t.toLowerCase().includes('cookie') && !t.toLowerCase().includes('privacy'));

        if (extractedTitles.length > 0) {
          return extractedTitles.slice(0, 5).map((title, idx) => ({
            id: `${this.slug}-scraped-${idx + 1}-${Date.now()}`,
            title: title,
            company: this.name,
            url: this.jobsUrl,
            description: `Vaga oficial coletada no portal de carreiras da ${this.name} (${this.jobsUrl}).`,
            location: 'Remoto (Brasil / Global)',
            country: 'Brasil',
            published_at: new Date().toISOString(),
            salary_min: null,
            salary_max: null,
            salary_currency: this.customCurrency
          }));
        }
      }
    } catch {}

    // Sem vagas fabricadas: se a fonte falhar ou não houver vagas públicas acessíveis, retorna vazio
    return [];
  }

  normalizeJob(raw: RawJob): NormalizedJob {
    return {
      external_id: String(raw.id),
      platform_slug: this.slug,
      title: raw.title,
      company: raw.company || this.name,
      url: raw.url || this.jobsUrl,
      canonical_url: raw.url || this.jobsUrl,
      source_url: raw.jobsUrl || this.jobsUrl,
      description: raw.description,
      country: raw.country || 'Brasil',
      location: raw.location || 'Remoto',
      remote: true,
      employment_type: 'Freelance',
      salary_min: raw.salary_min || null,
      salary_max: raw.salary_max || null,
      salary_currency: raw.salary_currency || this.customCurrency,
      published_at: raw.published_at || new Date().toISOString()
    };
  }

  override async getSourceStatus() {
    try {
      const jobs = await this.getJobs();
      if (jobs.length > 0) {
        return {
          status: 'HEALTHY' as const,
          jobs_count: jobs.length,
          message: `Fonte operacional. ${jobs.length} vagas encontradas.`,
          last_checked_at: new Date().toISOString()
        };
      }
      return {
        status: 'WARNING' as const,
        jobs_count: 0,
        message: `Sem dados: Nenhuma vaga encontrada no portal da ${this.name}.`,
        last_checked_at: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        status: 'ERROR' as const,
        jobs_count: 0,
        message: `Sem dados: Falha ao conectar com ${this.name} (${err.message || 'Erro de rede'}).`,
        last_checked_at: new Date().toISOString()
      };
    }
  }
}
