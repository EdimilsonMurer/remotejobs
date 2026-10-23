-- ============================================================================
-- MIGRATION 006: Proteção e Senha Master da Aplicação
-- Salva a senha master e configurações de segurança no Supabase
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_security (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'master',
    password_hash VARCHAR(128) NOT NULL,
    hint TEXT DEFAULT 'Senha Master do Sistema',
    last_login_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita RLS e política de acesso
ALTER TABLE app_security ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access app_security" ON app_security;
CREATE POLICY "Public access app_security" ON app_security FOR ALL USING (true) WITH CHECK (true);

-- Permissões explícitas de GRANT
GRANT ALL ON TABLE app_security TO anon, authenticated, service_role;

-- Insere a senha padrão 'remote2026' se ainda não existir
INSERT INTO app_security (id, password_hash, hint, updated_at)
VALUES (
    'master',
    '192bcc1a8bc3afe968156bb13230e482fa6fbc1858a6f5b07da8665ee997fc26',
    'Senha Master (Padrão: remote2026)',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Notifica recarregamento do schema PostgREST
NOTIFY pgrst, 'reload schema';
