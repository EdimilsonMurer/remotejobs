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
    const list: Platform[] = saved ? JSON.parse(saved) : [...INITIAL_PLATFORMS];
    const targetSlug = platform.id.toLowerCase();
    const targetName = platform.name.trim().toLowerCase();
    const idx = list.findIndex(p => p.id.toLowerCase() === targetSlug || p.name.trim().toLowerCase() === targetName);
    if (idx >= 0) {
      list[idx] = platform;
    } else {
      list.unshift(platform);
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
          name: row.name,
          notes: row.notes,
          user_status: row.user_status,
          website_url: row.website_url,
          jobs_url: row.jobs_url,
          category: row.category,
          currency: row.currency,
          english_requirement: row.english_requirement,
          process_type: row.process_type,
          status: row.status,
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

    console.log(`✅ [Supabase] Plataforma "${platform.name}" sincronizada com sucesso!`);
    return { success: true, message: 'Salvo com sucesso no Supabase!', fromSupabase: true };
  } catch (err: any) {
    console.error('[Supabase] Erro na sincronização:', err?.message);
    return { success: false, message: err?.message, fromSupabase: false };
  }
}

/**
 * Sincroniza em lote TODAS as plataformas do app diretamente para o Supabase
 */
export async function syncAllPlatformsToSupabase(platformsToSync?: Platform[]): Promise<{
  success: boolean;
  totalSynced: number;
  totalAttempted: number;
  message: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      totalSynced: 0,
      totalAttempted: 0,
      message: 'Supabase não está configurado. Por favor, insira a URL e a Chave Anônima do Supabase nas Configurações.'
    };
  }

  let list: Platform[] = platformsToSync || [];
  if (!list || list.length === 0) {
    try {
      const saved = localStorage.getItem('remotehunter_platforms_v1');
      list = saved ? JSON.parse(saved) : INITIAL_PLATFORMS;
    } catch {
      list = INITIAL_PLATFORMS;
    }
  }

  let syncedCount = 0;
  let lastError = '';

  for (const plat of list) {
    const res = await savePlatformToSupabase(plat);
    if (res.success && res.fromSupabase) {
      syncedCount++;
    } else if (res.message) {
      lastError = res.message;
    }
  }

  if (syncedCount > 0) {
    return {
      success: true,
      totalSynced: syncedCount,
      totalAttempted: list.length,
      message: `${syncedCount} de ${list.length} plataforma(s) gravadas e sincronizadas com sucesso na tabela "platforms" do Supabase!`
    };
  }

  return {
    success: false,
    totalSynced: 0,
    totalAttempted: list.length,
    message: lastError ? `Erro ao gravar no Supabase: ${lastError}` : 'Não foi possível enviar as plataformas para o Supabase.'
  };
}

/**
 * Carrega a lista de plataformas do Supabase ou utiliza os valores locais
 */
export async function loadPlatformsFromSupabase(): Promise<Platform[]> {
  // 1. Obtém lista atual do localStorage
  let localList: Platform[] = [...INITIAL_PLATFORMS];
  try {
    const saved = localStorage.getItem('remotehunter_platforms_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localList = parsed;
      }
    }
  } catch (err) {
    console.warn('[Storage] Erro ao ler plataformas do localStorage:', err);
  }

  if (!isSupabaseConfigured()) {
    return localList;
  }

  try {
    const { data, error } = await supabase
      .from('platforms')
      .select('*')
      .order('name', { ascending: true });

    if (error || !data || data.length === 0) {
      return localList;
    }

    // 2. Mescla os dados remotos mantendo TODAS as plataformas (sem apagar novas cadastradas localmente)
    const mergedMap = new Map<string, Platform>();

    // Inicializa com as locais
    localList.forEach(p => {
      mergedMap.set(p.id.toLowerCase(), p);
    });

    // Atualiza ou insere do Supabase
    data.forEach((row: any) => {
      const slug = (row.slug || '').toLowerCase();
      const existingFallback = mergedMap.get(slug) || localList.find(p => p.name.toLowerCase() === row.name?.toLowerCase());
      const converted = databaseRowToPlatform(row, existingFallback);
      mergedMap.set(converted.id.toLowerCase(), converted);
    });

    const result = Array.from(mergedMap.values());
    try {
      localStorage.setItem('remotehunter_platforms_v1', JSON.stringify(result));
    } catch {}

    return result;
  } catch (err) {
    console.warn('[Supabase] Falha ao carregar plataformas, usando fallback local:', err);
    return localList;
  }
}
