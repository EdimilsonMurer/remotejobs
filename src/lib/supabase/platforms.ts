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
    status: p.status === 'BLACKLIST' ? 'DISABLED' : (p.status === 'FAVORITE' ? 'FAVORITE' : 'HEALTHY'),
    enabled: p.status !== 'BLACKLIST',
    average_pay_rate: p.averagePayRate || null,
    payment_methods: p.paymentMethods || [],
    updated_at: new Date().toISOString()
  };
}

/**
 * Converte linha do Supabase de volta para o modelo Platform
 */
export function databaseRowToPlatform(row: any, fallback?: Platform): Platform {
  const isRowDisabled = row.status === 'DISABLED' || row.status === 'BLACKLIST';
  const isRowFavorite = row.status === 'FAVORITE';
  const isRowHealthy = row.status === 'HEALTHY' || row.status === 'ACTIVE';

  let status: PlatformStatus = 'ACTIVE';
  if (isRowDisabled) {
    status = 'BLACKLIST';
  } else if (isRowFavorite) {
    status = 'FAVORITE';
  } else if (isRowHealthy) {
    status = 'ACTIVE';
  } else if (fallback?.status) {
    status = fallback.status;
  }

  return {
    id: row.slug || fallback?.id || row.id,
    name: row.name || fallback?.name || 'Plataforma',
    websiteUrl: row.website_url || fallback?.websiteUrl || '',
    careersUrl: row.jobs_url || fallback?.careersUrl || '',
    category: row.category || fallback?.category || 'Treinamento de IA',
    currency: (row.currency as any) || fallback?.currency || 'USD',
    englishRequirement: (row.english_requirement as any) || fallback?.englishRequirement || 'READING_ONLY',
    processType: (row.process_type as any) || fallback?.processType || 'ONLINE_EXAM',
    status,
    blacklistReason: status === 'BLACKLIST' 
      ? (row.blacklist_reason || fallback?.blacklistReason || 'Plataforma adicionada à lista negra') 
      : undefined,
    paymentMethods: row.payment_methods || fallback?.paymentMethods || [],
    notes: row.notes !== undefined && row.notes !== null ? row.notes : (fallback?.notes || ''),
    averagePayRate: row.average_pay_rate || fallback?.averagePayRate,
    userStatus: (row.user_status as UserAccountStatus) || fallback?.userStatus || 'NOT_REGISTERED',
    updatedAt: row.updated_at || fallback?.updatedAt
  };
}

/**
 * Executa uma operação no Supabase com remoção automática de colunas não encontradas no schema cache.
 * Isso garante que mesmo que o banco Supabase do usuário ainda não tenha recebido a migração
 * com colunas novas (ex: 'average_pay_rate', 'payment_methods', 'notes'), as plataformas continuem sendo salvas!
 */
async function executeWithSchemaFallback(
  operation: (payload: Record<string, any>) => Promise<{ data?: any; error?: any }>,
  initialPayload: Record<string, any>
): Promise<{ success: boolean; error?: string; removedColumns: string[] }> {
  const currentPayload = { ...initialPayload };
  const removedColumns: string[] = [];

  for (let attempt = 0; attempt < 10; attempt++) {
    const { error } = await operation(currentPayload);

    if (!error) {
      return { success: true, removedColumns };
    }

    const msg = error.message || '';
    // Padrão PostgREST: "Could not find the 'average_pay_rate' column of 'platforms' in the schema cache"
    const match = msg.match(/Could not find the '([^']+)' column/i);

    if (match && match[1] && currentPayload.hasOwnProperty(match[1])) {
      const col = match[1];
      console.warn(`[Supabase] Coluna '${col}' ausente no schema cache do Supabase. Removendo do envio e tentando novamente...`);
      delete currentPayload[col];
      removedColumns.push(col);
      continue;
    }

    return { success: false, error: msg, removedColumns };
  }

  return { success: false, error: 'Muitas colunas ausentes no schema do Supabase.', removedColumns };
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

    // Busca segura por slug ou nome sem quebrar caracteres especiais
    let existing: any = null;
    try {
      const { data, error } = await (supabase
        .from('platforms') as any)
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (!error && data) {
        existing = data;
      } else {
        const { data: byName } = await (supabase
          .from('platforms') as any)
          .select('id')
          .eq('name', platform.name)
          .maybeSingle();
        if (byName) existing = byName;
      }
    } catch (e: any) {
      console.warn('[Supabase] Aviso ao buscar plataforma existente:', e?.message);
    }

    let resultError: string | undefined;
    let removedCols: string[] = [];

    if (existing && existing.id) {
      const updatePayload: Record<string, any> = {
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
        enabled: row.enabled,
        average_pay_rate: row.average_pay_rate,
        payment_methods: row.payment_methods,
        updated_at: row.updated_at
      };

      const res = await executeWithSchemaFallback(
        (p) => (supabase.from('platforms') as any).update(p).eq('id', existing.id),
        updatePayload
      );
      if (!res.success) resultError = res.error;
      removedCols = res.removedColumns;
    } else {
      const insertPayload: Record<string, any> = { ...row };

      const res = await executeWithSchemaFallback(
        (p) => (supabase.from('platforms') as any).insert(p),
        insertPayload
      );
      if (!res.success) resultError = res.error;
      removedCols = res.removedColumns;
    }

    if (resultError) {
      console.error(`[Supabase] Erro ao salvar plataforma "${platform.name}":`, resultError);
      return { success: false, message: resultError, fromSupabase: false };
    }

    console.log(`✅ [Supabase] Plataforma "${platform.name}" sincronizada com sucesso!`);
    return { 
      success: true, 
      message: removedCols.length > 0 
        ? `Salvo no Supabase! (Colunas omitidas: ${removedCols.join(', ')})` 
        : 'Salvo com sucesso no Supabase!', 
      fromSupabase: true 
    };
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
  // 1. Obtém lista atual do localStorage como fallback
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

    if (error) {
      console.warn('[Supabase] Erro na consulta de plataformas:', error.message);
      return localList;
    }

    // Se o Supabase possui registros, o Supabase é a fonte da verdade oficial!
    if (data && data.length > 0) {
      const dbPlatforms: Platform[] = data.map((row: any) => {
        const slug = (row.slug || '').toLowerCase();
        const fallback = INITIAL_PLATFORMS.find(
          p => p.id.toLowerCase() === slug || p.name.toLowerCase() === (row.name || '').toLowerCase()
        );
        return databaseRowToPlatform(row, fallback);
      });

      // Atualiza o cache local para refletir exatamente o banco de dados
      try {
        localStorage.setItem('remotehunter_platforms_v1', JSON.stringify(dbPlatforms));
      } catch {}

      return dbPlatforms;
    }

    // Se o banco de dados estiver vazio (0 plataformas), faz semeadura inicial
    if (data && data.length === 0) {
      console.log('🌱 [Supabase] Semeando plataformas iniciais no Supabase...');
      syncAllPlatformsToSupabase(INITIAL_PLATFORMS).catch(() => {});
    }

    return localList;
  } catch (err) {
    console.warn('[Supabase] Falha ao carregar plataformas, usando fallback local:', err);
    return localList;
  }
}

/**
 * Remove uma plataforma do Supabase e do cache local
 */
export async function deletePlatformFromSupabase(platformIdOrSlug: string): Promise<boolean> {
  const slug = platformIdOrSlug.toLowerCase();

  // 1. Remove do localStorage imediatamente
  try {
    const saved = localStorage.getItem('remotehunter_platforms_v1');
    if (saved) {
      const parsed: Platform[] = JSON.parse(saved);
      const filtered = parsed.filter(p => p.id.toLowerCase() !== slug && p.id !== platformIdOrSlug);
      localStorage.setItem('remotehunter_platforms_v1', JSON.stringify(filtered));
    }
  } catch {}

  if (!isSupabaseConfigured()) return true;

  // 2. Remove do Supabase
  try {
    await supabase.from('platforms').delete().or(`slug.eq.${slug},id.eq.${platformIdOrSlug}`);
    return true;
  } catch (err) {
    console.warn('[Supabase] Erro ao deletar plataforma:', err);
    return false;
  }
}
