-- ============================================================================
-- MIGRATION 005: Correção de Timestamps e Índices de Sincronização do Supabase
-- Garante que a tabela source_logs e as consultas de 'última atualização'
-- funcionem sem erros de colunas inexistentes e com alto desempenho.
-- ============================================================================

-- 1. Garante colunas de timestamp na tabela source_logs
ALTER TABLE source_logs 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Cria índices para ordenação rápida por data
CREATE INDEX IF NOT EXISTS idx_source_logs_finished_at ON source_logs(finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_logs_started_at ON source_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_logs_created_at ON source_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_last_seen_at ON jobs(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_platforms_updated_at ON platforms(updated_at DESC);

-- 3. Garante permissões irrestritas no source_logs para sincronização
DROP POLICY IF EXISTS "Public access source_logs" ON source_logs;
CREATE POLICY "Public access source_logs" ON source_logs FOR ALL USING (true) WITH CHECK (true);

-- 4. Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';
