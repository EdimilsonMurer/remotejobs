import { createHash } from 'crypto';

/**
 * Normaliza e gera um hash SHA-256 estável da descrição da vaga.
 * Usado para detectar se a vaga sofreu alterações reais antes de chamar a IA.
 */
export function generateDescriptionHash(description: string): string {
  if (!description) return '';
  
  // Normaliza espaços em branco e caixa para que alterações cosméticas não invalidem o hash
  const normalized = description
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Normaliza URLs removendo parâmetros de rastreamento (UTM, ref, fbclid, etc.)
 */
export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    // Remove query params de tracking
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source', 'fbclid', 'gclid'];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    // Remove trailing slash
    let clean = parsed.toString().replace(/\/$/, '');
    return clean;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/$/, '');
  }
}
