-- ============================================================================
-- REMOTEHUNTER PRO / REMOTEJOBS PT - SCHEMA UNIFICADO E COMPLETO DO SUPABASE
-- Execute este script no SQL Editor do seu projeto Supabase:
-- Painel Supabase > SQL Editor > New Query > Colar este código > Run
-- ============================================================================

-- 1. HABILITAR EXTENSÃO UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TIPOS ENUMERADOS (com verificação defensiva)
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

-- 3. TABELA DE PLATAFORMAS (platforms)
CREATE TABLE IF NOT EXISTS platforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL UNIQUE,
    slug VARCHAR(150) NOT NULL UNIQUE,
    website_url TEXT NOT NULL,
    jobs_url TEXT NOT NULL,
    connector_type VARCHAR(50) NOT NULL DEFAULT 'MANUAL_CRAWLER',
    category VARCHAR(150) DEFAULT 'Treinamento de IA',
    currency VARCHAR(10) DEFAULT 'USD',
    english_requirement VARCHAR(50) DEFAULT 'READING_ONLY',
    process_type VARCHAR(50) DEFAULT 'ONLINE_EXAM',
    user_status VARCHAR(50) DEFAULT 'NOT_REGISTERED',
    notes TEXT DEFAULT '',
    average_pay_rate VARCHAR(100),
    payment_methods TEXT[] DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'HEALTHY',
    last_run_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garante que todas as colunas existem mesmo se a tabela já foi criada anteriormente
ALTER TABLE platforms 
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_status VARCHAR(50) DEFAULT 'NOT_REGISTERED',
  ADD COLUMN IF NOT EXISTS category VARCHAR(150) DEFAULT 'Treinamento de IA',
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS english_requirement VARCHAR(50) DEFAULT 'READING_ONLY',
  ADD COLUMN IF NOT EXISTS process_type VARCHAR(50) DEFAULT 'ONLINE_EXAM',
  ADD COLUMN IF NOT EXISTS average_pay_rate VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_methods TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS connector_type VARCHAR(50) DEFAULT 'MANUAL_CRAWLER',
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'HEALTHY';

-- 4. TABELA DE VAGAS (jobs)
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id UUID REFERENCES platforms(id) ON DELETE CASCADE,
    platform_slug VARCHAR(150) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    title VARCHAR(300) NOT NULL,
    company VARCHAR(150) NOT NULL,
    url TEXT NOT NULL,
    canonical_url TEXT,
    source_url TEXT NOT NULL,
    description TEXT NOT NULL,
    description_hash VARCHAR(64) NOT NULL DEFAULT '',
    country VARCHAR(100) DEFAULT 'Brasil',
    location VARCHAR(200) DEFAULT 'Remoto',
    remote BOOLEAN DEFAULT true,
    employment_type VARCHAR(100) DEFAULT 'Freelance',
    salary_min NUMERIC(12, 2),
    salary_max NUMERIC(12, 2),
    salary_currency VARCHAR(10) DEFAULT 'USD',
    data_quality VARCHAR(30) DEFAULT 'HIGH',
    status VARCHAR(30) DEFAULT 'ACTIVE',
    published_at TIMESTAMPTZ DEFAULT NOW(),
    deadline TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_platform_slug_external_id UNIQUE (platform_slug, external_id)
);

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS platform_slug VARCHAR(150),
  ADD COLUMN IF NOT EXISTS description_hash VARCHAR(64) DEFAULT '',
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Brasil',
  ADD COLUMN IF NOT EXISTS location VARCHAR(200) DEFAULT 'Remoto',
  ADD COLUMN IF NOT EXISTS remote BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS employment_type VARCHAR(100) DEFAULT 'Freelance',
  ADD COLUMN IF NOT EXISTS salary_min NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS salary_max NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(10) DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ACTIVE';

-- 5. TABELA DE ANÁLISE DE IA DAS VAGAS (job_analysis)
CREATE TABLE IF NOT EXISTS job_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    english_status VARCHAR(50) NOT NULL DEFAULT 'READING_ONLY',
    portuguese_required BOOLEAN DEFAULT true,
    portuguese_level VARCHAR(50) DEFAULT 'NATIVE',
    brazil_eligible BOOLEAN DEFAULT true,
    remote_eligible BOOLEAN DEFAULT true,
    job_category VARCHAR(100) NOT NULL DEFAULT 'AI',
    experience_level VARCHAR(50) DEFAULT 'ENTRY',
    salary_detected BOOLEAN DEFAULT false,
    salary_min NUMERIC(12, 2),
    salary_max NUMERIC(12, 2),
    salary_currency VARCHAR(10) DEFAULT 'USD',
    compatibility_score INTEGER CHECK (compatibility_score >= 0 AND compatibility_score <= 100) DEFAULT 90,
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100) DEFAULT 85,
    reason TEXT NOT NULL DEFAULT '',
    raw_ai_response JSONB,
    analysis_version VARCHAR(30) DEFAULT 'v1',
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_job_analysis_job_id UNIQUE (job_id)
);

-- 6. TABELA DE CANDIDATURAS & ACOMPANHAMENTO (job_applications)
CREATE TABLE IF NOT EXISTS job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_slug VARCHAR(150) NOT NULL,
    platform_name VARCHAR(150),
    job_external_id VARCHAR(255),
    job_title VARCHAR(300),
    status VARCHAR(50) NOT NULL DEFAULT 'REGISTERED',
    notes TEXT DEFAULT '',
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA DE PALAVRAS BLOQUEADAS (blocked_keywords)
CREATE TABLE IF NOT EXISTS blocked_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    term VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) DEFAULT 'IDIOMA_ESTRANGEIRO',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABELA DE LOGS DE COLETA (source_logs)
CREATE TABLE IF NOT EXISTS source_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_slug VARCHAR(150) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL,
    jobs_found INTEGER DEFAULT 0,
    jobs_new INTEGER DEFAULT 0,
    jobs_updated INTEGER DEFAULT 0,
    jobs_rejected INTEGER DEFAULT 0,
    error_message TEXT
);

-- 9. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_platforms_slug ON platforms(slug);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_platform_slug ON jobs(platform_slug);
CREATE INDEX IF NOT EXISTS idx_jobs_published_at ON jobs(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_analysis_job_id ON job_analysis(job_id);
CREATE INDEX IF NOT EXISTS idx_job_analysis_score ON job_analysis(compatibility_score DESC);

-- 10. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- Garante acesso de LEITURA e ESCRITA pública para a aplicação Web (chave anon)
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access platforms" ON platforms;
CREATE POLICY "Public access platforms" ON platforms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access jobs" ON jobs;
CREATE POLICY "Public access jobs" ON jobs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access job_analysis" ON job_analysis;
CREATE POLICY "Public access job_analysis" ON job_analysis FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access job_applications" ON job_applications;
CREATE POLICY "Public access job_applications" ON job_applications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access blocked_keywords" ON blocked_keywords;
CREATE POLICY "Public access blocked_keywords" ON blocked_keywords FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access source_logs" ON source_logs;
CREATE POLICY "Public access source_logs" ON source_logs FOR ALL USING (true) WITH CHECK (true);

-- 11. SEED INICIAL DAS 13 PLATAFORMAS OFICIAIS
INSERT INTO platforms (name, slug, website_url, jobs_url, connector_type, category, currency, english_requirement, process_type, average_pay_rate, payment_methods, notes, status, enabled)
VALUES
    ('Welocalize', 'welocalize', 'https://www.welocalize.com', 'https://www.welocalize.com/careers/', 'LEVER_API', 'Treinamento de IA & Avaliação', 'USD', 'READING_ONLY', 'ONLINE_EXAM', '$5.00 - $8.50 / hora', '{"Hyperwallet","Wire Transfer"}', 'Excelente para brasileiros. Testes teóricos de guidelines com consulta permitida. Sem chamadas orais.', 'HEALTHY', true),
    ('Outlier.ai', 'outlier', 'https://outlier.ai', 'https://boards-api.greenhouse.io/v1/boards/outlierai/jobs?content=true', 'GREENHOUSE_API', 'Treinamento de LLMs (RLHF)', 'USD', 'READING_ONLY', 'ONLINE_EXAM', '$7.50 - $18.00 / hora', '{"PayPal","AirTM"}', 'Pagamentos semanais pontuais em dólar. Projetos de escrita e avaliação de respostas em português.', 'HEALTHY', true),
    ('Alignerr', 'alignerr', 'https://www.alignerr.com', 'https://www.alignerr.com', 'MANUAL_CRAWLER', 'Anotação de Dados & IA', 'USD', 'READING_ONLY', 'ONLINE_EXAM', '$15.00 - $35.00 / hora', '{"Deel"}', 'Foco em especialistas de linguagem e programação. Avaliação técnica inicial online.', 'HEALTHY', true),
    ('Clickworker', 'clickworker', 'https://www.clickworker.com', 'https://www.clickworker.com/clickworker-job/', 'MANUAL_CRAWLER', 'Microtarefas & UHRS', 'EUR', 'NONE', 'NO_INTERVIEW', '€5.00 - €12.00 / hora', '{"Payoneer","PayPal"}', 'Acesso direto ao ecossistema UHRS da Microsoft. Muitas tarefas 100% em português.', 'HEALTHY', true),
    ('CrowdGen / Appen', 'crowdgen', 'https://crowdgen.com', 'https://crowdgen.com', 'MANUAL_CRAWLER', 'Avaliação de Busca & Áudio', 'USD', 'READING_ONLY', 'ONLINE_EXAM', '$3.50 - $7.00 / hora', '{"Payoneer"}', 'Nova plataforma unificada da Appen. Cadastro simples e testes por projeto.', 'HEALTHY', true),
    ('DataAnnotation', 'dataannotation', 'https://www.dataannotation.tech', 'https://www.dataannotation.tech', 'MANUAL_CRAWLER', 'Avaliação de IA & Chatbots', 'USD', 'READING_ONLY', 'ONLINE_EXAM', '$20.00+ / hora', '{"PayPal"}', 'Remuneração excelente para quem passa no exame prático de raciocínio e escrita.', 'HEALTHY', true),
    ('HubData', 'hubdata', 'https://hubdata.ai', 'https://hubdata.ai', 'MANUAL_CRAWLER', 'Treinamento de IA em Português', 'USD', 'NONE', 'ONLINE_EXAM', '$5.00 - $10.00 / hora', '{"PayPal","Transferência"}', 'Projetos nativos para o mercado de língua portuguesa.', 'HEALTHY', true),
    ('OneForma', 'oneforma', 'https://www.oneforma.com', 'https://jobs.oneforma.com', 'MANUAL_CRAWLER', 'Tradução & IA', 'USD', 'READING_ONLY', 'ONLINE_EXAM', '$5.00 - $12.00 / hora', '{"Payoneer"}', 'Centenas de certificações gratuitas e projetos variados para o Brasil.', 'HEALTHY', true),
    ('Peroptyx', 'peroptyx', 'https://www.peroptyx.com', 'https://www.peroptyx.com/careers', 'MANUAL_CRAWLER', 'Avaliação de Mapas & Busca', 'EUR', 'READING_ONLY', 'ONLINE_EXAM', '€6.00 - €10.00 / hora', '{"Transferência Bancária"}', 'Avaliação de rotas e pontos geográficos no Brasil.', 'HEALTHY', true),
    ('RWS', 'rws', 'https://www.rws.com', 'https://www.rws.com/careers/', 'MANUAL_CRAWLER', 'Tradução & Anotação de IA', 'USD', 'READING_ONLY', 'ONLINE_EXAM', '$6.00 - $14.00 / hora', '{"Payoneer"}', 'Gigante global de localização de conteúdo com vagas contínuas para português.', 'HEALTHY', true),
    ('TELUS Digital', 'telus-digital', 'https://www.telusinternational.ai', 'https://www.telusinternational.ai/workers', 'MANUAL_CRAWLER', 'Avaliação de Mídia & Busca', 'USD', 'READING_ONLY', 'ONLINE_EXAM', '$4.50 - $8.00 / hora', '{"Hyperwallet"}', 'Projetos tradicionais de longo prazo como Rater e Map Analyst no Brasil.', 'HEALTHY', true),
    ('TesterWork', 'testerwork', 'https://testerwork.com', 'https://testerwork.com', 'MANUAL_CRAWLER', 'Testes de Aplicativos (QA)', 'USD', 'READING_ONLY', 'ONLINE_EXAM', '$10.00 - $40.00 por teste', '{"PayPal","Upwork"}', 'Paga por bugs encontrados e ciclos de testes funcionais executados.', 'HEALTHY', true),
    ('Turing', 'turing', 'https://www.turing.com', 'https://www.turing.com/jobs', 'MANUAL_CRAWLER', 'Desenvolvimento & IA', 'USD', 'BASIC', 'ONLINE_EXAM', '$15.00 - $40.00 / hora', '{"Transferência Bancária"}', 'Foco em desenvolvedores e treinadores de IA em código.', 'HEALTHY', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    website_url = EXCLUDED.website_url,
    jobs_url = EXCLUDED.jobs_url,
    category = EXCLUDED.category,
    currency = EXCLUDED.currency,
    english_requirement = EXCLUDED.english_requirement,
    process_type = EXCLUDED.process_type,
    average_pay_rate = EXCLUDED.average_pay_rate,
    payment_methods = EXCLUDED.payment_methods,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- 12. SEED INICIAL DE PALAVRAS PROIBIDAS
INSERT INTO blocked_keywords (term, category) VALUES
    ('italiano', 'IDIOMA_ESTRANGEIRO'),
    ('italian', 'IDIOMA_ESTRANGEIRO'),
    ('inglês', 'IDIOMA_ESTRANGEIRO'),
    ('ingles', 'IDIOMA_ESTRANGEIRO'),
    ('english', 'IDIOMA_ESTRANGEIRO'),
    ('bilíngue', 'IDIOMA_ESTRANGEIRO'),
    ('bilingue', 'IDIOMA_ESTRANGEIRO'),
    ('bilingual', 'IDIOMA_ESTRANGEIRO'),
    ('espanhol', 'IDIOMA_ESTRANGEIRO'),
    ('spanish', 'IDIOMA_ESTRANGEIRO'),
    ('alemão', 'IDIOMA_ESTRANGEIRO'),
    ('alemao', 'IDIOMA_ESTRANGEIRO'),
    ('german', 'IDIOMA_ESTRANGEIRO'),
    ('francês', 'IDIOMA_ESTRANGEIRO'),
    ('frances', 'IDIOMA_ESTRANGEIRO'),
    ('french', 'IDIOMA_ESTRANGEIRO'),
    ('japonês', 'IDIOMA_ESTRANGEIRO'),
    ('japones', 'IDIOMA_ESTRANGEIRO'),
    ('japanese', 'IDIOMA_ESTRANGEIRO'),
    ('mandarim', 'IDIOMA_ESTRANGEIRO'),
    ('mandarin', 'IDIOMA_ESTRANGEIRO'),
    ('chinês', 'IDIOMA_ESTRANGEIRO'),
    ('chines', 'IDIOMA_ESTRANGEIRO'),
    ('chinese', 'IDIOMA_ESTRANGEIRO')
ON CONFLICT (term) DO NOTHING;

-- 13. RECARREGA CACHE DO SCHEMA POSTGREST
NOTIFY pgrst, 'reload schema';
