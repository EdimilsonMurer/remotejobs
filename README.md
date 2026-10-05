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
