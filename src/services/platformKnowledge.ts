import { CurrencyType, EnglishRequirement, ProcessType, PlatformStatus } from '../types/job';

export interface KnownPlatformData {
  name: string;
  websiteUrl: string;
  careersUrl: string;
  category: string;
  currency: CurrencyType;
  englishRequirement: EnglishRequirement;
  processType: ProcessType;
  status: PlatformStatus;
  blacklistReason?: string;
  paymentMethods: string[];
  averagePayRate: string;
  notes: string;
}

export const KNOWN_PLATFORMS_DB: Record<string, KnownPlatformData> = {
  'alignerr.com': {
    name: 'Alignerr',
    websiteUrl: 'https://www.alignerr.com/',
    careersUrl: 'https://www.alignerr.com/',
    category: 'Treinamento de IA & RLHF para Grandes Modelos de Linguagem',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['Deel', 'Conta Bancária'],
    averagePayRate: '$15.00 - $35.00 / hora',
    notes: 'Plataforma líder em avaliação de IA com remuneração em Dólar. Vagas em Português do Brasil para redatores e revisores de respostas de IA. Processo por testes práticos de múltipla escolha e escrita online, sem entrevista oral.'
  },
  'mindrift.ai': {
    name: 'Mindrift',
    websiteUrl: 'https://mindrift.ai/',
    careersUrl: 'https://mindrift.ai/for-writers',
    category: 'Treinamento de LLMs & Escrita Criativa de IA',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['PayPal', 'Transferência Bancária'],
    averagePayRate: '$10.00 - $25.00 / hora',
    notes: 'Paga em Dólar. Focada em tutoria de IA e escrita de respostas em português natural. Seleção por teste de escrita assíncrono.'
  },
  'outlier.ai': {
    name: 'Outlier AI',
    websiteUrl: 'https://outlier.ai/',
    careersUrl: 'https://outlier.ai/experts/creators',
    category: 'Treinamento de LLMs & Avaliação de Prompts PT-BR',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['PayPal', 'AirTM'],
    averagePayRate: '$7.50 - $25.00 / hora',
    notes: 'Plataforma de IA com forte demanda de falantes nativos de Português do Brasil. Pagamentos semanais via PayPal. Teste prático online sem entrevista.'
  },
  'welocalize.com': {
    name: 'Welocalize',
    websiteUrl: 'https://www.welocalize.com/',
    careersUrl: 'https://www.welocalize.com/careers/',
    category: 'Avaliação de Busca, Anúncios & Localização',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['Hyperwallet', 'Wire Transfer', 'Conta Bancária'],
    averagePayRate: '$4.50 - $15.00 / hora',
    notes: 'Paga em Dólar. Vagas frequentes de "Search Quality Rater" e "Ads Rater" em Português do Brasil. O processo é 100% por teste de qualificação online (sem entrevista oral).'
  },
  'oneforma.com': {
    name: 'OneForma (Centific)',
    websiteUrl: 'https://www.oneforma.com/',
    careersUrl: 'https://my.oneforma.com',
    category: 'Microtarefas, Transcrição & Dados de IA',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['Payoneer', 'PayPal'],
    averagePayRate: '$5.00 - $18.00 / hora',
    notes: 'Paga em Dólar e Euro. Centenas de projetos simultâneos em PT-BR (certificações gratuitas na plataforma antes de iniciar). Sem nenhuma entrevista ao vivo.'
  },
  'telusdigital.com': {
    name: 'TELUS Digital',
    websiteUrl: 'https://www.telusdigital.com/',
    careersUrl: 'https://www.telusdigital.com/careers',
    category: 'Rater de Busca, Avaliação de Mídia & AI Community',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['Depósito Bancário Direto', 'Wire'],
    averagePayRate: '$5.00 - $14.00 / hora',
    notes: 'Excelente pagadora em Dólar. Exame prático baseado em diretrizes (Guidelines) em PDF. Sem entrevista em inglês.'
  },
  'crowdgen.com': {
    name: 'CrowdGen (Appen)',
    websiteUrl: 'https://crowdgen.com/',
    careersUrl: 'https://app.crowdgen.com',
    category: 'Anotação de Dados de IA, Avaliação & Transcrição',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['Payoneer'],
    averagePayRate: '$3.50 - $12.00 / hora',
    notes: 'Plataforma unificada da Appen. Projetos de longo prazo e tarefas curtas em Português do Brasil. Sem entrevistas faladas.'
  },
  'appen.com': {
    name: 'Appen / CrowdGen',
    websiteUrl: 'https://appen.com/',
    careersUrl: 'https://crowdgen.com/',
    category: 'Anotação de Dados & Treinamento de Modelos IA',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['Payoneer'],
    averagePayRate: '$4.00 - $13.00 / hora',
    notes: 'Líder histórica em crowd-working para IA. Vagas de avaliação de texto e transcrição em Português do Brasil. Processo por testes práticos.'
  },
  'invisible.co': {
    name: 'Invisible Technologies',
    websiteUrl: 'https://invisible.co/',
    careersUrl: 'https://invisible.co/careers',
    category: 'Operações de IA Avançada & Treinamento de LLMs',
    currency: 'USD',
    englishRequirement: 'BASIC',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['Deel', 'Wise', 'PayPal'],
    averagePayRate: '$15.00 - $40.00 / hora',
    notes: 'Paga em Dólar com remuneração acima da média para especialistas e operadores de dados de IA. Avaliação remota assíncrona.'
  },
  'transperfect.com': {
    name: 'DataForce (TransPerfect)',
    websiteUrl: 'https://www.transperfect.com/',
    careersUrl: 'https://dataforcecommunity.transperfect.com/',
    category: 'Linguística, Avaliação de Áudio & IA',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['PayPal', 'Wire', 'Gift Cards'],
    averagePayRate: '$5.00 - $16.00 / hora',
    notes: 'Projetos frequentes para brasileiros: coleta de áudio, validação de tradução, transcrição fonética e anotação de dados.'
  },
  'clickworker.com': {
    name: 'Clickworker & UHRS',
    websiteUrl: 'https://www.clickworker.com/',
    careersUrl: 'https://www.clickworker.com/clickworker/',
    category: 'Microtarefas, Avaliação de Dados & UHRS',
    currency: 'EUR',
    englishRequirement: 'READING_ONLY',
    processType: 'NO_INTERVIEW',
    status: 'FAVORITE',
    paymentMethods: ['Payoneer', 'PayPal', 'SEPA'],
    averagePayRate: '€4.00 - €12.00 / hora',
    notes: 'Paga em Euro (€) e Dólar. Acesso direto ao sistema UHRS da Microsoft com tarefas pagas por clique em português. Sem entrevista.'
  },
  'testerwork.com': {
    name: 'TesterWork',
    websiteUrl: 'https://testerwork.com/',
    careersUrl: 'https://testerwork.com/',
    category: 'Testes de Aplicativos (QA & Bug Finding)',
    currency: 'USD',
    englishRequirement: 'BASIC',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['PayPal', 'Upwork Direct'],
    averagePayRate: '$10 - $50+ por ciclo de teste',
    notes: 'Paga em Dólar por ciclo de testes executado ou por bug encontrado em apps mobile e sites. Teste inicial online de 15 minutos.'
  },
  'testlio.com': {
    name: 'Testlio',
    websiteUrl: 'https://testlio.com/',
    careersUrl: 'https://testlio.com/for-freelancers/',
    category: 'QA Freelance & Testes de Software',
    currency: 'USD',
    englishRequirement: 'BASIC',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['PayPal', 'Payoneer'],
    averagePayRate: '$12.00 - $25.00 / hora',
    notes: 'Paga em Dólar com taxa horária garantida durante sessões de testes agendadas. Teste prático de onboarding na plataforma.'
  },
  'utest.com': {
    name: 'uTest (Applause)',
    websiteUrl: 'https://www.utest.com/',
    careersUrl: 'https://www.utest.com/signup',
    category: 'Comunidade Global de QA & Testes de Usabilidade',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['PayPal', 'Payoneer'],
    averagePayRate: '$8.00 - $25.00 / hora',
    notes: 'Paga em Dólar via PayPal/Payoneer no dia 15 e no último dia do mês. Treinamentos e testes práticos na uTest Academy em português.'
  },
  'prolific.com': {
    name: 'Prolific',
    websiteUrl: 'https://www.prolific.com/',
    careersUrl: 'https://www.prolific.com/participants',
    category: 'Pesquisas Científicas & Estudos de IA',
    currency: 'GBP',
    englishRequirement: 'READING_ONLY',
    processType: 'NO_INTERVIEW',
    status: 'FAVORITE',
    paymentMethods: ['PayPal'],
    averagePayRate: '£6.00 - £12.00 / hora',
    notes: 'Paga em Libra Esterlina (£ GBP) - moeda muito forte. Participação imediata em pesquisas e questionários sem entrevista.'
  },
  'toloka.ai': {
    name: 'Toloka AI',
    websiteUrl: 'https://toloka.ai/',
    careersUrl: 'https://toloka.ai/tolokers/',
    category: 'Microtarefas de IA & Anotação de Imagens',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'NO_INTERVIEW',
    status: 'ACTIVE',
    paymentMethods: ['Payoneer', 'Papara'],
    averagePayRate: '$3.00 - $8.00 / hora',
    notes: 'Microtarefas rápidas de treinamento de IA. Início imediato sem entrevistas.'
  },
  'neevo.ai': {
    name: 'Neevo (Defined.ai)',
    websiteUrl: 'https://neevo.ai/',
    careersUrl: 'https://neevo.ai/',
    category: 'Validação de Áudio, Fala & Dados de IA',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'ACTIVE',
    paymentMethods: ['PayPal'],
    averagePayRate: '$5.00 - $12.00 / hora',
    notes: 'Tarefas de gravação de voz e validação de transcrições em Português do Brasil. Sem entrevistas.'
  },
  'remotasks.com': {
    name: 'Remotasks',
    websiteUrl: 'https://www.remotasks.com/',
    careersUrl: 'https://www.remotasks.com/',
    category: 'Anotação de Dados de IA & RLHF',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['PayPal', 'AirTM'],
    averagePayRate: '$5.00 - $18.00 / hora',
    notes: 'Treinamento de modelos de IA com tarefas em português. Pagamentos semanais via PayPal.'
  },
  'micro1.ai': {
    name: 'Micro1',
    websiteUrl: 'https://www.micro1.ai/',
    careersUrl: 'https://www.micro1.ai/careers',
    category: 'Recrutamento Tech com Entrevista ao Vivo em Inglês',
    currency: 'USD',
    englishRequirement: 'FLUENT_INTERVIEW',
    processType: 'LIVE_INTERVIEW',
    status: 'BLACKLIST',
    blacklistReason: 'Exige entrevista oral técnica ao vivo em inglês com recrutadores e IA de conversação.',
    paymentMethods: ['Transferência Internacional', 'Deel'],
    averagePayRate: '$25.00 - $60.00 / hora',
    notes: 'BLOQUEADA: Não indicada para quem não fala inglês fluentemente. Todos os processos exigem bate-papo ao vivo.'
  },
  'turing.com': {
    name: 'Turing',
    websiteUrl: 'https://www.turing.com/',
    careersUrl: 'https://www.turing.com/jobs',
    category: 'Alocação de Engenheiros de Software Globais',
    currency: 'USD',
    englishRequirement: 'FLUENT_INTERVIEW',
    processType: 'LIVE_INTERVIEW',
    status: 'BLACKLIST',
    blacklistReason: 'Exige fluência em conversação e entrevistas ao vivo em inglês com clientes internacionais.',
    paymentMethods: ['Wire', 'Payoneer'],
    averagePayRate: '$25.00 - $50.00 / hora',
    notes: 'BLOQUEADA para quem busca vagas sem entrevista oral em inglês.'
  },
  'crossover.com': {
    name: 'Crossover',
    websiteUrl: 'https://www.crossover.com/',
    careersUrl: 'https://www.crossover.com/jobs',
    category: 'Trabalho Remoto em TI com Monitoramento',
    currency: 'USD',
    englishRequirement: 'FLUENT_INTERVIEW',
    processType: 'LIVE_INTERVIEW',
    status: 'BLACKLIST',
    blacklistReason: 'Exige inglês fluente para entrevistas, monitoramento intrusivo (WorkSmart) e testes eliminatórios ao vivo.',
    paymentMethods: ['Payoneer'],
    averagePayRate: '$15.00 - $50.00 / hora',
    notes: 'BLOQUEADA na lista negra por práticas de monitoramento e entrevistas estritas.'
  }
};

/**
 * Normaliza e extrai hostname limpo de uma URL
 */
export function extractCleanDomain(rawUrl: string): string {
  try {
    let clean = rawUrl.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    const parsed = new URL(clean);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return rawUrl.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

/**
 * Tenta inferir ou encontrar na base local
 */
export function matchKnownPlatform(rawUrl: string): KnownPlatformData | null {
  const domain = extractCleanDomain(rawUrl);
  
  // Correspondência exata de domínio
  if (KNOWN_PLATFORMS_DB[domain]) {
    return KNOWN_PLATFORMS_DB[domain];
  }

  // Correspondência por sufixo ou parte do domínio
  for (const [key, data] of Object.entries(KNOWN_PLATFORMS_DB)) {
    if (domain === key || domain.endsWith('.' + key) || key.endsWith('.' + domain)) {
      return data;
    }
    const cleanKeyName = key.split('.')[0];
    if (domain.includes(cleanKeyName)) {
      return data;
    }
  }

  return null;
}

/**
 * Gera dados inteligentes padrão quando o domínio não é conhecido antecipadamente
 */
export function inferPlatformDefaults(rawUrl: string): KnownPlatformData {
  let cleanUrl = rawUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  let domain = 'plataforma.com';
  let name = 'Nova Plataforma';
  try {
    const parsed = new URL(cleanUrl);
    domain = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const parts = domain.split('.');
    const brand = parts[0] || 'plataforma';
    name = brand.charAt(0).toUpperCase() + brand.slice(1);
  } catch {
    name = 'Nova Plataforma';
  }

  const isCareersLink = cleanUrl.includes('/careers') || cleanUrl.includes('/jobs') || cleanUrl.includes('/apply');
  const websiteUrl = cleanUrl.split('?')[0];
  const careersUrl = isCareersLink ? websiteUrl : `${websiteUrl.replace(/\/$/, '')}/careers`;

  return {
    name,
    websiteUrl,
    careersUrl,
    category: 'Treinamento de IA & Trabalho Remoto',
    currency: 'USD',
    englishRequirement: 'READING_ONLY',
    processType: 'ONLINE_EXAM',
    status: 'FAVORITE',
    paymentMethods: ['Payoneer', 'PayPal', 'Transferência Internacional'],
    averagePayRate: '$5.00 - $18.00 / hora',
    notes: `Plataforma remota identificada a partir de ${domain}. Avaliação assíncrona recomendada para trabalho em moeda forte sem exigência de entrevista oral em inglês.`
  };
}
