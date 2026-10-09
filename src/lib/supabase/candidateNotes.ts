import { supabase, isSupabaseConfigured } from './client';

export interface CustomSnippet {
  id: string;
  title: string;
  content: string;
  category?: string;
}

export interface CandidateProfileData {
  id?: string;
  user_id?: string | null;
  // Informações Pessoais
  full_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  // Links & Currículo
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  resume_url: string;
  resume_en_url: string;
  // Valores & Disponibilidade
  hourly_rate_usd: string;
  monthly_salary_usd: string;
  availability: string;
  hours_per_week: string;
  // Pagamento & Faturamento
  payment_paypal: string;
  payment_payoneer: string;
  payment_deel: string;
  payment_wise: string;
  tax_id: string; // CPF / CNPJ / ID Fiscal
  // Textos Prontos & Pitches
  short_bio_pt: string;
  short_bio_en: string;
  cover_letter_pt: string;
  cover_letter_en: string;
  ai_experience_en: string;
  english_level_statement: string;
  hardware_specs: string;
  // Bloco de Notas Livre & Snippets
  free_notes: string;
  custom_snippets: CustomSnippet[];
  created_at?: string;
  updated_at?: string;
}

export const STORAGE_KEY_CANDIDATE_NOTES = 'remotehunter_candidate_notes_v1';

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfileData = {
  full_name: '',
  email: '',
  phone: '',
  city: 'São Paulo',
  state: 'SP',
  country: 'Brasil',
  timezone: 'America/Sao_Paulo (UTC-3)',
  linkedin_url: '',
  github_url: '',
  portfolio_url: '',
  resume_url: '',
  resume_en_url: '',
  hourly_rate_usd: '$15.00/h',
  monthly_salary_usd: '$2,500.00',
  availability: 'Imediata (Immediate)',
  hours_per_week: '40h/semana (Full-time)',
  payment_paypal: '',
  payment_payoneer: '',
  payment_deel: '',
  payment_wise: '',
  tax_id: '',
  short_bio_pt: 'Profissional com sólida experiência em avaliação de modelos de linguagem (RLHF), anotação de dados, tradução técnica e garantia de qualidade de conteúdo para grandes plataformas internacionais de IA.',
  short_bio_en: 'Native Brazilian Portuguese speaker with extensive background in LLM evaluation, RLHF, prompt engineering, data annotation, and content localization for global AI companies.',
  cover_letter_pt: 'Prezada equipe de recrutamento,\n\nGostaria de submeter minha candidatura para a oportunidade. Possuo experiência prática com tarefas de avaliação de modelos de IA, refinamento de respostas, tradução e anotação semântica com foco em acurácia e seguimento estrito de guidelines. Possuo excelente domínio da língua portuguesa e proficiência em inglês para leitura e cumprimento de diretrizes técnicas.\n\nEstou disponível para início imediato e tenho total flexibilidade para atender à demanda de projetos remotos.\n\nAtenciosamente,',
  cover_letter_en: 'Dear Hiring Team,\n\nI am writing to express my strong interest in this remote opportunity. As a native Portuguese speaker with fluency in English, I have proven experience evaluating Large Language Models (LLMs), executing RLHF tasks, quality assessment, and following complex multi-step guidelines with meticulous attention to detail.\n\nI have reliable high-speed internet, dedicated workstation equipment, and immediate availability for remote project collaboration.\n\nThank you for considering my application.\n\nBest regards,',
  ai_experience_en: 'Over 2+ years of hands-on experience in LLM output evaluation, factuality verification, safety alignment, RLHF ranking, and prompt-response optimization across leading AI benchmarking platforms.',
  english_level_statement: 'Professional working proficiency in English (C1/Advanced reading and comprehension). Fully capable of following dense technical guidelines, documentation, and asynchronous written communication.',
  hardware_specs: 'OS: Windows 11 / macOS | RAM: 16 GB | CPU: 8 cores | Internet: 500 Mbps Fiber (Low latency, high stability) | Secondary Monitor: Yes',
  free_notes: 'Dica: Cole aqui anotações temporárias sobre processos seletivos, links de avaliações em andamento (guidelines, portais de exame) ou respostas específicas de perguntas de cada formulário.',
  custom_snippets: [
    {
      id: 'snippet-1',
      title: 'Pergunta: "Why are you interested in this role?"',
      content: 'I am passionate about contributing to state-of-the-art language models and helping refine AI systems for Portuguese speakers worldwide with high linguistic precision.'
    },
    {
      id: 'snippet-2',
      title: 'Pergunta: "Describe a challenging guideline situation"',
      content: 'When evaluating ambiguous edge-case prompts, I strictly prioritize the official project rubric, document my reasoning in detailed rationales, and cross-reference edge-case guidelines to ensure consistent scoring.'
    }
  ]
};

/**
 * Carrega os dados do Bloco de Notas do Candidato.
 * Tenta buscar primeiro do Supabase (para persistência em nuvem multi-dispositivo),
 * com fallback para localStorage.
 */
export async function loadCandidateNotes(): Promise<{
  data: CandidateProfileData;
  source: 'supabase' | 'local';
}> {
  // Carrega local inicial
  let localData: CandidateProfileData = { ...DEFAULT_CANDIDATE_PROFILE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CANDIDATE_NOTES);
    if (raw) {
      const parsed = JSON.parse(raw);
      localData = { ...DEFAULT_CANDIDATE_PROFILE, ...parsed };
    }
  } catch (e) {
    console.warn('[CandidateNotes] Erro ao ler localStorage:', e);
  }

  if (!isSupabaseConfigured()) {
    return { data: localData, source: 'local' };
  }

  try {
    const { data, error } = await (supabase as any)
      .from('candidate_notes')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('[CandidateNotes] Supabase fetch warning:', error.message);
      return { data: localData, source: 'local' };
    }

    if (data && data.length > 0) {
      const row = data[0];
      const merged: CandidateProfileData = {
        ...DEFAULT_CANDIDATE_PROFILE,
        ...row,
        custom_snippets: Array.isArray(row.custom_snippets) 
          ? row.custom_snippets 
          : (typeof row.custom_snippets === 'string' ? JSON.parse(row.custom_snippets) : DEFAULT_CANDIDATE_PROFILE.custom_snippets)
      };

      // Atualiza cache local para sincronia offline
      try {
        localStorage.setItem(STORAGE_KEY_CANDIDATE_NOTES, JSON.stringify(merged));
      } catch {}

      return { data: merged, source: 'supabase' };
    }

    // Se a tabela existe mas está vazia, salva os dados locais atuais no Supabase
    if (localData.full_name || localData.email || localData.linkedin_url) {
      await saveCandidateNotesToSupabase(localData);
    }

    return { data: localData, source: 'local' };
  } catch (err) {
    console.warn('[CandidateNotes] Falha ao consultar Supabase, usando local:', err);
    return { data: localData, source: 'local' };
  }
}

/**
 * Salva os dados do Bloco de Notas no Supabase e no localStorage.
 */
export async function saveCandidateNotesToSupabase(
  profile: CandidateProfileData
): Promise<{ success: boolean; id?: string; error?: string }> {
  // 1. Salva imediatamente no localStorage
  try {
    localStorage.setItem(STORAGE_KEY_CANDIDATE_NOTES, JSON.stringify(profile));
  } catch (e) {
    console.error('[CandidateNotes] Erro ao salvar localmente:', e);
  }

  // 2. Se o Supabase estiver configurado, persiste no banco
  if (!isSupabaseConfigured()) {
    return { success: true, error: 'Salvo localmente (Supabase não conectado)' };
  }

  try {
    const payload = {
      full_name: profile.full_name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      city: profile.city || '',
      state: profile.state || '',
      country: profile.country || 'Brasil',
      timezone: profile.timezone || 'America/Sao_Paulo (UTC-3)',
      linkedin_url: profile.linkedin_url || '',
      github_url: profile.github_url || '',
      portfolio_url: profile.portfolio_url || '',
      resume_url: profile.resume_url || '',
      resume_en_url: profile.resume_en_url || '',
      hourly_rate_usd: profile.hourly_rate_usd || '',
      monthly_salary_usd: profile.monthly_salary_usd || '',
      availability: profile.availability || '',
      hours_per_week: profile.hours_per_week || '',
      payment_paypal: profile.payment_paypal || '',
      payment_payoneer: profile.payment_payoneer || '',
      payment_deel: profile.payment_deel || '',
      payment_wise: profile.payment_wise || '',
      tax_id: profile.tax_id || '',
      short_bio_pt: profile.short_bio_pt || '',
      short_bio_en: profile.short_bio_en || '',
      cover_letter_pt: profile.cover_letter_pt || '',
      cover_letter_en: profile.cover_letter_en || '',
      ai_experience_en: profile.ai_experience_en || '',
      english_level_statement: profile.english_level_statement || '',
      hardware_specs: profile.hardware_specs || '',
      free_notes: profile.free_notes || '',
      custom_snippets: profile.custom_snippets || [],
      updated_at: new Date().toISOString()
    };

    let resultId = profile.id;

    if (profile.id) {
      // Atualiza registro existente
      const { data, error } = await (supabase as any)
        .from('candidate_notes')
        .update(payload)
        .eq('id', profile.id)
        .select('id')
        .single();

      if (error) {
        throw error;
      }
      resultId = data?.id || profile.id;
    } else {
      // Verifica se já existe algum registro existente para atualizar em vez de duplicar
      const { data: existing } = await (supabase as any)
        .from('candidate_notes')
        .select('id')
        .limit(1);

      if (existing && existing.length > 0) {
        const existingId = existing[0].id;
        const { error } = await (supabase as any)
          .from('candidate_notes')
          .update(payload)
          .eq('id', existingId);

        if (error) throw error;
        resultId = existingId;
      } else {
        const { data, error } = await (supabase as any)
          .from('candidate_notes')
          .insert([payload])
          .select('id')
          .single();

        if (error) throw error;
        resultId = data?.id;
      }
    }

    if (resultId) {
      profile.id = resultId;
      try {
        localStorage.setItem(STORAGE_KEY_CANDIDATE_NOTES, JSON.stringify(profile));
      } catch {}
    }

    return { success: true, id: resultId };
  } catch (err: any) {
    console.error('[CandidateNotes] Erro ao gravar no Supabase:', err);
    return { success: false, error: err?.message || 'Falha ao salvar no Supabase' };
  }
}
