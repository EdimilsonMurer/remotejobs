export interface RawJob {
  id: string | number;
  [key: string]: any;
}

export interface NormalizedJob {
  external_id: string;
  platform_slug: string;
  title: string;
  company: string;
  url: string;
  canonical_url?: string | null;
  source_url: string;
  description: string;
  country: string;
  location: string;
  remote: boolean;
  employment_type: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  published_at: string;
}

export interface ConnectorStatus {
  status: 'HEALTHY' | 'WARNING' | 'ERROR' | 'DISABLED';
  jobs_count?: number;
  message?: string;
  last_checked_at: string;
}
