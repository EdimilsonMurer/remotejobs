import { NormalizedJob } from '../connectors/base/types';

export interface PreFilterResult {
  hasPortugueseSignal: boolean;
  hasHeavyEnglishSignal: boolean;
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

// Sinais pesados de restrição de Inglês nativo / C2
const HEAVY_ENGLISH_SIGNALS = [
  /\bnative english speaker\b/i,
  /\bfluent english required\b/i,
  /\bc2 english\b/i,
  /\bc1 english\b/i,
  /\bfluent or native english\b/i,
  /\bmust be fluent in english\b/i,
  /\benglish is mandatory\b/i,
  /\bexcellent english communication skills required\b/i,
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
 * Executa regras determinísticas pré-Gemini para poupar chamadas de API
 * e priorizar vagas com sinais de Português ou sem inglês obrigatório.
 */
export function runPreFilter(job: NormalizedJob): PreFilterResult {
  const fullText = `${job.title} ${job.location} ${job.country} ${job.description}`.toLowerCase();
  const titleAndLocation = `${job.title} ${job.location} ${job.country}`.toLowerCase();

  const matchedKeywords: string[] = [];

  // 1. Verifica sinais de Português / Brasil
  let hasPortugueseSignal = false;
  for (const regex of PORTUGUESE_SIGNALS) {
    if (regex.test(fullText)) {
      hasPortugueseSignal = true;
      matchedKeywords.push(regex.source.replace(/\\b/g, ''));
    }
  }

  // 2. Verifica se o sinal de português está no título ou local (MÁXIMA RELEVÂNCIA)
  let titleHasPt = false;
  for (const regex of PORTUGUESE_SIGNALS) {
    if (regex.test(titleAndLocation)) {
      titleHasPt = true;
      break;
    }
  }

  // 3. Verifica sinais pesados de exigência de inglês
  let hasHeavyEnglishSignal = false;
  for (const regex of HEAVY_ENGLISH_SIGNALS) {
    if (regex.test(fullText)) {
      hasHeavyEnglishSignal = true;
      matchedKeywords.push(regex.source.replace(/\\b/g, ''));
    }
  }

  // 4. Verifica se é atividade de IA/Anotação/Microtask
  let isAiMicrotask = false;
  for (const regex of PRIORITY_KEYWORDS) {
    if (regex.test(fullText)) {
      isAiMicrotask = true;
      matchedKeywords.push(regex.source.replace(/\\b/g, ''));
    }
  }

  // 5. Determina Prioridade e se envia ao Gemini
  if (titleHasPt || (hasPortugueseSignal && isAiMicrotask)) {
    return {
      hasPortugueseSignal: true,
      hasHeavyEnglishSignal,
      priority: 'HIGH',
      shouldSendToGemini: true,
      matchedKeywords: [...new Set(matchedKeywords)],
      deterministicReason: 'Alta prioridade: Menção explícita a Português/Brasil no título ou descrição técnica de IA.'
    };
  }

  if (hasPortugueseSignal) {
    return {
      hasPortugueseSignal: true,
      hasHeavyEnglishSignal,
      priority: 'MEDIUM',
      shouldSendToGemini: true,
      matchedKeywords: [...new Set(matchedKeywords)],
      deterministicReason: 'Média prioridade: Menção a Português/Brasil no corpo da oportunidade.'
    };
  }

  if (isAiMicrotask && !hasHeavyEnglishSignal) {
    return {
      hasPortugueseSignal: false,
      hasHeavyEnglishSignal: false,
      priority: 'LOW',
      shouldSendToGemini: true,
      matchedKeywords: [...new Set(matchedKeywords)],
      deterministicReason: 'Baixa prioridade: Trabalho de microtask/anotação de IA sem restrição óbvia de inglês.'
    };
  }

  // Se não tem relação com português, nem é de IA/anotação remota, descarta da análise Gemini para poupar quota
  return {
    hasPortugueseSignal: false,
    hasHeavyEnglishSignal,
    priority: 'DISCARD',
    shouldSendToGemini: false,
    matchedKeywords: [...new Set(matchedKeywords)],
    deterministicReason: 'Descartada no pré-filtro: Sem relação com idioma português ou atividades acessíveis sem inglês fluente.'
  };
}
