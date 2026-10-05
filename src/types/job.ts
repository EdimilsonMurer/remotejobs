export type CurrencyType = 'USD' | 'EUR' | 'BRL' | 'GBP' | 'MULTI';

// PRD Section 11 & 12: Classificações de Idioma Oficiais
export type EnglishStatus = 'NONE' | 'DESIRABLE' | 'PARTIAL' | 'REQUIRED' | 'UNKNOWN';
export type PortugueseLevel = 'NATIVE' | 'FLUENT' | 'INTERMEDIATE' | 'BASIC' | 'NONE' | 'UNKNOWN';

export type JobCategory = 
  | 'AI' 
  | 'DATA' 
  | 'ANNOTATION' 
  | 'LOCALIZATION' 
  | 'TESTING' 
  | 'TRANSLATION' 
  | 'MICROTASK' 
  | 'OTHER';

export type ExperienceLevel = 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR' | 'UNKNOWN';
export type JobStatus = 'ACTIVE' | 'EXPIRED' | 'CLOSED' | 'UNKNOWN';
export type PlatformHealthStatus = 'HEALTHY' | 'WARNING' | 'ERROR' | 'DISABLED';
export type DataQuality = 'HIGH' | 'MEDIUM' | 'LOW';

// Análise Estruturada do Gemini (PRD Seção 14)
export interface JobAnalysis {
  id?: string;
  job_id?: string;
  english_status: EnglishStatus;
  portuguese_required: boolean;
  portuguese_level: PortugueseLevel;
  brazil_eligible: boolean;
  remote_eligible: boolean;
  job_category: JobCategory | string;
  experience_level: ExperienceLevel;
  salary_detected: boolean;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  compatibility_score: number; // 0 a 100
  confidence: number;          // 0 a 100
  reason: string;
  analysis_version?: string;
  analyzed_at?: string;
}

// Entidade de Vaga Completa com Análise
export interface JobRecord {
  id: string;
  platform_id: string;
  external_id: string;
  title: string;
  company: string;
  url: string;
  canonical_url?: string | null;
  source_url: string;
  description: string;
  description_hash: string;
  country: string;
  location: string;
  remote: boolean;
  employment_type: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  data_quality: DataQuality;
  status: JobStatus;
  published_at: string;
  deadline?: string | null;
  first_seen_at: string;
  last_seen_at: string;
  platform?: {
    name: string;
    slug: string;
    website_url: string;
    status: PlatformHealthStatus;
  };
  analysis?: JobAnalysis;
}

// Logs de Coleta e Monitoramento (PRD Seção 29)
export interface SourceLog {
  id: string;
  platform_id: string;
  started_at: string;
  finished_at?: string | null;
  status: 'SUCCESS' | 'ERROR' | 'PARTIAL';
  jobs_found: number;
  jobs_new: number;
  jobs_updated: number;
  jobs_rejected: number;
  error_message?: string | null;
}

// Tipos auxiliares de interface legada para compatibilidade de UI
export type EnglishRequirement = 
  | 'NONE'
  | 'READING_ONLY'
  | 'BASIC'
  | 'INTERMEDIATE'
  | 'FLUENT_INTERVIEW';

export type ProcessType = 
  | 'NO_INTERVIEW'
  | 'ONLINE_EXAM'
  | 'AI_TEST'
  | 'LIVE_INTERVIEW';

export type PlatformStatus = 
  | 'FAVORITE'
  | 'ACTIVE'
  | 'PAUSED'
  | 'BLACKLIST';

export type UserAccountStatus = 
  | 'NOT_REGISTERED'
  | 'REGISTERED'
  | 'EXAM_PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED_ACTIVE'
  | 'INACTIVE';

export interface Platform {
  id: string;
  name: string;
  websiteUrl: string;
  careersUrl: string;
  category: string;
  currency: CurrencyType;
  englishRequirement: EnglishRequirement;
  processType: ProcessType;
  status: PlatformStatus;
  blacklistReason?: string;
  paymentMethods: string[];
  notes: string;
  averagePayRate?: string;
  userStatus: UserAccountStatus;
  userNotes?: string;
  updatedAt?: string;
}

export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  platformId?: string;
  platformName?: string;
  category: string;
  location: string;
  currency: CurrencyType;
  salary?: string;
  url: string;
  description: string;
  highlights: string[];
  tags: string[];
  publishedAt: string;
  requiresEnglishInterview: boolean;
  englishRequirement: EnglishRequirement;
  processType: ProcessType;
  isStrongCurrency: boolean;
  isPtBrFriendly: boolean;
  // Integração com Análise Gemini
  compatibilityScore?: number;
  englishStatus?: EnglishStatus;
  aiReason?: string;
}

export interface BlacklistRule {
  id: string;
  name: string;
  type: 'PLATFORM' | 'COMPANY' | 'KEYWORD';
  reason: string;
  addedAt: string;
}
