import { supabase, isSupabaseConfigured } from './client';
import { Platform, UserAccountStatus, PlatformStatus } from '../../types/job';
import { INITIAL_PLATFORMS } from '../../data/initialPlatforms';

/**
 * Converte modelo interno de Platform para o formato do banco de dados Supabase
 */
export function platformToDatabaseRow(p: Platform) {
  return {
    name: p.name,
    slug: p.id.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    website_url: p.websiteUrl || 'https://example.com',
    jobs_url: p.careersUrl || p.websiteUrl || 'https://example.com',
    notes: p.notes || '',
    user_status: p.userStatus || 'NOT_REGISTERED',
    category: p.category || 'Geral',
    currency: p.currency || 'USD',
    english_requirement: p.englishRequirement || 'READING_ONLY',
    process_type: p.processType || 'ONLINE_EXAM',
    status: p.status === 'BLACKLIST' ? 'DISABLED' : 'HEALTHY',
    average_pay_rate: p.averagePayRate || null,
    payment_methods: p.paymentMethods || [],
    updated_at: new Date().toISOString()
  };
}

/**
 * Converte linha do Supabase de volta para o modelo Platform
 */
export function databaseRowToPlatform(row: any, fallback?: Platform): Platform {
  return {
    id: row.slug || fallback?.id || row.id,
    name: row.name || fallback?.name || 'Plataforma',
    websiteUrl: row.website_url || fallback?.websiteUrl || '',
    careersUrl: row.jobs_url || fallback?.careersUrl || '',
    category: row.category || fallback?.category || 'Treinamento de IA',
    currency: (row.currency as any) || fallback?.currency || 'USD',
    englishRequirement: (row.english_requirement as any) || fallback?.englishRequirement || 'READING_ONLY',
    processType: (row.process_type as any) || fallback?.processType || 'ONLINE_EXAM',
    status: row.status === 'DISABLED' ? 'BLACKLIST' : (fallback?.status || 'ACTIVE'),
    blacklistReason: fallback?.blacklistReason,
    paymentMethods: row.payment_methods || fallback?.paymentMethods || [],
    notes: row.notes !== undefined && row.notes !== null ? row.notes : (fallback?.notes || ''),
    averagePayRate: row.average_pay_rate || fallback?.averagePayRate,
    userStatus: (row.user_status as UserAccountStatus) || fallback?.userStatus || 'NOT_REGISTERED',
    updatedAt: row.updated_at || fallback?.updatedAt
  };
}

/**
 * Salva ou atualiza uma plataforma e suas observações diretamente no Supabase
 */
export async function savePlatformToSupabase(platform: Platform): Promise<{ success: boolean; message?: string; fromSupabase: boolean }> {
  // Salva no localStorage como cache local de alta performance
  try {
    const saved = localStorage.getItem('remotehunter_platforms_v1');
    const list: Platform[] = saved ? JSON.parse(saved) : INITIAL_PLATFORMS;
    const idx = list.findIndex(p => p.id === platform.id || p.name.toLowerCase() === platform.name.toLowerCase());
    if (idx >= 0) {
      list[idx] = platform;
    } else {
      list.push(platform);
    }
    localStorage.setItem('remotehunter_platforms_v1', JSON.stringify(list));
  } catch (err) {
    console.warn('[Storage] Falha ao salvar em cache local:', err);
  }

  // Se Supabase não estiver conectado no ambiente atual
  if (!isSupabaseConfigured()) {
    return {
      success: true,
      message: 'Salvo em cache local (Supabase não configurado neste ambiente)',
      fromSupabase: false
    };
  }

  try {
    const row = platformToDatabaseRow(platform);
    const slug = row.slug;

    // Tenta atualizar pelo slug ou nome
    const { data: existing, error: findError } = await (supabase
      .from('platforms') as any)
      .select('id')
      .or(`slug.eq.${slug},name.eq.${platform.name}`)
      .maybeSingle();

    if (findError) {
      console.warn('[Supabase] Erro ao buscar plataforma:', findError.message);
    }

    if (existing && existing.id) {
      const { error: updateError } = await (supabase
        .from('platforms') as any)
        .update({
          notes: row.notes,
          user_status: row.user_status,
          website_url: row.website_url,
          jobs_url: row.jobs_url,
          category: row.category,
          currency: row.currency,
          average_pay_rate: row.average_pay_rate,
          payment_methods: row.payment_methods,
          updated_at: row.updated_at
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('[Supabase] Erro ao atualizar no Supabase:', updateError.message);
        return { success: false, message: updateError.message, fromSupabase: false };
      }
    } else {
      const { error: insertError } = await (supabase
        .from('platforms') as any)
        .insert(row);

      if (insertError) {
        console.error('[Supabase] Erro ao inserir no Supabase:', insertError.message);
        return { success: false, message: insertError.message, fromSupabase: false };
      }
    }

    console.log(`✅ [Supabase] Plataforma "${platform.name}" e observações sincronizadas com sucesso no banco de dados!`);
    return { success: true, message: 'Salvo com sucesso no Supabase!', fromSupabase: true };
  } catch (err: any) {
    console.error('[Supabase] Erro na sincronização:', err.message);
    return { success: false, message: err.message, fromSupabase: false };
  }
}

/**
 * Carrega a lista de plataformas do Supabase ou utiliza os valores iniciais
 */
export async function loadPlatformsFromSupabase(): Promise<Platform[]> {
  if (!isSupabaseConfigured()) {
    try {
      const saved = localStorage.getItem('remotehunter_platforms_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_PLATFORMS;
  }

  try {
    const { data, error } = await supabase
      .from('platforms')
      .select('*')
      .order('name', { ascending: true });

    if (error || !data || data.length === 0) {
      console.log('[Supabase] Sem plataformas remotas. Utilizando dados iniciais e sincronizando...');
      return INITIAL_PLATFORMS;
    }

    // Mescla com plataformas iniciais
    return INITIAL_PLATFORMS.map(initP => {
      const found = data.find((d: any) => d.slug === initP.id || d.name?.toLowerCase() === initP.name?.toLowerCase());
      if (found) {
        return databaseRowToPlatform(found, initP);
      }
      return initP;
    });
  } catch (err) {
    console.warn('[Supabase] Falha ao carregar plataformas, usando fallback local:', err);
    return INITIAL_PLATFORMS;
  }
}
