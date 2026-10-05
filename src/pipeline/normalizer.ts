/**
 * Utilitário de normalização e higienização de textos de vagas
 */
export function sanitizeText(input: string): string {
  if (!input) return '';

  return input
    // Decodifica entidades HTML comuns
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Remove tags HTML
    .replace(/<[^>]*>/g, ' ')
    // Remove múltiplos espaços e quebras excessivas
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}
