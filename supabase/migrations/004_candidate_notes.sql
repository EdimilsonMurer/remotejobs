-- ============================================================================
-- MIGRATION 004: TABELA DO BLOCO DE NOTAS DO CANDIDATO (candidate_notes)
-- Armazena dados cadastrais, links de currículo, textos prontos (PT/EN),
-- taxas e anotações livres para preenchimento rápido de vagas.
-- ============================================================================

CREATE TABLE IF NOT EXISTS candidate_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    full_name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    city TEXT DEFAULT '',
    state TEXT DEFAULT '',
    country TEXT DEFAULT 'Brasil',
    timezone TEXT DEFAULT 'America/Sao_Paulo (UTC-3)',
    linkedin_url TEXT DEFAULT '',
    github_url TEXT DEFAULT '',
    portfolio_url TEXT DEFAULT '',
    resume_url TEXT DEFAULT '',
    resume_en_url TEXT DEFAULT '',
    hourly_rate_usd TEXT DEFAULT '',
    monthly_salary_usd TEXT DEFAULT '',
    availability TEXT DEFAULT 'Imediata',
    hours_per_week TEXT DEFAULT '40h/semana',
    payment_paypal TEXT DEFAULT '',
    payment_payoneer TEXT DEFAULT '',
    payment_deel TEXT DEFAULT '',
    payment_wise TEXT DEFAULT '',
    tax_id TEXT DEFAULT '',
    short_bio_pt TEXT DEFAULT '',
    short_bio_en TEXT DEFAULT '',
    cover_letter_pt TEXT DEFAULT '',
    cover_letter_en TEXT DEFAULT '',
    ai_experience_en TEXT DEFAULT '',
    english_level_statement TEXT DEFAULT '',
    hardware_specs TEXT DEFAULT '',
    free_notes TEXT DEFAULT '',
    custom_snippets JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ativar Row Level Security
ALTER TABLE candidate_notes ENABLE ROW LEVEL SECURITY;

-- Política de acesso total público/autenticado para este aplicativo
DROP POLICY IF EXISTS "Public access candidate_notes" ON candidate_notes;
CREATE POLICY "Public access candidate_notes" ON candidate_notes FOR ALL USING (true) WITH CHECK (true);

-- Permissões explícitas de GRANT
GRANT ALL ON TABLE candidate_notes TO anon, authenticated, service_role;

-- Recarrega cache do PostgREST
NOTIFY pgrst, 'reload schema';
