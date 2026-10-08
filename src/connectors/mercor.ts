import { SourceConnector } from './base/source-connector';
import { RawJob, NormalizedJob } from './base/types';
import { sanitizeText } from '../pipeline/normalizer';

/**
 * Conector Dedicado para Mercor AI (work.mercor.com / mercor.com)
 * Plataforma líder global em contratação e projetos remotos de avaliação de IA,
 * LLM Tuning, prompt engineering e revisão técnica para falantes de Português.
 */
export class MercorConnector extends SourceConnector {
  readonly name = 'Mercor AI';
  readonly slug = 'mercor';
  readonly websiteUrl = 'https://mercor.com';
  readonly jobsUrl = 'https://work.mercor.com/explore';

  async getJobs(): Promise<RawJob[]> {
    try {
      // 1. Tenta consulta ao endpoint público da Mercor com timeout curto
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const response = await fetch('https://backend.mercor.com/api/explore/jobs', {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RemoteHunterBot/2.0'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.jobs) && data.jobs.length > 0) {
          return data.jobs;
        }
      }
    } catch {
      // Falha esperada caso esteja protegido ou offline
    }

    // Sem vagas fabricadas: se a fonte falhar ou não retornar dados, retorna vazio
    return [];
  }

  normalizeJob(raw: RawJob): NormalizedJob {
    const title = sanitizeText(raw.title || '');
    const description = sanitizeText(raw.description || title);

    return {
      external_id: String(raw.id),
      platform_slug: this.slug,
      title,
      company: raw.company || 'Mercor AI',
      url: raw.url || this.jobsUrl,
      canonical_url: raw.url || this.jobsUrl,
      source_url: this.jobsUrl,
      description,
      country: raw.country || 'Brasil',
      location: raw.location || 'Remoto (Brasil)',
      remote: true,
      employment_type: raw.employment_type || 'Freelance / Contributor',
      salary_min: raw.salary_min || null,
      salary_max: raw.salary_max || null,
      salary_currency: raw.salary_currency || 'USD',
      published_at: raw.published_at ? new Date(raw.published_at).toISOString() : new Date().toISOString()
    };
  }

  override async getSourceStatus() {
    try {
      const jobs = await this.getJobs();
      if (jobs.length > 0) {
        return {
          status: 'HEALTHY' as const,
          jobs_count: jobs.length,
          message: `Fonte Mercor operacional. ${jobs.length} vagas encontradas.`,
          last_checked_at: new Date().toISOString()
        };
      }
      return {
        status: 'WARNING' as const,
        jobs_count: 0,
        message: 'Sem dados: A API da Mercor não retornou vagas públicas ativas no momento.',
        last_checked_at: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        status: 'ERROR' as const,
        jobs_count: 0,
        message: `Sem dados: Erro na conexão com Mercor (${err.message || 'Erro desconhecido'}).`,
        last_checked_at: new Date().toISOString()
      };
    }
  }
}
