import { supabase, isSupabaseConfigured } from './client';
import { Platform, UserAccountStatus } from '../../types/job';
import { INITIAL_PLATFORMS } from '../../data/initialPlatforms';

export interface ApplicationRecord {
  id?: string;
  platform_slug: string;
  platform_name: string;
  job_external_id?: string | null;
  job_title?: string | null;
  status: UserAccountStatus | string;
  notes?: string;
  applied_at?: string;
  updated_at?: string;
}

/**
 * Carrega o histórico de candidaturas gravadas na tabela job_applications do Supabase
 */
export async function loadJobApplicationsFromSupabase(): Promise<ApplicationRecord[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await (supabase
      .from('job_applications') as any)
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('[Supabase Applications] Erro ao carregar candidaturas:', error.message);
      return [];
    }

    return (data || []) as ApplicationRecord[];
  } catch (err: any) {
    console.warn('[Supabase Applications] Falha na consulta:', err?.message);
    return [];
  }
}

/**
 * Salva ou atualiza uma candidatura na tabela job_applications do Supabase
 */
export async function saveJobApplicationToSupabase(record: ApplicationRecord): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return true;
  }

  try {
    const payload = {
      platform_slug: record.platform_slug.toLowerCase(),
      platform_name: record.platform_name,
      job_external_id: record.job_external_id || null,
      job_title: record.job_title || null,
      status: record.status,
      notes: record.notes || '',
      applied_at: record.applied_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Tenta atualizar se já existe por platform_slug
    const { data: existing } = await (supabase
      .from('job_applications') as any)
      .select('id')
      .eq('platform_slug', payload.platform_slug)
      .limit(1)
      .maybeSingle();

    if (existing && existing.id) {
      await (supabase.from('job_applications') as any)
        .update(payload)
        .eq('id', existing.id);
    } else {
      await (supabase.from('job_applications') as any)
        .insert(payload);
    }

    return true;
  } catch (err: any) {
    console.warn('[Supabase Applications] Erro ao salvar candidatura:', err?.message);
    return false;
  }
}

/**
 * Semeia o acompanhamento inicial das plataformas na tabela job_applications do Supabase
 */
export async function seedInitialApplicationsToSupabase(platformsList?: Platform[]): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const targetList = platformsList && platformsList.length > 0 ? platformsList : INITIAL_PLATFORMS;
  let seeded = 0;

  for (const plat of targetList) {
    const success = await saveJobApplicationToSupabase({
      platform_slug: plat.id.toLowerCase(),
      platform_name: plat.name,
      status: plat.userStatus || 'NOT_REGISTERED',
      notes: plat.notes || `Acompanhamento de cadastro na plataforma ${plat.name}`,
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    if (success) seeded++;
  }

  return seeded;
}
