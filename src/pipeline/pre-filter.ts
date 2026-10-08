import { NormalizedJob } from '../connectors/base/types';

export interface PreFilterResult {
  hasPortugueseSignal: boolean;
  hasHeavyEnglishSignal: boolean;
  hasIntermediateEnglishSignal: boolean;
  isTranslationFromEnglish: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'DISCARD';
  shouldSendToGemini: boolean;
  matchedKeywords: string[];
  deterministicReason: string;
}

// Sinais positivos de Português / Brasil
const PORTUGUESE_SIGNALS = [
  /\bportugu[eê]s\b/i,
  /\bportuguese\b/i,
  /\bbrazil\b/i,
  /\bbrasil\b/i,
  /\bbrazilian\b/i,
  /\bpt-br\b/i,
  /\bpt_br\b/i,
  /\bnative portuguese\b/i,
  /\bportugu[eê]s nativo\b/i,
  /\bportugu[eê]s brasileiro\b/i,
  /\bfalantes de portugu[eê]s\b/i,
  /\bportuguese speakers\b/i,
];

// Sinais pesados de restrição de Inglês nativo / fluente / mandatório (C1, C2, reuniões, etc.)
const HEAVY_ENGLISH_SIGNALS = [
  /\bnative english speaker\b/i,
  /\bfluent english required\b/i,
  /\bfluent english\b/i,
  /\bc2 english\b/i,
  /\bc1 english\b/i,
  /\bfluent or native english\b/i,
  /\bmust be fluent in english\b/i,
  /\benglish is mandatory\b/i,
  /\benglish is required\b/i,
  /\bexcellent english communication skills required\b/i,
  /\bexcellent (verbal and written )?english\b/i,
  /\bstrong (verbal and written )?english skills\b/i,
  /\bproficient in english\b/i,
  /\benglish proficiency required\b/i,
  /\benglish\s*:\s*(fluent|native|advanced|c1|c2)\b/i,
  /\bprofessional working proficiency in english\b/i,
  /\badvanced (level of )?english\b/i,
  /\benglish (written and spoken)\b/i,
  /\bfluency in english\b/i,
];

// Sinais de inglês intermediário / conversacional (não é opcional, mas não exige C2)
const INTERMEDIATE_ENGLISH_SIGNALS = [
  /\bintermediate english\b/i,
  /\bconversational english\b/i,
  /\bworking knowledge of english\b/i,
  /\bgood command of english\b/i,
  /\bb2 english\b/i,
  /\benglish\s*:\s*(intermediate|b2|conversational)\b/i,
  /\bable to communicate in english\b/i,
];

// Sinais de tradução que exigem compreensão de inglês
const TRANSLATION_FROM_ENGLISH_SIGNALS = [
  /\benglish to portuguese\b/i,
  /\bingl[eê]s para portugu[eê]s\b/i,
  /\ben\s*->\s*pt\b/i,
  /\ben-pt\b/i,
  /\ben to pt\b/i,
];

// Categorias prioritárias de microtask/IA/anotação
const PRIORITY_KEYWORDS = [
  /\bdata label(er|ing)\b/i,
  /\banotador\b/i,
  /\banotação\b/i,
  /\blocalization\b/i,
  /\blocalização\b/i,
  /\btranslator\b/i,
  /\btradutor\b/i,
  /\brater\b/i,
  /\bquality rater\b/i,
  /\bai trainer\b/i,
  /\btreinador de ia\b/i,
  /\bcontributor\b/i,
  /\baudio contributor\b/i,
  /\bvoice contributor\b/i,
];

/**
 * Executa regras determinísticas pré-Gemini para calibrar prioridade sem distorções:
 * - Vagas com "fluent english required" não ganham HIGH apenas por ter "Brazil" ou "Portuguese".
 * - Vagas de tradução de inglês para português são marcadas com necessidade de compreensão em inglês.
 */
export function runPreFilter(job: NormalizedJob): PreFilterResult {
  const fullText = `${job.title} ${job.location} ${job.country} ${job.description}`.toLowerCase();
  const titleAndLocation = `${job.title} ${job.location} ${job.country}`.toLowerCase();

  const matchedKeywords: string[] = [];

  // 1. Sinais de Português / Brasil
  let hasPortugueseSignal = false;
  for (const regex of PORTUGUESE_SIGNALS) {
    if (regex.test(fullText)) {
      hasPortugueseSignal = true;
      matchedKeywords.push(regex.source.replace(/\\b/g, ''));
    }
  }

  // 2. Sinal de Português no título ou localização
  let titleHasPt = false;
  for (const regex of PORTUGUESE_SIGNALS) {
    if (regex.test(titleAndLocation)) {
      titleHasPt = true;
      break;
    }
  }

  // 3. Sinais pesados de inglês fluente/mandatório
  let hasHeavyEnglishSignal = false;
  for (const regex of HEAVY_ENGLISH_SIGNALS) {
    if (regex.test(fullText)) {
      hasHeavyEnglishSignal = true;
      matchedKeywords.push(regex.source.replace(/\\b/g, ''));
    }
  }

  // 4. Sinais de inglês intermediário
  let hasIntermediateEnglishSignal = false;
  for (const regex of INTERMEDIATE_ENGLISH_SIGNALS) {
    if (regex.test(fullText)) {
      hasIntermediateEnglishSignal = true;
      matchedKeywords.push(regex.source.replace(/\\b/g, ''));
    }
  }

  // 5. Sinal de tradução inglês -> português
  let isTranslationFromEnglish = false;
  for (const regex of TRANSLATION_FROM_ENGLISH_SIGNALS) {
    if (regex.test(fullText)) {
      isTranslationFromEnglish = true;
      matchedKeywords.push('translation_en_to_pt');
    }
  }

  // 6. Atividade de IA / Anotação
  let isAiMicrotask = false;
  for (const regex of PRIORITY_KEYWORDS) {
    if (regex.test(fullText)) {
      isAiMicrotask = true;
      matchedKeywords.push(regex.source.replace(/\\b/g, ''));
    }
  }

  const uniqueKeywords = [...new Set(matchedKeywords)];

  // 7. REGRA CRÍTICA: Se exige inglês fluente/mandatório, NÃO é HIGH para quem busca vagas sem inglês!
  if (hasHeavyEnglishSignal) {
    if (hasPortugueseSignal) {
      return {
        hasPortugueseSignal: true,
        hasHeavyEnglishSignal: true,
        hasIntermediateEnglishSignal,
        isTranslationFromEnglish,
        priority: 'LOW',
        shouldSendToGemini: true,
        matchedKeywords: uniqueKeywords,
        deterministicReason: 'Baixa prioridade: Menciona Português/Brasil, porém com requisito explícito de inglês fluente ou mandatório no anúncio.'
      };
    }

    return {
      hasPortugueseSignal: false,
      hasHeavyEnglishSignal: true,
      hasIntermediateEnglishSignal,
      isTranslationFromEnglish,
      priority: 'DISCARD',
      shouldSendToGemini: false,
      matchedKeywords: uniqueKeywords,
      deterministicReason: 'Descartada: Exigência explícita de inglês nativo/fluente sem foco em português.'
    };
  }

  // Se for tradução de inglês para português, exige compreensão de leitura em inglês
  if (isTranslationFromEnglish) {
    return {
      hasPortugueseSignal: true,
      hasHeavyEnglishSignal: false,
      hasIntermediateEnglishSignal: true,
      isTranslationFromEnglish: true,
      priority: 'MEDIUM',
      shouldSendToGemini: true,
      matchedKeywords: uniqueKeywords,
      deterministicReason: 'Média prioridade: Tradução de Inglês para Português (requer compreensão de leitura em inglês).'
    };
  }

  // 8. Alta prioridade genuína: Português no título/local OU IA/anotação em português SEM exigência de inglês fluente
  if ((titleHasPt || (hasPortugueseSignal && isAiMicrotask)) && !hasIntermediateEnglishSignal) {
    return {
      hasPortugueseSignal: true,
      hasHeavyEnglishSignal: false,
      hasIntermediateEnglishSignal: false,
      isTranslationFromEnglish: false,
      priority: 'HIGH',
      shouldSendToGemini: true,
      matchedKeywords: uniqueKeywords,
      deterministicReason: 'Alta prioridade: Menção explícita a Português/Brasil no título ou projeto de IA sem exigência de inglês fluente.'
    };
  }

  if (hasPortugueseSignal) {
    return {
      hasPortugueseSignal: true,
      hasHeavyEnglishSignal: false,
      hasIntermediateEnglishSignal,
      isTranslationFromEnglish: false,
      priority: hasIntermediateEnglishSignal ? 'LOW' : 'MEDIUM',
      shouldSendToGemini: true,
      matchedKeywords: uniqueKeywords,
      deterministicReason: hasIntermediateEnglishSignal
        ? 'Baixa prioridade: Menção a Português com requisito de inglês intermediário/conversacional.'
        : 'Média prioridade: Menção a Português/Brasil no corpo da oportunidade sem inglês mandatório.'
    };
  }

  if (isAiMicrotask) {
    return {
      hasPortugueseSignal: false,
      hasHeavyEnglishSignal: false,
      hasIntermediateEnglishSignal,
      isTranslationFromEnglish: false,
      priority: 'LOW',
      shouldSendToGemini: true,
      matchedKeywords: uniqueKeywords,
      deterministicReason: 'Baixa prioridade: Atividade de microtask/anotação de IA sem restrição óbvia de inglês.'
    };
  }

  // Sem relação com português nem atividade remota acessível
  return {
    hasPortugueseSignal: false,
    hasHeavyEnglishSignal: false,
    hasIntermediateEnglishSignal,
    isTranslationFromEnglish: false,
    priority: 'DISCARD',
    shouldSendToGemini: false,
    matchedKeywords: uniqueKeywords,
    deterministicReason: 'Descartada no pré-filtro: Sem relação com idioma português ou atividades acessíveis sem inglês.'
  };
}
