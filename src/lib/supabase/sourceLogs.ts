import { supabase, isSupabaseConfigured } from './client';

export interface SourceLogItem {
  id?: string;
  platform_slug: string;
  platform_id?: string | null;
  started_at?: string;
  finished_at?: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  jobs_found: number;
  jobs_new?: number;
  jobs_updated?: number;
  jobs_rejected?: number;
  error_message?: string | null;
}

/**
 * Carrega histórico recente da tabela source_logs
 */
export async function loadSourceLogsFromSupabase(): Promise<SourceLogItem[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await (supabase
      .from('source_logs') as any)
      .select('*')
      .order('finished_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('[Supabase SourceLogs] Erro ao carregar logs:', error.message);
      return [];
    }

    return (data || []) as SourceLogItem[];
  } catch (err: any) {
    console.warn('[Supabase SourceLogs] Falha ao consultar:', err?.message);
    return [];
  }
}

/**
 * Registra uma entrada na tabela source_logs com compatibilidade de schema (platform_slug ou platform_id)
 */
export async function recordSourceLogInSupabase(log: SourceLogItem): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    // 1. Tenta obter platform_id caso a tabela exija UUID
    let platformId: string | null = log.platform_id || null;
    if (!platformId) {
      try {
        const { data: pData } = await supabase
          .from('platforms')
          .select('id')
          .eq('slug', log.platform_slug.toLowerCase())
          .limit(1)
          .maybeSingle();
        if (pData && (pData as any).id) {
          platformId = (pData as any).id;
        }
      } catch {}
    }

    const payload: Record<string, any> = {
      platform_slug: log.platform_slug.toLowerCase(),
      status: log.status,
      jobs_found: log.jobs_found,
      jobs_new: log.jobs_new || 0,
      jobs_updated: log.jobs_updated || 0,
      jobs_rejected: log.jobs_rejected || 0,
      error_message: log.error_message || null,
      started_at: log.started_at || new Date(Date.now() - 5000).toISOString(),
      finished_at: log.finished_at || new Date().toISOString()
    };

    if (platformId) {
      payload.platform_id = platformId;
    }

    // Tenta inserção com todos os campos
    let { error } = await (supabase.from('source_logs') as any).insert(payload);

    // Se falhar porque não tem platform_slug, tenta com platform_id
    if (error && error.message?.includes('platform_slug') && platformId) {
      delete payload.platform_slug;
      const res2 = await (supabase.from('source_logs') as any).insert(payload);
      error = res2.error;
    }

    if (error) {
      console.warn('[Supabase SourceLogs] Aviso ao registrar log:', error.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[Supabase SourceLogs] Falha inesperada:', err?.message);
    return false;
  }
}

/**
 * Semeia logs de telemetria iniciais para todas as plataformas de coleta
 */
export async function seedInitialSourceLogsToSupabase(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const platforms = [
    { slug: 'welocalize', name: 'Welocalize', found: 42, count: 12 },
    { slug: 'outlier', name: 'Outlier.ai', found: 38, count: 15 },
    { slug: 'turing', name: 'Turing', found: 25, count: 8 },
    { slug: 'oneforma', name: 'OneForma', found: 19, count: 6 },
    { slug: 'clickworker', name: 'Clickworker', found: 15, count: 4 },
    { slug: 'alignerr', name: 'Alignerr', found: 10, count: 5 }
  ];

  let inserted = 0;
  for (const p of platforms) {
    const success = await recordSourceLogInSupabase({
      platform_slug: p.slug,
      status: 'SUCCESS',
      jobs_found: p.found,
      jobs_new: p.count,
      jobs_updated: p.found - p.count,
      started_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      finished_at: new Date().toISOString()
    });
    if (success) inserted++;
  }

  return inserted;
}
