import { RawJob, NormalizedJob, ConnectorStatus } from './types';

export abstract class SourceConnector {
  abstract readonly name: string;
  abstract readonly slug: string;
  abstract readonly websiteUrl: string;
  abstract readonly jobsUrl: string;

  /**
   * Busca as vagas brutas diretamente na fonte oficial
   */
  abstract getJobs(): Promise<RawJob[]>;

  /**
   * Normaliza os dados brutos para o formato padronizado da plataforma
   */
  abstract normalizeJob(raw: RawJob): NormalizedJob;

  /**
   * Valida se a vaga atende aos requisitos mínimos de integridade (URL, título, descrição)
   */
  validateJob(job: NormalizedJob): boolean {
    if (!job.external_id || typeof job.external_id !== 'string') return false;
    if (!job.title || job.title.trim().length < 3) return false;
    if (!job.url || !job.url.startsWith('http')) return false;
    if (!job.description || job.description.trim().length < 20) return false;
    return true;
  }

  /**
   * Verifica a saúde e disponibilidade da fonte externa
   */
  async getSourceStatus(): Promise<ConnectorStatus> {
    try {
      const jobs = await this.getJobs();
      return {
        status: 'HEALTHY',
        jobs_count: jobs.length,
        message: `Fonte operacional. ${jobs.length} vagas encontradas.`,
        last_checked_at: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        status: 'ERROR',
        message: `Falha na conexão: ${error.message || 'Erro desconhecido'}`,
        last_checked_at: new Date().toISOString()
      };
    }
  }

  /**
   * Executa o ciclo completo de coleta, validação e normalização
   */
  async collect(): Promise<NormalizedJob[]> {
    const rawJobs = await this.getJobs();
    const normalizedList: NormalizedJob[] = [];

    for (const raw of rawJobs) {
      try {
        const normalized = this.normalizeJob(raw);
        if (this.validateJob(normalized)) {
          normalizedList.push(normalized);
        }
      } catch (err) {
        console.warn(`[${this.slug}] Erro ao normalizar vaga ${raw.id}:`, err);
      }
    }

    return normalizedList;
  }
}
