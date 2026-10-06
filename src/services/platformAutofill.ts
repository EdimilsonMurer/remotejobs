import { KnownPlatformData, matchKnownPlatform, inferPlatformDefaults, extractCleanDomain } from './platformKnowledge';

export interface AutofillProgressCallback {
  (step: 'analyzing' | 'extracting' | 'completed' | 'fallback', message: string): void;
}

/**
 * Função principal para preenchimento automático de plataforma a partir de uma URL.
 * Combina API do servidor com Gemini 3.8 Flash, raspagem de metadados e base de conhecimento.
 */
export async function autofillPlatformFromUrl(
  rawUrl: string,
  onProgress?: AutofillProgressCallback
): Promise<KnownPlatformData> {
  const cleanInput = rawUrl.trim();
  if (!cleanInput) {
    throw new Error('Por favor, informe uma URL válida.');
  }

  const domain = extractCleanDomain(cleanInput);

  onProgress?.('analyzing', `Examinando endereço ${domain}...`);

  try {
    // Tenta chamar o endpoint de IA no backend
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    onProgress?.('extracting', `Identificando dados da plataforma e modelo de contratação com IA...`);

    const response = await fetch('/api/platforms/autofill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: cleanInput }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.name) {
        onProgress?.('completed', `Plataforma "${data.name}" reconhecida com sucesso!`);
        return {
          name: data.name,
          websiteUrl: data.websiteUrl || cleanInput,
          careersUrl: data.careersUrl || data.websiteUrl || cleanInput,
          category: data.category || 'Treinamento de IA & Trabalho Remoto',
          currency: data.currency || 'USD',
          englishRequirement: data.englishRequirement || 'READING_ONLY',
          processType: data.processType || 'ONLINE_EXAM',
          status: data.status || 'FAVORITE',
          blacklistReason: data.blacklistReason,
          paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : ['Payoneer', 'PayPal'],
          averagePayRate: data.averagePayRate || '$5.00 - $18.00 / hora',
          notes: data.notes || `Identificada automaticamente via IA para trabalho remoto.`
        };
      }
    }
  } catch (error) {
    console.warn('[Autofill API] Não foi possível consultar o backend com IA, aplicando base de dados inteligente:', error);
  }

  // Fallback rápido: base de conhecimento de alta precisão
  onProgress?.('fallback', `Consultando base especializada de plataformas remotas...`);
  const known = matchKnownPlatform(cleanInput);
  if (known) {
    onProgress?.('completed', `Plataforma "${known.name}" identificada com sucesso!`);
    return {
      ...known,
      websiteUrl: known.websiteUrl || cleanInput,
      careersUrl: known.careersUrl || cleanInput
    };
  }

  // Fallback de inferência para domínios inéditos
  const inferred = inferPlatformDefaults(cleanInput);
  onProgress?.('completed', `Estrutura de "${inferred.name}" preenchida automaticamente!`);
  return inferred;
}
