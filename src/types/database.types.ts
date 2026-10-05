export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PlatformStatus = 'HEALTHY' | 'WARNING' | 'ERROR' | 'DISABLED';
export type JobStatus = 'ACTIVE' | 'EXPIRED' | 'CLOSED' | 'UNKNOWN';
export type EnglishStatus = 'NONE' | 'DESIRABLE' | 'PARTIAL' | 'REQUIRED' | 'UNKNOWN';
export type PortugueseLevel = 'NATIVE' | 'FLUENT' | 'INTERMEDIATE' | 'BASIC' | 'NONE' | 'UNKNOWN';
export type DataQuality = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Database {
  public: {
    Tables: {
      platforms: {
        Row: {
          id: string;
          name: string;
          slug: string;
          website_url: string;
          jobs_url: string;
          connector_type: string;
          enabled: boolean;
          status: PlatformStatus;
          last_run_at: string | null;
          last_success_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          website_url: string;
          jobs_url: string;
          connector_type?: string;
          enabled?: boolean;
          status?: PlatformStatus;
          last_run_at?: string | null;
          last_success_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          website_url?: string;
          jobs_url?: string;
          connector_type?: string;
          enabled?: boolean;
          status?: PlatformStatus;
          last_run_at?: string | null;
          last_success_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          platform_id: string;
          external_id: string;
          title: string;
          company: string;
          url: string;
          canonical_url: string | null;
          source_url: string;
          description: string;
          description_hash: string;
          country: string;
          location: string;
          remote: boolean;
          employment_type: string;
          salary_min: number | null;
          salary_max: number | null;
          salary_currency: string | null;
          data_quality: DataQuality;
          status: JobStatus;
          published_at: string;
          deadline: string | null;
          first_seen_at: string;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          platform_id: string;
          external_id: string;
          title: string;
          company: string;
          url: string;
          canonical_url?: string | null;
          source_url: string;
          description: string;
          description_hash: string;
          country?: string;
          location?: string;
          remote?: boolean;
          employment_type?: string;
          salary_min?: number | null;
          salary_max?: number | null;
          salary_currency?: string | null;
          data_quality?: DataQuality;
          status?: JobStatus;
          published_at?: string;
          deadline?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          platform_id?: string;
          external_id?: string;
          title?: string;
          company?: string;
          url?: string;
          canonical_url?: string | null;
          source_url?: string;
          description?: string;
          description_hash?: string;
          country?: string;
          location?: string;
          remote?: boolean;
          employment_type?: string;
          salary_min?: number | null;
          salary_max?: number | null;
          salary_currency?: string | null;
          data_quality?: DataQuality;
          status?: JobStatus;
          published_at?: string;
          deadline?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      job_analysis: {
        Row: {
          id: string;
          job_id: string;
          english_status: EnglishStatus;
          portuguese_required: boolean;
          portuguese_level: PortugueseLevel;
          brazil_eligible: boolean;
          remote_eligible: boolean;
          job_category: string;
          experience_level: string;
          salary_detected: boolean;
          salary_min: number | null;
          salary_max: number | null;
          salary_currency: string | null;
          compatibility_score: number;
          confidence: number;
          reason: string;
          raw_ai_response: Json | null;
          analysis_version: string;
          analyzed_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          english_status: EnglishStatus;
          portuguese_required?: boolean;
          portuguese_level?: PortugueseLevel;
          brazil_eligible?: boolean;
          remote_eligible?: boolean;
          job_category?: string;
          experience_level?: string;
          salary_detected?: boolean;
          salary_min?: number | null;
          salary_max?: number | null;
          salary_currency?: string | null;
          compatibility_score?: number;
          confidence?: number;
          reason: string;
          raw_ai_response?: Json | null;
          analysis_version?: string;
          analyzed_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          english_status?: EnglishStatus;
          portuguese_required?: boolean;
          portuguese_level?: PortugueseLevel;
          brazil_eligible?: boolean;
          remote_eligible?: boolean;
          job_category?: string;
          experience_level?: string;
          salary_detected?: boolean;
          salary_min?: number | null;
          salary_max?: number | null;
          salary_currency?: string | null;
          compatibility_score?: number;
          confidence?: number;
          reason?: string;
          raw_ai_response?: Json | null;
          analysis_version?: string;
          analyzed_at?: string;
        };
      };
      source_logs: {
        Row: {
          id: string;
          platform_id: string;
          started_at: string;
          finished_at: string | null;
          status: string;
          jobs_found: number;
          jobs_new: number;
          jobs_updated: number;
          jobs_rejected: number;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          platform_id: string;
          started_at?: string;
          finished_at?: string | null;
          status: string;
          jobs_found?: number;
          jobs_new?: number;
          jobs_updated?: number;
          jobs_rejected?: number;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          platform_id?: string;
          started_at?: string;
          finished_at?: string | null;
          status?: string;
          jobs_found?: number;
          jobs_new?: number;
          jobs_updated?: number;
          jobs_rejected?: number;
          error_message?: string | null;
        };
      };
      job_history: {
        Row: {
          id: string;
          job_id: string;
          event_type: string;
          old_status: JobStatus | null;
          new_status: JobStatus | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          event_type: string;
          old_status?: JobStatus | null;
          new_status?: JobStatus | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          event_type?: string;
          old_status?: JobStatus | null;
          new_status?: JobStatus | null;
          created_at?: string;
        };
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          job_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          job_id?: string;
          created_at?: string;
        };
      };
    };
  };
}
