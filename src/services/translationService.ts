/**
 * Serviço de tradução de descrições de vagas para Português do Brasil (pt-BR)
 * Combina cache local, dicionário de termos de trabalho remoto e chamada à API Gemini
 */

const STORAGE_KEY_TRANSLATIONS = 'remotehunter_job_translations_v1';

// Cache em memória
const memoryCache = new Map<string, string>();

// Carrega cache salvo no localStorage
function getStoredCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRANSLATIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStoredCache(key: string, value: string): void {
  try {
    const cache = getStoredCache();
    cache[key] = value;
    localStorage.setItem(STORAGE_KEY_TRANSLATIONS, JSON.stringify(cache));
  } catch {}
}

/**
 * Dicionário heurístico de tradução rápida para termos comuns de vagas de IA e trabalho remoto
 */
const COMMON_PHRASES: [RegExp, string][] = [
  [/About Welocalize/gi, 'Sobre a Welocalize'],
  [/Welocalize, a Welo Global brand, serves localization teams through AI-enabled multilingual content solutions that enable enterprises to operate and scale globally\./gi, 'A Welocalize, uma marca global Welo, atende equipes de localização por meio de soluções de conteúdo multilíngue habilitadas por IA que permitem às empresas operar e escalar globalmente.'],
  [/Welocalize combines AI, automation, and human expertise to support enterprises in more than 300 languages, enabling accurate, culturally aligned, and compliant multilingual content at scale\./gi, 'A Welocalize combina inteligência artificial, automação e experiência humana para apoiar empresas em mais de 300 idiomas, permitindo a criação de conteúdo multilíngue preciso, culturalmente alinhado e em conformidade em grande escala.'],
  [/Welo Data is an award-winning localization and data transformation company\. We run one of the world[’']s largest Ads Rating Programs and we want you to join!/gi, 'A Welo Data é uma empresa premiada de localização e transformação de dados. Operamos um dos maiores programas de avaliação de anúncios publicitários (Ads Rating) do mundo e queremos você em nosso time!'],
  [/As an Ads Quality Rater, you will review and grade internet advertisements to help shape how ads are delivered to the end users\./gi, 'Como Avaliador de Qualidade de Anúncios (Ads Quality Rater), você revisará e classificará anúncios da internet para ajudar a calibrar como os anúncios são exibidos aos usuários.'],
  [/In other words, you[’']ll tell the AI program how good or bad its advertisement suggestions are based on the user[’']s keywords\./gi, 'Em outras palavras, você ensinará o sistema de inteligência artificial quão boas ou ruins são as sugestões de anúncios com base nas palavras-chave pesquisadas pelos usuários.'],
  [/You will review ads in both English and German/gi, 'Você analisará anúncios em inglês e alemão'],
  [/You will review ads in both English and Italian/gi, 'Você analisará anúncios em inglês e italiano'],
  [/You will review ads in both English and Portuguese/gi, 'Você analisará anúncios em português e inglês'],
  [/This role is great for people who:/gi, 'Esta função é ideal para quem:'],
  [/Surf the internet daily/gi, 'Navega diariamente na internet'],
  [/Use major search engines frequently/gi, 'Utiliza mecanismos de busca com frequência'],
  [/Know what people want based on a few keywords/gi, 'Entende a intenção de busca dos usuários a partir de palavras-chave'],
  [/Enjoy researching topics online/gi, 'Gosta de pesquisar assuntos na internet'],
  [/Want a flexible and fun side job/gi, 'Deseja uma renda extra flexível e sem estresse'],
  [/Project Details/gi, 'Detalhes do Projeto'],
  [/Job Title:/gi, 'Cargo / Título:'],
  [/Pay Rate: Based on tasks \(approximately \$([0-9.]+) per hour\)/gi, 'Remuneração: Paga por tarefa (aproximadamente $$$1 por hora)'],
  [/Location: Remote\/work from home - must be based in Brazil/gi, 'Local: 100% Remoto / Home Office - deve residir no Brasil'],
  [/Location: Remote, Brazil-based/gi, 'Local: Remoto, residente no Brasil'],
  [/Hours: Set your schedule based on the following – Minimum commitment is 5 hours per week\. You can choose to work up to 20 hours per week\./gi, 'Carga Horária: Você define seus horários – Compromisso mínimo de 5h por semana, podendo trabalhar até 20h por semana.'],
  [/Start Date: ASAP/gi, 'Data de Início: Imediata (o mais breve possível)'],
  [/Employment Type: Independent Contractor\/Freelance\/Self-Employed/gi, 'Tipo de Contrato: Prestador de Serviços Independente / Freelance / Autônomo'],
  [/Project Duration: Long-term/gi, 'Duração do Projeto: Longo prazo'],
  [/Recruitment Process/gi, 'Processo Seletivo'],
  [/There is no formal interview for this job! No phone calls, no waiting, and no wasting time wondering whether you got the job or not\./gi, 'NÃO HÁ ENTREVISTA FORMAL PARA ESTA VAGA! Sem chamadas de vídeo, sem entrevistas telefônicas e sem espera angustiante.'],
  [/Instead, you will be guided through a self-paced and automated recruitment process\./gi, 'O processo é 100% automatizado, permitindo que você complete o treinamento e a qualificação no seu próprio ritmo.'],
  [/MAIN PURPOSE OF THE ROLE/gi, 'OBJETIVO PRINCIPAL DA FUNÇÃO'],
  [/MAIN DUTIES/gi, 'PRINCIPAIS RESPONSABILIDADES'],
  [/Are you a search engine guru\? Can you find what you['’]re looking for with just a few keywords\? We have a unique opportunity for you to put your skills to the test!/gi, 'Você tem facilidade com buscas na internet? Consegue encontrar o que procura com poucas palavras-chave? Esta é uma oportunidade excelente para colocar suas habilidades em prática!'],
  [/Welocalize is looking for an Portuguese \(Brazil\) speaker in Brazil to help support our client['’]s project as Junior Quality Coordinator\./gi, 'A Welocalize busca falantes nativos de Português do Brasil para apoiar o projeto de nosso cliente como Coordenador Júnior de Qualidade.'],
  [/Performance Analysis/gi, 'Análise de Desempenho e Qualidade'],
  [/Completes Internal Assessments\./gi, 'Realiza avaliações e testes internos de qualidade.'],
  [/Provides feedback on blind test ranges and queries coming from the team\./gi, 'Fornece feedback e orientações sobre testes práticos da equipe.'],
  [/May provide ad-hoc support to raters and educate them on best practices and client’s expectations\./gi, 'Oferece suporte aos avaliadores (raters) orientando sobre melhores práticas e diretrizes.'],
  [/Training and support/gi, 'Treinamento e Suporte'],
  [/Analytics, Reporting, Knowledge, and Asset Management/gi, 'Métricas, Relatórios e Gestão de Conhecimento'],
  [/Communication/gi, 'Comunicação e Alinhamento'],
  [/Other/gi, 'Outras Atividades'],
  [/When you join Welocalize, you have the opportunity to bring your career to the next level:/gi, 'Benefícios de trabalhar com a Welocalize:'],
  [/receive steady volume of work and long-term partnership/gi, 'Volume contínuo de tarefas e parceria de longo prazo'],
  [/professional development: work on exciting projects that will empower you keep learning and growing/gi, 'Desenvolvimento contínuo em projetos de ponta de IA e dados'],
  [/work with multicultural, international team with a great variety of documents and content types/gi, 'Trabalho com equipe internacional multicultural'],
  [/24-hour 6-day a week support from our Community team\./gi, 'Suporte comunitário ativo para esclarecimento de dúvidas.'],
  [/If this opportunity sounds appealing to you, apply below\./gi, 'Se esta vaga combina com o seu perfil, candidate-se no link oficial abaixo.'],
  [/What You[’']ll Need/gi, 'Requisitos Necessários'],
  [/What You['’]re Looking For/gi, 'O Que Procuramos'],
  [/Why Join Us\?/gi, 'Por que Trabalhar Conosco?'],
  [/About our projects:/gi, 'Sobre Nossos Projetos:'],
  [/How to Apply\?/gi, 'Como se Candidatar?'],
  [/Questions\?/gi, 'Dúvidas?']
];

/**
 * Tradução heurística imediata em milissegundos
 */
export function quickTranslateText(text: string): string {
  if (!text) return '';

  let result = text;
  for (const [regex, replacement] of COMMON_PHRASES) {
    result = result.replace(regex, replacement);
  }

  // Traduções adicionais de termos avulsos se a maioria do texto for em inglês
  result = result
    .replace(/\bResponsibilities:\b/gi, 'Responsabilidades:')
    .replace(/\bRequirements:\b/gi, 'Requisitos:')
    .replace(/\bQualifications:\b/gi, 'Qualificações:')
    .replace(/\bBenefits:\b/gi, 'Benefícios:')
    .replace(/\bAbout the Role:\b/gi, 'Sobre a Função:')
    .replace(/\bAbout the Team:\b/gi, 'Sobre a Equipe:')
    .replace(/\bJob Description\b/gi, 'Descrição da Vaga')
    .replace(/\bApply Now\b/gi, 'Candidatar-se Agora')
    .replace(/\bRemote, Worldwide\b/gi, 'Remoto, Global')
    .replace(/\bContract \/ Freelance\b/gi, 'Contrato / Freelance')
    .replace(/\bPart-time\b/gi, 'Meio período')
    .replace(/\bFull-time\b/gi, 'Período integral')
    .replace(/\bFlexible hours\b/gi, 'Horários flexíveis')
    .replace(/\bWork from home\b/gi, 'Trabalho em home office')
    .replace(/\bper hour\b/gi, 'por hora');

  return result;
}

/**
 * Obtém a tradução para português.
 * Se já estiver em cache, retorna de imediato.
 * Caso contrário, retorna tradução rápida e dispara enriquecimento via Gemini no servidor.
 */
export async function getPortugueseJobDescription(
  jobId: string, 
  originalDescription: string,
  onGeminiCompleted?: (translated: string) => void
): Promise<string> {
  if (!originalDescription) return '';

  // 1. Checa memória
  if (memoryCache.has(jobId)) {
    return memoryCache.get(jobId)!;
  }

  // 2. Checa localStorage
  const stored = getStoredCache();
  if (stored[jobId]) {
    memoryCache.set(jobId, stored[jobId]);
    return stored[jobId];
  }

  // 3. Aplica tradução rápida determinística
  const quickResult = quickTranslateText(originalDescription);
  memoryCache.set(jobId, quickResult);

  // 4. Em segundo plano, busca tradução fluida com Gemini 3.8 Flash no backend
  try {
    fetch('/api/jobs/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: originalDescription })
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.translatedText && data.translatedText !== originalDescription) {
          memoryCache.set(jobId, data.translatedText);
          saveToStoredCache(jobId, data.translatedText);
          onGeminiCompleted?.(data.translatedText);
        }
      })
      .catch(err => {
        console.warn('[TranslationService] Backend translation skipped:', err);
      });
  } catch {}

  return quickResult;
}
