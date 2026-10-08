import { JobOpportunity } from '../types/job';

/**
 * Base de vagas manuais descontinuada.
 * Vagas fabricadas/fictícias foram totalmente removidas do sistema.
 * Todas as vagas agora são obtidas exclusivamente via conectores de fontes oficiais
 * ou cadastradas explicitamente pelo usuário, sendo sincronizadas no Supabase.
 * Se uma fonte não possuir dados ou falhar, o app exibe "sem dados".
 */
export const CURATED_JOBS: JobOpportunity[] = [];
