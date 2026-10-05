-- ============================================================================
-- REMOTEJOBS PT - MIGRAÇÃO 002: Observações e Status de Conta das Plataformas
-- ============================================================================

-- Adiciona campo de observações e personalização na tabela platforms (se ainda não existirem)
ALTER TABLE IF EXISTS platforms 
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_status VARCHAR(50) DEFAULT 'NOT_REGISTERED',
  ADD COLUMN IF NOT EXISTS category VARCHAR(150) DEFAULT 'Treinamento de IA',
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS english_requirement VARCHAR(50) DEFAULT 'READING_ONLY',
  ADD COLUMN IF NOT EXISTS process_type VARCHAR(50) DEFAULT 'ONLINE_EXAM',
  ADD COLUMN IF NOT EXISTS average_pay_rate VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_methods TEXT[] DEFAULT '{}';

-- Permite leitura e escrita anônima/autenticada nas plataformas para o aplicativo
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'platforms' AND policyname = 'Permitir sincronização pública de plataformas'
    ) THEN
        CREATE POLICY "Permitir sincronização pública de plataformas" 
        ON platforms FOR ALL 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;
