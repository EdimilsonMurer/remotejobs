import { UnifiedJobWithStatus } from './jobsSyncService';

/**
 * Formata o salário da vaga quando disponível em dados estruturados, legado ou extraído do texto
 */
export function formatJobSalary(job: UnifiedJobWithStatus | any): string | null {
  if (!job) return null;

  // 1. Se a vaga já tiver o campo formatado 'salary' (ex: vagas curadas e importadas)
  if (job.salary && typeof job.salary === 'string' && job.salary.trim().length > 0) {
    return job.salary.trim();
  }

  const analysis = job.analysis;

  // 2. Verifica campos numéricos estruturados
  const min = job.salary_min ?? analysis?.salary_min;
  const max = job.salary_max ?? analysis?.salary_max;
  const rawCurrency = (job.salary_currency || analysis?.salary_currency || 'USD').toUpperCase();

  const currencyPrefix = 
    rawCurrency === 'BRL' || rawCurrency === 'R$' ? 'R$' :
    rawCurrency === 'EUR' || rawCurrency === '€' ? '€' :
    rawCurrency === 'GBP' || rawCurrency === '£' ? '£' : 'US$';

  if (min != null && max != null && min > 0 && max > 0) {
    const isMonthly = (min > 500 && rawCurrency === 'BRL') || min > 1000;
    const period = isMonthly ? '/ mês' : '/ hora';
    return `${currencyPrefix} ${min.toFixed(min % 1 === 0 ? 0 : 2)} - ${currencyPrefix} ${max.toFixed(max % 1 === 0 ? 0 : 2)} ${period}`;
  }
  if (min != null && min > 0) {
    const isMonthly = (min > 500 && rawCurrency === 'BRL') || min > 1000;
    const period = isMonthly ? '/ mês' : '/ hora';
    return `${currencyPrefix} ${min.toFixed(min % 1 === 0 ? 0 : 2)} ${period}`;
  }
  if (max != null && max > 0) {
    const isMonthly = (max > 500 && rawCurrency === 'BRL') || max > 1000;
    const period = isMonthly ? '/ mês' : '/ hora';
    return `Até ${currencyPrefix} ${max.toFixed(max % 1 === 0 ? 0 : 2)} ${period}`;
  }

  // 3. Tenta extrair padrões específicos da descrição do anúncio
  const fullText = `${job.title || ''} ${job.description || ''}`;

  // Padrão Lever / Welo Data: "Pay Rate: Based on tasks (approximately $7 per hour)" ou "approximately $6.5 per hour"
  const weloPayMatch = fullText.match(/(?:pay\s*rate|hourly\s*rate|rate)[\s:]+[^.\n\r]*?(?:approximately|approx\.?|about|\~)?\s*(\$|€|£|R\$)\s*(\d+(?:\.\d+)?)\s*(?:per\s*hour|\/hour|\/hora|\/hr|\/h)/i);
  if (weloPayMatch) {
    const sym = weloPayMatch[1] === '$' ? 'US$' : weloPayMatch[1];
    const val = parseFloat(weloPayMatch[2]);
    return `${sym} ${val.toFixed(2)} / hora (Aprox.)`;
  }

  // Padrão de Faixa Salarial: "$15.00 - $25.00 / hr", "US$ 10 - 20 / hora", "R$ 2.000 - R$ 5.000 / mês"
  const rangeMatch = fullText.match(/(?:US\$|\$|R\$|EUR|€|£)\s*(\d+(?:[.,]\d+)?)\s*(?:-|a|até|to)\s*(?:US\$|\$|R\$|EUR|€|£)?\s*(\d+(?:[.,]\d+)?)\s*(?:per\s*hour|\/hr|\/hora|\/h|\/month|\/mês|\/mo|por\s*hora|por\s*mês)?/i);
  if (rangeMatch) {
    const sym = fullText.includes('R$') ? 'R$' : fullText.includes('€') ? '€' : fullText.includes('£') ? '£' : 'US$';
    const v1 = rangeMatch[1];
    const v2 = rangeMatch[2];
    const isMonthly = /mês|month|mensal/i.test(rangeMatch[0]) || (parseFloat(v1) > 500 && sym === 'R$');
    const unit = isMonthly ? '/ mês' : '/ hora';
    return `${sym} ${v1} - ${sym} ${v2} ${unit}`;
  }

  // Padrão Salário Único: "$14.50 / hour", "€10 / hr", "R$ 3500 / mês"
  const singleMatch = fullText.match(/(?:US\$|\$|R\$|EUR|€|£)\s*(\d+(?:[.,]\d+)?)\s*(?:per\s*hour|\/hr|\/hora|\/h|\/month|\/mês|\/mo|por\s*hora|por\s*mês)/i);
  if (singleMatch) {
    const sym = fullText.includes('R$') ? 'R$' : fullText.includes('€') ? '€' : fullText.includes('£') ? '£' : 'US$';
    const val = singleMatch[1];
    const isMonthly = /mês|month|mensal/i.test(singleMatch[0]) || (parseFloat(val) > 500 && sym === 'R$');
    const unit = isMonthly ? '/ mês' : '/ hora';
    return `${sym} ${val} ${unit}`;
  }

  // Padrão de estimativa por plataforma consolidada
  const platform = (job.platform_slug || job.company || '').toLowerCase();
  if (platform.includes('welocalize') && fullText.toLowerCase().includes('rater')) {
    return 'US$ 5.00 - 8.50 / hora (Média da Plataforma)';
  }
  if (platform.includes('outlier') || platform.includes('alignerr')) {
    return 'US$ 7.50 - 25.00 / hora (Por Tarefa/Hora)';
  }
  if (platform.includes('clickworker')) {
    return '€4.00 - 12.00 / hora (UHRS / Tarefas)';
  }
  if (platform.includes('oneforma')) {
    return 'US$ 5.00 - 18.00 / hora (Projetos PT-BR)';
  }

  return null;
}

/**
 * Extrai requisitos estruturados da vaga para exibição no Diagnóstico da IA
 */
export function extractJobRequirements(job: UnifiedJobWithStatus | any): string[] {
  if (!job) return [];
  const reqs: string[] = [];
  const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  const analysis = job.analysis;

  // 1. Destaques legados diretos
  if (Array.isArray(job.highlights) && job.highlights.length > 0) {
    return job.highlights.map((h: string) => h.trim()).filter(Boolean);
  }

  // 2. Requisitos de Idioma Português
  if (analysis?.portuguese_required) {
    if (analysis.portuguese_level === 'NATIVE') {
      reqs.push('Português Brasileiro Nativo (Excelente escrita e interpretação)');
    } else {
      reqs.push('Português do Brasil Fluente ou Avançado');
    }
  } else if (text.includes('portuguese') || text.includes('português') || text.includes('pt-br')) {
    reqs.push('Domínio de Português Brasileiro (PT-BR)');
  }

  // 3. Status de Inglês & Processo de Seleção
  if (analysis?.english_status === 'NONE') {
    reqs.push('Sem entrevista falada em inglês (Processo por teste online)');
  } else if (analysis?.english_status === 'DESIRABLE') {
    reqs.push('Inglês básico apenas para leitura da plataforma (Desejável)');
  } else if (analysis?.english_status === 'REQUIRED') {
    reqs.push('Comunicação em inglês necessária para algumas etapas');
  }

  // 4. Elegibilidade e Residência
  if (job.country?.toLowerCase().includes('brasil') || job.location?.toLowerCase().includes('brazil') || analysis?.brazil_eligible || text.includes('brazil')) {
    reqs.push('Residir atualmente no Brasil');
  }

  // 5. Equipamento & Conexão
  if (text.includes('computer') || text.includes('laptop') || text.includes('computador') || text.includes('notebook') || text.includes('pc')) {
    reqs.push('Computador ou Notebook com internet estável');
  } else if (job.remote) {
    reqs.push('Acesso à internet banda larga para trabalho 100% remoto');
  }

  if (text.includes('smartphone') || text.includes('celular') || text.includes('android') || text.includes('ios')) {
    reqs.push('Smartphone Android ou iOS ativo');
  }

  // 6. Carga Horária & Flexibilidade
  if (text.includes('5 to 20') || text.includes('5-20') || text.includes('minimum commitment is 5')) {
    reqs.push('Disponibilidade de 5 a 20 horas por semana (Horário 100% flexível)');
  } else if (text.includes('10-20') || text.includes('10 to 20') || text.includes('20 hours') || text.includes('20 horas')) {
    reqs.push('Disponibilidade de 10 a 20h semanais (Horário flexível)');
  } else if (text.includes('flexible') || text.includes('flexível') || text.includes('part time') || text.includes('part-time')) {
    reqs.push('Horário 100% livre e autônomo (Freelance / PJ)');
  }

  // 7. Experiência
  if (analysis?.experience_level === 'ENTRY' || text.includes('no formal interview') || text.includes('no experience') || text.includes('entry level')) {
    reqs.push('Não exige experiência prévia (Treinamento guiado online)');
  } else if (text.includes('search engine') || text.includes('rater') || text.includes('avaliação')) {
    reqs.push('Afinidade com pesquisas na internet e ferramentas digitais');
  }

  // 8. Idade Mínima
  if (text.includes('18 years') || text.includes('18 anos') || text.includes('maior de 18')) {
    reqs.push('Idade mínima de 18 anos completos');
  }

  // Remove duplicatas
  return Array.from(new Set(reqs));
}

