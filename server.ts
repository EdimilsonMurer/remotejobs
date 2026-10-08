import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { matchKnownPlatform, inferPlatformDefaults, extractCleanDomain } from './src/services/platformKnowledge';
import { WelocalizeConnector } from './src/connectors/welocalize';
import { TuringConnector } from './src/connectors/turing';
import { ConnectorRegistry } from './src/connectors/registry';
import seedAllHandler from './api/supabase/seed-all.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicialização segura do cliente Gemini SDK no backend
const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function fetchPageSnippet(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 RemoteHunterBot/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) return '';
    const html = await res.text();

    // Extrai título, meta description e primeiros textos
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const description = metaDescMatch ? metaDescMatch[1].trim() : '';

    const ogSiteName = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
    const siteName = ogSiteName ? ogSiteName[1].trim() : '';

    return `Page Title: ${title}\nSite Name: ${siteName}\nDescription: ${description}`;
  } catch {
    return '';
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Rota de configuração pública do ambiente (Supabase & Vercel)
  app.get('/api/config', (req, res) => {
    const supabaseUrl = (
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      ''
    ).trim();

    const supabaseAnonKey = (
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ''
    ).trim();

    const isConfigured = Boolean(
      supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl.startsWith('https://') &&
      !supabaseUrl.includes('sua-instancia') &&
      !supabaseUrl.includes('seu-projeto')
    );

    return res.json({
      supabaseUrl: isConfigured ? supabaseUrl : '',
      supabaseAnonKey: isConfigured ? supabaseAnonKey : '',
      isConfigured,
      source: isConfigured ? 'server_environment' : 'none',
      hasGemini: Boolean(geminiApiKey)
    });
  });

  // Rota de autofill com Gemini
  app.post('/api/platforms/autofill', async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }

    const cleanUrl = url.trim();
    const domain = extractCleanDomain(cleanUrl);

    // 1. Verifica se temos na base de dados de alto desempenho primeiro
    const localKnown = matchKnownPlatform(cleanUrl);

    // Se temos chave Gemini, tenta enriquecer ou analisar com IA
    if (geminiApiKey) {
      try {
        const pageSnippet = await fetchPageSnippet(cleanUrl);

        const prompt = `Você é um analista especialista em plataformas globais de trabalho remoto, inteligência artificial, microtarefas, tradução e avaliação de busca (como Welocalize, OneForma, Telus, Appen, Outlier, Alignerr, Mindrift, DataForce, TesterWork, Invisible Tech, Micro1, Turing).

O usuário forneceu a URL de uma plataforma: "${cleanUrl}" (Domínio: ${domain}).
Snippet raspado da página:
${pageSnippet || 'Nenhum snippet disponível'}

${localKnown ? `Dados conhecidos de referência:\nNome: ${localKnown.name}\nCategoria: ${localKnown.category}\nMoeda: ${localKnown.currency}\nInglês: ${localKnown.englishRequirement}\nProcesso: ${localKnown.processType}\nRemuneração: ${localKnown.averagePayRate}\nDicas: ${localKnown.notes}` : ''}

ANALISE A PLATFORMA E RETORNE EXATAMENTE O OBJETO JSON com as seguintes regras:
1. "name": Nome limpo e oficial da empresa/plataforma.
2. "websiteUrl": URL do site oficial limpa (iniciando com https://).
3. "careersUrl": URL direta do portal de carreiras, vagas ou cadastro de trabalhadores remotos/avaliadores (se souber a URL exata como /careers ou portal, use-a; senão use a URL principal).
4. "category": Resumo da categoria em pt-BR (ex: "Treinamento de IA & Avaliação de LLMs", "Anotação de Dados & Transcrição", "Testes de Software & QA", "Microtarefas & Avaliação de Busca", etc.).
5. "currency": Moeda principal de pagamento: "USD" (Dólar), "EUR" (Euro), "GBP" (Libra) ou "BRL" (Real). A grande maioria internacional paga em "USD".
6. "englishRequirement": Exigência real de conversação em inglês para brasileiros:
   - "NONE": 100% em português
   - "READING_ONLY": Precisa apenas ler instruções/guidelines em inglês (pode usar tradutor); tarefas são em português ou sem fala
   - "BASIC": Inglês básico
   - "INTERMEDIATE": Inglês intermediário
   - "FLUENT_INTERVIEW": Exige entrevista técnica oral ou bate-papo em inglês com recrutadores
7. "processType":
   - "NO_INTERVIEW": Cadastro direto e início rápido sem entrevistas
   - "ONLINE_EXAM": Teste prático online assíncrono (Guidelines / provas de múltipla escolha)
   - "AI_TEST": Gravação de áudio ou vídeo assíncrono
   - "LIVE_INTERVIEW": Entrevista ao vivo com humano
8. "status":
   - Se exigir entrevista oral em inglês ou tiver histórico abusivo (ex: Micro1, Turing, Crossover), coloque "BLACKLIST" e preencha "blacklistReason".
   - Se for trabalho em moeda forte sem entrevista oral, coloque "FAVORITE".
   - Senão "ACTIVE".
9. "blacklistReason": motivo curto e claro se status for BLACKLIST (ou null se não for).
10. "paymentMethods": array de métodos de pagamento comuns (ex: ["Payoneer", "PayPal", "Deel", "Transferência Bancária"]).
11. "averagePayRate": faixa estimada de remuneração (ex: "$15.00 - $35.00 / hora", "$5.00 - $15.00 / hora", "$10 - $40 por teste").
12. "notes": Resumo estratégico em português brasileiro com dicas práticas de contratação, como funciona o teste, projetos em PT-BR e orientações para o candidato ser aceito.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                websiteUrl: { type: Type.STRING },
                careersUrl: { type: Type.STRING },
                category: { type: Type.STRING },
                currency: {
                  type: Type.STRING,
                  enum: ['USD', 'EUR', 'GBP', 'BRL']
                },
                englishRequirement: {
                  type: Type.STRING,
                  enum: ['NONE', 'READING_ONLY', 'BASIC', 'INTERMEDIATE', 'FLUENT_INTERVIEW']
                },
                processType: {
                  type: Type.STRING,
                  enum: ['NO_INTERVIEW', 'ONLINE_EXAM', 'AI_TEST', 'LIVE_INTERVIEW']
                },
                status: {
                  type: Type.STRING,
                  enum: ['FAVORITE', 'ACTIVE', 'PAUSED', 'BLACKLIST']
                },
                blacklistReason: { type: Type.STRING, nullable: true },
                paymentMethods: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                averagePayRate: { type: Type.STRING },
                notes: { type: Type.STRING }
              },
              required: [
                'name',
                'websiteUrl',
                'careersUrl',
                'category',
                'currency',
                'englishRequirement',
                'processType',
                'status',
                'paymentMethods',
                'averagePayRate',
                'notes'
              ]
            }
          }
        });

        const text = response.text?.trim() || '{}';
        const parsed = JSON.parse(text);

        return res.json({
          name: parsed.name || localKnown?.name || domain,
          websiteUrl: parsed.websiteUrl || localKnown?.websiteUrl || cleanUrl,
          careersUrl: parsed.careersUrl || localKnown?.careersUrl || cleanUrl,
          category: parsed.category || localKnown?.category || 'Treinamento de IA & Trabalho Remoto',
          currency: parsed.currency || localKnown?.currency || 'USD',
          englishRequirement: parsed.englishRequirement || localKnown?.englishRequirement || 'READING_ONLY',
          processType: parsed.processType || localKnown?.processType || 'ONLINE_EXAM',
          status: parsed.status || localKnown?.status || 'FAVORITE',
          blacklistReason: parsed.blacklistReason || localKnown?.blacklistReason,
          paymentMethods: parsed.paymentMethods || localKnown?.paymentMethods || ['Payoneer', 'PayPal'],
          averagePayRate: parsed.averagePayRate || localKnown?.averagePayRate || '$5.00 - $18.00 / hora',
          notes: parsed.notes || localKnown?.notes || 'Plataforma cadastrada para trabalho remoto.',
          source: 'gemini'
        });
      } catch (geminiError: any) {
        console.warn('[Gemini API] Aviso ao gerar conteúdo com IA, utilizando base determinística:', geminiError?.message);
      }
    }

    // Se Gemini falhou ou não tem chave configurada, usa a base de dados
    if (localKnown) {
      return res.json({
        ...localKnown,
        websiteUrl: localKnown.websiteUrl || cleanUrl,
        careersUrl: localKnown.careersUrl || cleanUrl,
        source: 'knowledge_base'
      });
    }

    // Fallback de inferência para qualquer outra URL
    const inferred = inferPlatformDefaults(cleanUrl);
    return res.json({
      ...inferred,
      source: 'heuristic'
    });
  });

  // Rota de sincronização do banco de dados de vagas
  app.post('/api/jobs/sync', async (req, res) => {
    try {
      const registry = ConnectorRegistry.getInstance();
      const connectors = registry.getAllConnectors(req.body?.platforms);
      
      let allJobs: any[] = [];
      const sourceSummary: any[] = [];

      for (const connector of connectors) {
        const startTime = Date.now();
        try {
          const jobs = await connector.collect();
          allJobs = [...allJobs, ...jobs];
          sourceSummary.push({
            platform: connector.name,
            slug: connector.slug,
            jobs_found: jobs.length,
            duration_ms: Date.now() - startTime,
            status: 'SUCCESS'
          });
        } catch (err: any) {
          sourceSummary.push({
            platform: connector.name,
            slug: connector.slug,
            jobs_found: 0,
            error: err.message,
            status: 'FAILED'
          });
        }
      }

      return res.json({
        success: true,
        jobs: allJobs,
        total: allJobs.length,
        platforms_scanned: sourceSummary.length,
        sources: sourceSummary,
        timestamp: new Date().toISOString()
      });
    } catch (e: any) {
      console.warn('[Sync API] Erro ao sincronizar vagas via conector:', e?.message);
      return res.json({
        success: false,
        error: e.message || 'Erro ao sincronizar',
        jobs: [],
        timestamp: new Date().toISOString()
      });
    }
  });

  // Rota de semeadura e sincronização em massa no Supabase
  app.all('/api/supabase/seed-all', async (req, res) => {
    return seedAllHandler(req, res);
  });

  // Rota de tradução com Gemini para Português
  app.post('/api/jobs/translate', async (req, res) => {
    const { text, title } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto é obrigatório' });
    }

    if (geminiApiKey) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Você é um tradutor profissional especializado em vagas de emprego internacionais na área de tecnologia, inteligência artificial e trabalho remoto.
Traduza o seguinte texto de descrição de vaga fielmente para o Português do Brasil (pt-BR).
Mantenha a formatação original em tópicos, parágrafos e clareza.
Termos técnicos consagrados como "Search Quality Rater", "Ads Rater", "Guidelines", "Feedback", "RLHF", "Freelance" podem ser mantidos ou acompanhados de explicação entre parênteses.
Não adicione saudações ou comentários, retorne apenas o texto traduzido.

TEXTO ORIGINAL:
${text.slice(0, 4500)}`
        });

        const translated = response.text?.trim() || '';
        if (translated) {
          return res.json({ translatedText: translated, source: 'gemini' });
        }
      } catch (err: any) {
        console.warn('[Translate API] Erro no Gemini:', err?.message);
      }
    }

    return res.json({ translatedText: text, source: 'fallback' });
  });

  // Configuração do ambiente Vite / Estático
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RemoteHunter Pro] Servidor Full-Stack rodando na porta ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[RemoteHunter Pro] Erro crítico ao iniciar servidor:', err);
});
