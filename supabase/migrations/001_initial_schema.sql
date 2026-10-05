-- ============================================================================
-- REMOTEJOBS PT - BANCO DE DADOS SUPABASE (POSTGRESQL)
-- Migração Inicial: Tabelas, Tipos Enumerados, Índices, RLS e Seeds
-- ============================================================================

-- Habilita extensão para geração de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TIPOS ENUMERADOS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_status') THEN
        CREATE TYPE platform_status AS ENUM ('HEALTHY', 'WARNING', 'ERROR', 'DISABLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
        CREATE TYPE job_status AS ENUM ('ACTIVE', 'EXPIRED', 'CLOSED', 'UNKNOWN');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'english_status_type') THEN
        CREATE TYPE english_status_type AS ENUM ('NONE', 'DESIRABLE', 'PARTIAL', 'REQUIRED', 'UNKNOWN');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portuguese_level_type') THEN
        CREATE TYPE portuguese_level_type AS ENUM ('NATIVE', 'FLUENT', 'INTERMEDIATE', 'BASIC', 'NONE', 'UNKNOWN');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'data_quality_type') THEN
        CREATE TYPE data_quality_type AS ENUM ('HIGH', 'MEDIUM', 'LOW');
    END IF;
END $$;

-- 2. TABELA DE PLATAFORMAS (Fontes iniciais)
CREATE TABLE IF NOT EXISTS platforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    website_url TEXT NOT NULL,
    jobs_url TEXT NOT NULL,
    connector_type VARCHAR(50) NOT NULL DEFAULT 'GREENHOUSE_API',
    enabled BOOLEAN DEFAULT true,
    status platform_status DEFAULT 'HEALTHY',
    last_run_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE VAGAS (jobs)
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL,
    title VARCHAR(300) NOT NULL,
    company VARCHAR(150) NOT NULL,
    url TEXT NOT NULL,
    canonical_url TEXT,
    source_url TEXT NOT NULL,
    description TEXT NOT NULL,
    description_hash VARCHAR(64) NOT NULL,
    country VARCHAR(100) DEFAULT 'Global',
    location VARCHAR(200) DEFAULT 'Remote',
    remote BOOLEAN DEFAULT true,
    employment_type VARCHAR(50) DEFAULT 'Contract',
    salary_min NUMERIC(12, 2),
    salary_max NUMERIC(12, 2),
    salary_currency VARCHAR(10) DEFAULT 'USD',
    data_quality data_quality_type DEFAULT 'HIGH',
    status job_status DEFAULT 'ACTIVE',
    published_at TIMESTAMPTZ DEFAULT NOW(),
    deadline TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_platform_external_id UNIQUE (platform_id, external_id)
);

-- 4. TABELA DE ANÁLISE DE IA (job_analysis)
CREATE TABLE IF NOT EXISTS job_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
    english_status english_status_type NOT NULL DEFAULT 'UNKNOWN',
    portuguese_required BOOLEAN DEFAULT false,
    portuguese_level portuguese_level_type DEFAULT 'UNKNOWN',
    brazil_eligible BOOLEAN DEFAULT true,
    remote_eligible BOOLEAN DEFAULT true,
    job_category VARCHAR(50) NOT NULL DEFAULT 'AI',
    experience_level VARCHAR(30) DEFAULT 'ENTRY',
    salary_detected BOOLEAN DEFAULT false,
    salary_min NUMERIC(12, 2),
    salary_max NUMERIC(12, 2),
    salary_currency VARCHAR(10),
    compatibility_score INTEGER CHECK (compatibility_score >= 0 AND compatibility_score <= 100) DEFAULT 50,
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100) DEFAULT 80,
    reason TEXT NOT NULL,
    raw_ai_response JSONB,
    analysis_version VARCHAR(20) DEFAULT 'v1',
    analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA DE LOGS DOS COLETORES (source_logs)
CREATE TABLE IF NOT EXISTS source_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL,
    jobs_found INTEGER DEFAULT 0,
    jobs_new INTEGER DEFAULT 0,
    jobs_updated INTEGER DEFAULT 0,
    jobs_rejected INTEGER DEFAULT 0,
    error_message TEXT
);

-- 6. TABELA DE HISTÓRICO DE STATUS (job_history)
CREATE TABLE IF NOT EXISTS job_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    old_status job_status,
    new_status job_status,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. FAVORITOS DO USUÁRIO
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);

-- 8. ÍNDICES DE ALTA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_published_at ON jobs(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_platform_id ON jobs(platform_id);
CREATE INDEX IF NOT EXISTS idx_jobs_description_hash ON jobs(description_hash);
CREATE INDEX IF NOT EXISTS idx_jobs_last_seen_at ON jobs(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_job_analysis_english ON job_analysis(english_status);
CREATE INDEX IF NOT EXISTS idx_job_analysis_score ON job_analysis(compatibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_job_analysis_category ON job_analysis(job_category);

-- 9. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Políticas de Leitura Pública
DROP POLICY IF EXISTS "Plataformas públicas" ON platforms;
CREATE POLICY "Plataformas públicas" ON platforms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Vagas ativas são públicas" ON jobs;
CREATE POLICY "Vagas ativas são públicas" ON jobs FOR SELECT USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "Análises são públicas" ON job_analysis;
CREATE POLICY "Análises são públicas" ON job_analysis FOR SELECT USING (true);

DROP POLICY IF EXISTS "Logs de coleta são públicos" ON source_logs;
CREATE POLICY "Logs de coleta são públicos" ON source_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Histórico de vagas é público" ON job_history;
CREATE POLICY "Histórico de vagas é público" ON job_history FOR SELECT USING (true);

-- Favoritos pertencem ao usuário autenticado
DROP POLICY IF EXISTS "Usuário gerencia próprios favoritos" ON favorites;
CREATE POLICY "Usuário gerencia próprios favoritos" ON favorites FOR ALL USING (auth.uid() = user_id);

-- 10. SEED DAS 13 PLATAFORMAS OFICIAIS DO PRD
INSERT INTO platforms (name, slug, website_url, jobs_url, connector_type, enabled, status)
VALUES
    ('Outlier.ai', 'outlier', 'https://outlier.ai', 'https://boards-api.greenhouse.io/v1/boards/outlierai/jobs?content=true', 'GREENHOUSE_API', true, 'HEALTHY'),
    ('Welocalize', 'welocalize', 'https://www.welocalize.com', 'https://www.welocalize.com/careers/', 'MANUAL_CRAWLER', true, 'HEALTHY'),
    ('Alignerr', 'alignerr', 'https://www.alignerr.com', 'https://www.alignerr.com', 'MANUAL_CRAWLER', true, 'HEALTHY'),
    ('Clickworker', 'clickworker', 'https://www.clickworker.com', 'https://www.clickworker.com/clickworker-job/', 'MANUAL_CRAWLER', true, 'HEALTHY'),
    ('CrowdGen / Appen', 'crowdgen', 'https://crowdgen.com', 'https://crowdgen.com', 'MANUAL_CRAWLER', true, 'HEALTHY'),
    ('DataAnnotation', 'dataannotation', 'https://www.dataannotation.tech', 'https://www.dataannotation.tech', 'MANUAL_CRAWLER', true, 'HEALTHY'),
    ('HubData', 'hubdata', 'https://hubdata.ai', 'https://hubdata.ai', 'MANUAL_CRAWLER', true, 'HEALTHY'),
    ('OneForma', 'oneforma', 'https://www.oneforma.com', 'https://jobs.oneforma.com', 'MANUAL_CRAWLER', true, 'HEALTHY'),
    ('Peroptyx', 'peroptyx', 'https://www.peroptyx.com', 'https://www.peroptyx.com/careers', 'MANUAL_CRAWLER', true, 'HEALTHY'),
    ('RWS', 'rws', 'https://www.rws.com', 'https://www.rws.com/careers/', 'MANUAL_CRAWLER', true, 'HEALTHY'),
    ('TELUS Digital', 'telus-digital', 'https://www.telusinternational.ai', 'https://www.telusinternational.ai/workers', 'MANUAL_CRAWLER', true, 'HEALTHY'),
    ('TesterWork', 'testerwork', 'https://testerwork.com', 'https://testerwork.com', 'MANUAL_CRAWLER', true, 'HEALTHY'),
    ('Turing', 'turing', 'https://www.turing.com', 'https://www.turing.com/jobs', 'MANUAL_CRAWLER', true, 'HEALTHY')
ON CONFLICT (slug) DO UPDATE
SET
    name = EXCLUDED.name,
    website_url = EXCLUDED.website_url,
    jobs_url = EXCLUDED.jobs_url,
    connector_type = EXCLUDED.connector_type,
    updated_at = NOW();
