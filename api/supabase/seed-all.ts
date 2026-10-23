import { getSupabaseServerClient } from '../../src/lib/supabase/server';
import { INITIAL_PLATFORMS } from '../../src/data/initialPlatforms';
import { DEFAULT_BLOCKED_KEYWORDS } from '../../src/services/blockedKeywordsService';
import LIVE_JOBS_RAW from '../../src/data/liveCuratedJobs.json';

function generateHash(text: string): string {
  if (!text) return '0'.repeat(64);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (hex1 + hex2).repeat(4).substring(0, 64);
}

export default async function handler(req: any, res: any) {
  try {
    let supabase: any;
    try {
      supabase = getSupabaseServerClient();
    } catch (e: any) {
      return res.status(400).json({
        success: false,
        error: 'Supabase não está configurado nas variáveis de ambiente do servidor.',
        details: e.message
      });
    }

    const report = {
      platforms: 0,
      blocked_keywords: 0,
      jobs: 0,
      job_analysis: 0,
      job_applications: 0,
      source_logs: 0,
      job_history: 0
    };

    // 1. Semeia platforms
    for (const p of INITIAL_PLATFORMS) {
      const row = {
        name: p.name,
        slug: p.id.toLowerCase(),
        website_url: p.websiteUrl || 'https://example.com',
        jobs_url: p.careersUrl || p.websiteUrl || 'https://example.com',
        category: p.category || 'Geral',
        currency: p.currency || 'USD',
        english_requirement: p.englishRequirement || 'READING_ONLY',
        process_type: p.processType || 'ONLINE_EXAM',
        user_status: p.userStatus || 'NOT_REGISTERED',
        notes: p.notes || '',
        status: p.status === 'BLACKLIST' ? 'DISABLED' : (p.status === 'FAVORITE' ? 'FAVORITE' : 'HEALTHY'),
        enabled: p.status !== 'BLACKLIST',
        average_pay_rate: p.averagePayRate || null,
        payment_methods: p.paymentMethods || [],
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('platforms').upsert(row, { onConflict: 'slug' });
      if (!error) report.platforms++;
    }

    // 2. Semeia blocked_keywords
    for (const term of DEFAULT_BLOCKED_KEYWORDS) {
      const { error } = await supabase
        .from('blocked_keywords')
        .upsert({ term, category: 'IDIOMA_ESTRANGEIRO' }, { onConflict: 'term' });
      if (!error) report.blocked_keywords++;
    }

    // Obtém mapa de plataformas cadastradas
    const { data: plats } = await supabase.from('platforms').select('id, slug');
    const platformMap = new Map<string, string>();
    let fallbackPlatformId: string | null = null;
    if (plats && plats.length > 0) {
      plats.forEach((p: any) => platformMap.set(p.slug.toLowerCase(), p.id));
      fallbackPlatformId = plats[0].id;
    }

    // 3. Remove quaisquer vagas legadas fabricadas/fictícias que possam existir no banco
    try {
      await supabase
        .from('jobs')
        .delete()
        .or('external_id.ilike.welo-%,external_id.ilike.outlier-%,external_id.ilike.turing-%,external_id.ilike.app-%,external_id.ilike.align-%,external_id.ilike.one-%,external_id.ilike.click-%,external_id.ilike.data-%,external_id.ilike.mercor-%,external_id.ilike.%-dynamic-%');
    } catch {}

    // 4. Semeia apenas vagas reais verificadas
    const allRaw = (LIVE_JOBS_RAW as any[]) || [];

    const seenIds = new Set<string>();
    const insertedJobIds: string[] = [];

    for (const job of allRaw) {
      if (seenIds.has(job.external_id)) continue;
      seenIds.add(job.external_id);

      const slug = (job.platform_slug || 'welocalize').toLowerCase();
      const pId = platformMap.get(slug) || fallbackPlatformId;
      const hash = generateHash(job.description || job.title);

      const jobPayload: Record<string, any> = {
        external_id: job.external_id,
        platform_slug: slug,
        title: job.title,
        company: job.company,
        url: job.url,
        canonical_url: job.canonical_url || job.url,
        source_url: job.source_url || job.url,
        description: job.description || '',
        description_hash: hash,
        country: job.country || 'Brasil',
        location: job.location || 'Remoto',
        remote: job.remote ?? true,
        employment_type: job.employment_type || 'Freelance',
        salary_min: job.salary_min || null,
        salary_max: job.salary_max || null,
        salary_currency: job.salary_currency || 'USD',
        status: 'ACTIVE',
        published_at: job.published_at || new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (pId) jobPayload.platform_id = pId;

      // Upsert resiliente
      let { data: inserted, error: jErr } = await supabase
        .from('jobs')
        .upsert(jobPayload, { onConflict: 'platform_slug,external_id' })
        .select('id')
        .maybeSingle();

      if (jErr && pId) {
        // Tenta com constraint antiga por platform_id, external_id
        const retry = await supabase
          .from('jobs')
          .upsert(jobPayload, { onConflict: 'platform_id,external_id' })
          .select('id')
          .maybeSingle();
        if (!retry.error && retry.data) {
          inserted = retry.data;
          jErr = null;
        }
      }

      if (inserted && inserted.id) {
        report.jobs++;
        insertedJobIds.push(inserted.id);

        if (job.analysis) {
          const a = job.analysis;
          let engStatus = a.english_status || 'NONE';
          if (engStatus === 'READING_ONLY') engStatus = 'PARTIAL';

          const analysisPayload = {
            job_id: inserted.id,
            external_id: job.external_id,
            english_status: engStatus,
            portuguese_required: a.portuguese_required ?? true,
            portuguese_level: a.portuguese_level || 'NATIVE',
            brazil_eligible: a.brazil_eligible ?? true,
            remote_eligible: a.remote_eligible ?? true,
            job_category: a.job_category || 'AI',
            experience_level: a.experience_level || 'ENTRY',
            compatibility_score: a.compatibility_score || 90,
            confidence: a.confidence || 85,
            reason: a.reason || 'Curadoria automática'
          };

          const { error: aErr } = await supabase
            .from('job_analysis')
            .upsert(analysisPayload, { onConflict: 'job_id' });

          if (!aErr) report.job_analysis++;
        }
      }
    }

    // 4. Semeia job_applications
    for (const p of INITIAL_PLATFORMS) {
      const appPayload = {
        platform_slug: p.id.toLowerCase(),
        platform_name: p.name,
        status: p.userStatus || 'NOT_REGISTERED',
        notes: p.notes || '',
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('job_applications').insert(appPayload);
      if (!error) report.job_applications++;
    }

    // 5. Semeia source_logs
    for (const p of INITIAL_PLATFORMS.slice(0, 8)) {
      const pId = platformMap.get(p.id.toLowerCase()) || fallbackPlatformId;
      const logPayload: Record<string, any> = {
        platform_slug: p.id.toLowerCase(),
        status: 'SUCCESS',
        jobs_found: 15,
        jobs_new: 5,
        started_at: new Date(Date.now() - 60000).toISOString(),
        finished_at: new Date().toISOString()
      };
      if (pId) logPayload.platform_id = pId;
      const { error } = await supabase.from('source_logs').insert(logPayload);
      if (!error) report.source_logs++;
    }

    // 6. Semeia job_history
    for (const jId of insertedJobIds.slice(0, 15)) {
      const histPayload = {
        job_id: jId,
        event_type: 'INITIAL_INGESTION',
        new_status: 'ACTIVE',
        created_at: new Date().toISOString()
      };
      const { error } = await supabase.from('job_history').insert(histPayload);
      if (!error) report.job_history++;
    }

    // 7. Semeia app_security
    try {
      await supabase.from('app_security').upsert({
        id: 'master',
        password_hash: '192bcc1a8bc3afe968156bb13230e482fa6fbc1858a6f5b07da8665ee997fc26',
        hint: 'Senha Master (Padrão: remote2026)',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'Todas as tabelas do Supabase foram sincronizadas com sucesso!',
      report,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro inesperado na sincronização'
    });
  }
}
