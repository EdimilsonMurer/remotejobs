# 🌐 RemoteJobs PT - Vagas Remotas Internacionais para Brasileiros

> Plataforma inteligente para encontrar oportunidades remotas internacionais pagas em moeda forte (Dólar/Euro) e identificar, através de IA (Google Gemini), quais realmente são adequadas para pessoas que não dominam inglês.

---

## 🚀 Funcionalidades Principais

- 🔍 **Radar de Vagas com Classificação Semântica por IA:**
  - Análise contextual profunda com **Google Gemini** para entender o nível real de idioma exigido nas tarefas diárias.
  - Selos oficiais de idioma:
    - 🟢 **Sem inglês identificado**
    - 🟡 **Inglês desejável**
    - 🟠 **Inglês parcial**
    - 🔴 **Inglês necessário**
    - ⚪ **Informação insuficiente**
  - Barra de score de compatibilidade (0 a 100%).
  - Justificativa transparente da IA para cada oportunidade.
- 🎯 **Filtros Ágeis:** Interruptor *"Apenas sem inglês obrigatório"*, filtro por plataforma, nível de idioma e score mínimo.
- 🛡️ **100% Oficial & Seguro:** Links diretos para os portais oficiais das empresas (Welocalize, Turing, Outlier / Scale AI, etc.). Sem formulários falsos, intermediários ou taxas.
- 🏢 **Central de Plataformas:** Gestão de status de cadastro (Em análise, Aprovado, Teste pendente).
- 🚫 **Gestão de Lista Negra:** Bloqueio de plataformas ou intermediários indesejados.
- 📊 **Painel de Telemetria e Logs (`source_logs`):** Monitoramento em tempo real do tempo de resposta e status dos coletores.
- 🤖 **Robô de Automação CrewAI & Simulador de Câmbio:** Scripts Python para scraping local e calculadora de conversão USD/EUR para BRL.

---

## 🏛️ Guia Profissional de Arquitetura & Implantação

Este projeto foi estruturado seguindo as 4 diretrizes fundamentais de engenharia de software:

### 1️⃣ Tudo Gravado no Supabase (PostgreSQL)
Todos os dados principais (Plataformas, Vagas, Análises de IA, Candidaturas e Palavras Bloqueadas) são persistidos no Supabase:
- **Tabela `platforms`:** Catálogo de plataformas com anotações estratégicas, status de cadastro do usuário, remunerações e moedas.
- **Tabela `jobs`:** Registro persistente de todas as vagas de emprego com deduplicação por hash SHA-256.
- **Tabela `job_analysis`:** Diagnóstico semântico estruturado pela IA (nível de inglês, elegibilidade Brasil, categoria, score de compatibilidade e justificativa).
- **Tabela `job_applications`:** Rastreamento do progresso das suas candidaturas.
- **Tabela `blocked_keywords`:** Regras do filtro anti-idiomas estrangeiros.
- **Tabela `source_logs`:** Telemetria de coletas automáticas.

#### Como criar ou atualizar as tabelas no Supabase (1 minuto):
1. Acesse o painel do seu projeto no Supabase ([supabase.com/dashboard](https://supabase.com/dashboard)).
2. No menu lateral esquerdo, clique em **SQL Editor** > **New Query**.
3. Abra o arquivo `/supabase/migrations/003_complete_unified_schema.sql` (ou copie pelo botão nas Configurações do app), cole no editor e clique em **Run**.
4. Pronto! Todas as tabelas e permissões públicas (RLS) estarão ativas. Em seguida, acesse a aba **Configurações** no app e clique em **"Sincronizar TUDO no Supabase"** para popular o banco de dados.

---

### 2️⃣ Hospedagem na Vercel
O projeto é 100% compatível com a infraestrutura Serverless da Vercel:
1. Conecte o repositório GitHub à sua conta Vercel em [vercel.com/new](https://vercel.com/new).
2. O framework é detectado como **Vite** e o diretório de saída é `dist`.
3. Configure as seguintes **Environment Variables** no painel da Vercel:
   - `VITE_SUPABASE_URL`: URL do seu projeto Supabase (ex: `https://seu-projeto.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Chave anônima pública (anon/public key)
   - `SUPABASE_URL`: Mesma URL do Supabase (para as Serverless Functions)
   - `SUPABASE_ANON_KEY`: Mesma chave pública
   - `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço secreta (opcional, para permissões administrativas no cron)
   - `GEMINI_API_KEY`: Chave da API do Google Gemini (obtida no Google AI Studio)
4. Clique em **Deploy**.

---

### 3️⃣ Versionamento no GitHub
1. Inicialize ou clone o repositório:
   ```bash
   git clone https://github.com/EdimilsonMurer/remotejob.git
   cd remotejob
   ```
2. Mantenha os arquivos de credenciais (`.env`, `.env.local`) fora do controle de versão (já configurados no `.gitignore`).
3. Ao realizar alterações:
   ```bash
   git add .
   git commit -m "feat: sincronização unificada com Supabase e funções serverless Vercel"
   git push origin main
   ```

---

### 4️⃣ Cron na Vercel (Agendamento Automático)
O arquivo `vercel.json` inclui o agendamento diário nativo da Vercel:
```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 0 * * *"
    }
  ]
}
```
- O endpoint serverless `/api/cron.ts` coleta novas vagas de plataformas oficiais (Welocalize, Turing, Outlier), executa o pré-filtro e deduplicação, analisa oportunidades com o Gemini e persiste diretamente nas tabelas `jobs`, `job_analysis` e `source_logs` do Supabase.
- No plano gratuito da Vercel (Hobby), crons podem rodar 1 vez ao dia. Se desejar intervalos menores (ex: a cada 6 ou 12 horas), copie a URL do webhook (`https://seu-app.vercel.app/api/cron`) e cadastre gratuitamente no [cron-job.org](https://cron-job.org).

---

## 🛠️ Stack Tecnológica

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Inteligência Artificial:** Google Gemini AI SDK (`@google/genai`) com saída estrita em JSON Schema e fallback heurístico
- **Coletores Oficiais:** Conectores REST API / Scraping ético para Welocalize, Turing e Outlier
- **Banco de Dados:** PostgreSQL (Supabase) + Cache local JSON resiliente
- **CI/CD & Automação:** GitHub Actions (coleta agendada a cada 6h) + Vercel Deployment

---

## 📦 Como Rodar Localmente

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/EdimilsonMurer/remotejob.git
   cd remotejob
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   Copie `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
   Adicione sua chave da API do Gemini (obtida gratuitamente em [aistudio.google.com](https://aistudio.google.com/apikey)).

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse `http://localhost:3000` no seu navegador.

5. **Executar Coleta de Vagas Manualmente:**
   ```bash
   # Executa um ciclo completo de coleta, deduplicação e classificação
   npm run collect

   # Inicia o worker com agendamento contínuo a cada 6 horas
   npm run worker
   ```

---

## 🚢 Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com/) e importe o repositório `EdimilsonMurer/remotejob`.
2. O arquivo `vercel.json` configurado cuidará automaticamente do roteamento SPA.
3. Adicione a variável `GEMINI_API_KEY` no painel de Environment Variables da Vercel.
4. Clique em **Deploy**.

---

## ⏰ Coleta Automática no GitHub Actions

O repositório inclui o workflow `.github/workflows/pipeline-cron.yml` que executa a coleta e atualiza o banco/snapshot a cada 6 horas:
1. No seu repositório no GitHub, acesse **Settings ➔ Secrets and variables ➔ Actions**.
2. Clique em **New repository secret** e adicione:
   - `GEMINI_API_KEY`: Sua chave da API do Gemini.
   - `SUPABASE_URL` (opcional caso use Supabase).
   - `SUPABASE_SERVICE_ROLE_KEY` (opcional caso use Supabase).

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para obter mais informações.
