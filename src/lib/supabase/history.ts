import { supabase, isSupabaseConfigured } from './client';

export interface JobHistoryRecord {
  id?: string;
  job_id: string;
  event_type: string;
  old_status?: string | null;
  new_status?: string | null;
  created_at?: string;
}

/**
 * Registra um evento no histórico de vagas (job_history)
 */
export async function recordJobHistoryToSupabase(record: JobHistoryRecord): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const payload = {
      job_id: record.job_id,
      event_type: record.event_type || 'STATUS_UPDATE',
      old_status: record.old_status || null,
      new_status: record.new_status || 'ACTIVE',
      created_at: record.created_at || new Date().toISOString()
    };

    const { error } = await (supabase.from('job_history') as any).insert(payload);
    if (error) {
      console.warn('[Supabase JobHistory] Erro ao registrar histórico:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[Supabase JobHistory] Falha inesperada:', err?.message);
    return false;
  }
}

/**
 * Semeia eventos de histórico inicial para as vagas salvas no Supabase
 */
export async function seedInitialJobHistoryToSupabase(jobIds: string[]): Promise<number> {
  if (!isSupabaseConfigured() || !jobIds || jobIds.length === 0) return 0;

  let count = 0;
  // Semeia para uma amostra representativa de vagas
  const sample = jobIds.slice(0, 20);

  for (const jId of sample) {
    const ok = await recordJobHistoryToSupabase({
      job_id: jId,
      event_type: 'JOB_INGESTION_AND_CLASSIFICATION',
      old_status: null,
      new_status: 'ACTIVE'
    });
    if (ok) count++;
  }

  return count;
}
