import { NormalizedJob } from '../connectors/base/types';
import { generateDescriptionHash, normalizeUrl } from './hasher';

export type DeduplicationAction = 
  | 'INSERT_NEW'            // Vaga inédita no sistema
  | 'UPDATE_LAST_SEEN'      // Vaga já existente e descrição idêntica (atualiza apenas last_seen_at)
  | 'UPDATE_AND_REANALYZE'  // Vaga já existente, mas a descrição mudou (necessita nova análise)
  | 'DUPLICATE_CROSS_SOURCE'; // Duplicada detectada entre fontes distintas

export interface DeduplicationDecision {
  action: DeduplicationAction;
  job: NormalizedJob;
  description_hash: string;
  normalized_url: string;
  matched_job_id?: string;
  reason: string;
}

export interface ExistingJobSnapshot {
  id: string;
  platform_slug: string;
  external_id: string;
  normalized_url: string;
  description_hash: string;
  title_company_location_key: string;
}

export class DeduplicationEngine {
  private existingIndexByExternalId = new Map<string, ExistingJobSnapshot>();
  private existingIndexByUrl = new Map<string, ExistingJobSnapshot>();
  private existingIndexByTitleKey = new Map<string, ExistingJobSnapshot>();

  /**
   * Inicializa o índice em memória com as vagas já cadastradas no banco
   */
  public loadExistingJobs(jobs: ExistingJobSnapshot[]): void {
    this.existingIndexByExternalId.clear();
    this.existingIndexByUrl.clear();
    this.existingIndexByTitleKey.clear();

    for (const job of jobs) {
      const extKey = `${job.platform_slug}:${job.external_id}`;
      this.existingIndexByExternalId.set(extKey, job);

      if (job.normalized_url) {
        this.existingIndexByUrl.set(job.normalized_url, job);
      }

      if (job.title_company_location_key) {
        this.existingIndexByTitleKey.set(job.title_company_location_key, job);
      }
    }
  }

  /**
   * Gera chave de similaridade baseada em Empresa + Título + Localização
   */
  public static generateTitleKey(company: string, title: string, location: string): string {
    const clean = (str: string) => 
      (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    return `${clean(company)}::${clean(title)}::${clean(location)}`;
  }

  /**
   * Avalia uma vaga candidata contra a base de dados
   */
  public evaluate(job: NormalizedJob): DeduplicationDecision {
    const description_hash = generateDescriptionHash(job.description);
    const normalized_url = normalizeUrl(job.canonical_url || job.url);
    const externalKey = `${job.platform_slug}:${job.external_id}`;
    const titleKey = DeduplicationEngine.generateTitleKey(job.company, job.title, job.location);

    // 1. Verificação Primária: platform_slug + external_id
    const matchByExternalId = this.existingIndexByExternalId.get(externalKey);
    if (matchByExternalId) {
      if (matchByExternalId.description_hash === description_hash) {
        return {
          action: 'UPDATE_LAST_SEEN',
          job,
          description_hash,
          normalized_url,
          matched_job_id: matchByExternalId.id,
          reason: 'Vaga idêntica já cadastrada na mesma fonte. Hash inalterado.'
        };
      } else {
        return {
          action: 'UPDATE_AND_REANALYZE',
          job,
          description_hash,
          normalized_url,
          matched_job_id: matchByExternalId.id,
          reason: 'Descrição da vaga foi atualizada na fonte oficial. Reanálise necessária.'
        };
      }
    }

    // 2. Verificação Secundária: URL normalizada
    const matchByUrl = this.existingIndexByUrl.get(normalized_url);
    if (matchByUrl) {
      return {
        action: 'DUPLICATE_CROSS_SOURCE',
        job,
        description_hash,
        normalized_url,
        matched_job_id: matchByUrl.id,
        reason: `Vaga já cadastrada via URL canônica ${normalized_url} da fonte ${matchByUrl.platform_slug}.`
      };
    }

    // 3. Verificação Terciária: Empresa + Título + Local
    const matchByTitleKey = this.existingIndexByTitleKey.get(titleKey);
    if (matchByTitleKey) {
      return {
        action: 'DUPLICATE_CROSS_SOURCE',
        job,
        description_hash,
        normalized_url,
        matched_job_id: matchByTitleKey.id,
        reason: `Vaga similar detectada (Empresa: ${job.company}, Título: ${job.title}).`
      };
    }

    // Vaga Inédita
    const snapshot: ExistingJobSnapshot = {
      id: `pending-${job.external_id}`,
      platform_slug: job.platform_slug,
      external_id: job.external_id,
      normalized_url,
      description_hash,
      title_company_location_key: titleKey
    };

    // Registra temporariamente no índice para deduplicar dentro do mesmo lote
    this.existingIndexByExternalId.set(externalKey, snapshot);
    this.existingIndexByUrl.set(normalized_url, snapshot);
    this.existingIndexByTitleKey.set(titleKey, snapshot);

    return {
      action: 'INSERT_NEW',
      job,
      description_hash,
      normalized_url,
      reason: 'Vaga inédita. Pronta para processamento.'
    };
  }
}
