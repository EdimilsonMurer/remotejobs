import { GoogleGenAI, Type } from '@google/genai';
import { NormalizedJob } from '../connectors/base/types';
import { JobAnalysis } from '../types/job';

export class GeminiClassifier {
  private ai: GoogleGenAI;
  private modelName: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.ai = new GoogleGenAI(apiKey ? { apiKey } : {});
    // Modelo com alta taxa de respostas estruturadas
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  /**
   * Classificador heurístico determinístico (Fallback resiliente quando a quota da API estiver esgotada)
   */
  classifyJobHeuristic(job: NormalizedJob): JobAnalysis {
    const text = `${job.title} ${job.description}`.toLowerCase();
    
    // Análise de requisitos de Português
    const hasPortugueseInTitle = job.title.toLowerCase().includes('portuguese') || job.title.toLowerCase().includes('português');
    const hasPortugueseInBody = text.includes('portuguese') || text.includes('português') || text.includes('pt-br');
    const portugueseRequired = hasPortugueseInTitle || hasPortugueseInBody;

    // Análise de requisitos de Inglês e Outros Idiomas Estrangeiros
    const hasOtherLanguageInTitle = 
      job.title.toLowerCase().includes('italian') || 
      job.title.toLowerCase().includes('italiano') || 
      job.title.toLowerCase().includes('german') || 
      job.title.toLowerCase().includes('alemão') || 
      job.title.toLowerCase().includes('spanish') || 
      job.title.toLowerCase().includes('espanhol') || 
      job.title.toLowerCase().includes('french') || 
      job.title.toLowerCase().includes('francês') || 
      job.title.toLowerCase().includes('bilingual') || 
      job.title.toLowerCase().includes('bilíngue');

    const requiresBoth = text.includes('both in portuguese') || text.includes('and english') || text.includes('bilingual') || text.includes('inglês e italiano') || text.includes('english and italian');
    const requiresEnglishExplicit = 
      text.includes('english proficiency') || 
      text.includes('strong understanding of english') || 
      text.includes('fluent english') || 
      text.includes('english is required') ||
      text.includes('fluency in english') ||
      text.includes('english (written and spoken)');

    const englishNiceToHave = text.includes('english is a plus') || text.includes('english is desirable') || text.includes('nice to have');
    const onlyPortugueseWork = text.includes('all work is done in brazilian portuguese') || text.includes('all work is done in portuguese');

    let englishStatus: 'NONE' | 'DESIRABLE' | 'PARTIAL' | 'REQUIRED' | 'UNKNOWN' = 'UNKNOWN';
    let score = 50;
    let reason = 'Análise semântica automatizada.';

    if (hasOtherLanguageInTitle && !hasPortugueseInTitle) {
      englishStatus = 'REQUIRED';
      score = 30;
      reason = 'O anúncio exige domínio de outro idioma estrangeiro especificado no cargo (como italiano, bilíngue ou similar), não sendo adequado para quem busca trabalho 100% em português.';
    } else if (onlyPortugueseWork) {
      englishStatus = 'PARTIAL';
      score = 88;
      reason = 'Excelente oportunidade: todo o trabalho é realizado em português brasileiro. O inglês pode ser necessário apenas para login ou termos da plataforma.';
    } else if (requiresBoth || requiresEnglishExplicit) {
      englishStatus = 'REQUIRED';
      score = 35;
      reason = 'A vaga exige realização de tarefas ou comunicação em idiomas estrangeiros além do português, sendo menos indicada para quem busca vagas exclusivas em português.';
    } else if (englishNiceToHave) {
      englishStatus = 'DESIRABLE';
      score = 75;
      reason = 'O inglês é mencionado como diferencial, mas as atividades principais e entregas são focadas em português.';
    } else if (hasPortugueseInTitle) {
      englishStatus = 'NONE';
      score = 90;
      reason = 'Vaga voltada especificamente para o público brasileiro e lusófono, sem exigência identificada de conversação em inglês.';
    }

    // Categoria da vaga
    let jobCategory = 'AI';
    if (text.includes('annotation') || text.includes('anotação') || text.includes('rater') || text.includes('evaluator')) {
      jobCategory = 'ANNOTATION';
    } else if (text.includes('translation') || text.includes('tradução') || text.includes('localization')) {
      jobCategory = 'TRANSLATION';
    } else if (text.includes('audio') || text.includes('voice') || text.includes('transcription')) {
      jobCategory = 'DATA';
    }

    return {
      english_status: englishStatus,
      portuguese_required: portugueseRequired,
      portuguese_level: portugueseRequired ? 'NATIVE' : 'NONE',
      brazil_eligible: true,
      remote_eligible: job.remote,
      job_category: jobCategory,
      experience_level: text.includes('senior') || text.includes('lead') ? 'SENIOR' : 'ENTRY',
      salary_detected: text.includes('$') || text.includes('per hour') || text.includes('r$'),
      salary_min: null,
      salary_max: null,
      salary_currency: 'USD',
      compatibility_score: score,
      confidence: 85,
      reason,
      analysis_version: 'v1-heuristic',
      analyzed_at: new Date().toISOString()
    };
  }

  /**
   * Classifica uma vaga individual com validação de JSON Schema e fallback gracioso
   */
  async classifyJob(job: NormalizedJob, attempt = 1): Promise<JobAnalysis> {
    const systemPrompt = `Você é o classificador de vagas da plataforma "RemoteJobs PT", especializado em identificar oportunidades remotas internacionais para brasileiros que NÃO falam inglês ou possuem inglês básico/limitado.

Seu objetivo é analisar a vaga e classificar com precisão CIRÚRGICA:

1. STATUS DO INGLÊS (english_status):
- "NONE": Não foi identificado nenhum requisito de inglês para o trabalho.
- "DESIRABLE": Inglês aparece como diferencial/desejável ("nice to have", "plus"), mas NÃO é obrigatório.
- "PARTIAL": Leitura básica de interface ou documentos em inglês, mas as entregas e testes são 100% em Português.
- "REQUIRED": Inglês é claramente obrigatório (reuniões em inglês, entrevistas ao vivo em inglês, comunicação diária).
- "UNKNOWN": Informação insuficiente na descrição.

2. REQUISITOS DE PORTUGUÊS:
- "portuguese_required": true se a vaga busca explicitamente falantes de português.
- "portuguese_level": NATIVE | FLUENT | INTERMEDIATE | BASIC | NONE | UNKNOWN.

3. ELEGIBILIDADE:
- "brazil_eligible": true se aceita residentes no Brasil.
- "remote_eligible": true se é 100% remota.

4. COMPATIBILIDADE (compatibility_score: 0 a 100).
5. JUSTIFICATIVA (reason): Máximo 2 frases transparentes em pt-BR.`;

    const jobPrompt = `ANALISE A SEGUINTE VAGA:
Título: ${job.title}
Empresa: ${job.company}
Plataforma: ${job.platform_slug}
Local: ${job.location}
Remoto: ${job.remote}

DESCRIÇÃO:
${job.description.substring(0, 3000)}`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${jobPrompt}` }] }
        ],
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              english_status: {
                type: Type.STRING,
                enum: ['NONE', 'DESIRABLE', 'PARTIAL', 'REQUIRED', 'UNKNOWN']
              },
              portuguese_required: { type: Type.BOOLEAN },
              portuguese_level: {
                type: Type.STRING,
                enum: ['NATIVE', 'FLUENT', 'INTERMEDIATE', 'BASIC', 'NONE', 'UNKNOWN']
              },
              brazil_eligible: { type: Type.BOOLEAN },
              remote_eligible: { type: Type.BOOLEAN },
              job_category: {
                type: Type.STRING,
                enum: ['AI', 'DATA', 'ANNOTATION', 'LOCALIZATION', 'TESTING', 'TRANSLATION', 'MICROTASK', 'OTHER']
              },
              experience_level: {
                type: Type.STRING,
                enum: ['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'UNKNOWN']
              },
              salary_detected: { type: Type.BOOLEAN },
              salary_min: { type: Type.NUMBER, nullable: true },
              salary_max: { type: Type.NUMBER, nullable: true },
              salary_currency: { type: Type.STRING, nullable: true },
              compatibility_score: { type: Type.INTEGER },
              confidence: { type: Type.INTEGER },
              reason: { type: Type.STRING }
            },
            required: [
              'english_status',
              'portuguese_required',
              'portuguese_level',
              'brazil_eligible',
              'remote_eligible',
              'job_category',
              'experience_level',
              'salary_detected',
              'compatibility_score',
              'confidence',
              'reason'
            ]
          }
        }
      });

      const responseText = response.text?.trim() || '{}';
      const parsed = JSON.parse(responseText);

      return {
        english_status: parsed.english_status || 'UNKNOWN',
        portuguese_required: Boolean(parsed.portuguese_required),
        portuguese_level: parsed.portuguese_level || 'UNKNOWN',
        brazil_eligible: Boolean(parsed.brazil_eligible),
        remote_eligible: Boolean(parsed.remote_eligible),
        job_category: parsed.job_category || 'AI',
        experience_level: parsed.experience_level || 'ENTRY',
        salary_detected: Boolean(parsed.salary_detected),
        salary_min: parsed.salary_min ?? null,
        salary_max: parsed.salary_max ?? null,
        salary_currency: parsed.salary_currency || job.salary_currency || 'USD',
        compatibility_score: Math.min(100, Math.max(0, parsed.compatibility_score ?? 50)),
        confidence: Math.min(100, Math.max(0, parsed.confidence ?? 80)),
        reason: parsed.reason || 'Análise automática realizada por inteligência artificial.',
        analysis_version: 'v1',
        analyzed_at: new Date().toISOString()
      };
    } catch (error: any) {
      const isQuotaLimit = error?.message?.includes('Quota exceeded') || error?.message?.includes('RESOURCE_EXHAUSTED');
      const isRateLimit = error?.message?.includes('429') || error?.status === 429;
      const isUnavailable = error?.message?.includes('503') || error?.status === 503;

      // Se quota do dia esgotou no modelo atual, ativa o fallback heurístico imediato
      if (isQuotaLimit) {
        console.warn(`[Gemini] Quota diária gratuita atingida para ${this.modelName}. Utilizando classificador heurístico estruturado.`);
        return this.classifyJobHeuristic(job);
      }

      if ((isRateLimit || isUnavailable) && attempt <= 2) {
        const backoffMs = attempt * 1500;
        console.warn(`[Gemini] Aviso temporário (${isUnavailable ? '503' : '429'}). Tentando em ${backoffMs}ms...`);
        await new Promise(r => setTimeout(r, backoffMs));
        return this.classifyJob(job, attempt + 1);
      }

      // Fallback heurístico em caso de falha de conexão ou quota
      console.warn(`[Gemini] Aplicando análise heurística para "${job.title}".`);
      return this.classifyJobHeuristic(job);
    }
  }

  /**
   * Processa uma lista de vagas com delay controlado entre chamadas
   */
  async batchClassify(
    jobs: NormalizedJob[], 
    onProgress?: (index: number, total: number, result: JobAnalysis) => void
  ): Promise<Map<string, JobAnalysis>> {
    const results = new Map<string, JobAnalysis>();

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const analysis = await this.classifyJob(job);
      results.set(job.external_id, analysis);

      if (onProgress) {
        onProgress(i + 1, jobs.length, analysis);
      }

      if (i < jobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }
}
