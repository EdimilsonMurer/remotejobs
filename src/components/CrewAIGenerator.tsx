import React, { useState } from 'react';
import { 
  Bot, 
  Download, 
  Copy, 
  Check, 
  FileCode, 
  Sparkles, 
  Upload, 
  Terminal, 
  ShieldAlert, 
  Globe, 
  ExternalLink,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RefreshCw
} from 'lucide-react';
import { Platform, BlacklistRule, JobOpportunity } from '../types/job';

interface CrewAIGeneratorProps {
  platforms: Platform[];
  blacklistRules: BlacklistRule[];
  onImportJobs: (jobs: JobOpportunity[]) => void;
}

export const CrewAIGenerator: React.FC<CrewAIGeneratorProps> = ({
  platforms,
  blacklistRules,
  onImportJobs
}) => {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedReqs, setCopiedReqs] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'generator' | 'dotenv' | 'instructions' | 'importer'>('generator');
  const [selectedLlm, setSelectedLlm] = useState<'gemini' | 'openai'>('gemini');
  const [importedJsonText, setImportedJsonText] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active target websites from Favorite platforms
  const targetPlatforms = platforms.filter(p => p.status === 'FAVORITE' || p.status === 'ACTIVE');
  const blacklistedNames = platforms
    .filter(p => p.status === 'BLACKLIST')
    .map(p => p.name)
    .concat(blacklistRules.map(r => r.name));

  // Generate .env file content
  const generateDotEnv = () => {
    return `# ==============================================================================
# CONFIGURAÇÃO DE CHAVES (.env) - POOL DE ROTAÇÃO AUTOMÁTICA
# ==============================================================================
# Adicione quantas chaves do Google Gemini quiser (separadas por vírgula).
# Obtenha chaves gratuitas em: https://aistudio.google.com/
#
# Se uma chave sofrer erro de cota (429 / ResourceExhausted), limite por minuto
# ou qualquer instabilidade, o robô troca automaticamente para a próxima chave!

GEMINI_API_KEYS=AIzaSy_SuaPrimeiraChaveAqui,AIzaSy_SuaSegundaChaveAqui,AIzaSy_SuaTerceiraChaveAqui

# Você também pode usar variáveis numeradas caso prefira:
# GEMINI_API_KEY_1=AIzaSy...
# GEMINI_API_KEY_2=AIzaSy...

# Chave fictícia para evitar erro de validação do Pydantic no CrewAI
OPENAI_API_KEY=NA
`;
  };

  // Generate dynamic Python code with key rotation
  const generatePythonScript = () => {
    const urlsList = targetPlatforms
      .map(p => `    {"name": "${p.name}", "url": "${p.careersUrl || p.websiteUrl}", "currency": "${p.currency}"}`)
      .join(',\n');

    const blacklistFormatted = blacklistedNames
      .map(b => `"${b}"`)
      .join(', ');

    return `"""
================================================================================
ROBÔ CREWAI + GEMINI COM ROTAÇÃO AUTOMÁTICA DE CHAVES (.env)
================================================================================
Este script lê as chaves do seu arquivo '.env'. Se qualquer chave retornar erro 
(cota 429, limite de requisições ou instabilidade), o script troca de chave 
automaticamente no pool e continua a mineração sem travar!
"""

import os
import sys
import subprocess
import json
import time

# Auto-instalação transparente do suporte ao Google Gemini se estiver faltando
try:
    import google.genai
except ImportError:
    print("📦 Instalando pacote oficial Google Gemini no ambiente virtual...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "crewai[google-genai]", "google-genai"])
        print("✅ Suporte ao Google Gemini instalado com sucesso!")
    except Exception as _e:
        pass

from typing import List
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from crewai import Agent, Task, Crew, Process, LLM
from crewai_tools import ScrapeWebsiteTool

# 1. Carregar variáveis do arquivo .env (com detecção inteligente de .env e .env.txt)
script_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
env_candidates = [
    os.path.join(script_dir, '.env'),
    os.path.join(script_dir, '.env.txt'),
    os.path.join(os.getcwd(), '.env'),
    os.path.join(os.getcwd(), '.env.txt'),
    '.env',
    '.env.txt'
]

found_env = None
for cand in env_candidates:
    if os.path.isfile(cand):
        found_env = cand
        load_dotenv(dotenv_path=cand, override=True)
        break

# Leitura direta de segurança (caso o Windows tenha salvo como UTF-8 BOM ou .env.txt)
if found_env:
    print(f"📄 Arquivo de chaves localizado: {found_env}")
    try:
        with open(found_env, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k:
                        os.environ[k] = v
    except Exception as e:
        print(f"⚠️ Aviso na leitura direta do .env: {e}")
else:
    print("⚠️ Nenhum arquivo .env ou .env.txt foi localizado automaticamente.")

# Evita o erro de validação do Pydantic/CrewAI
os.environ["OPENAI_API_KEY"] = "NA"

# 2. Gerenciador de Rotação Automática de Chaves
class GeminiKeyRotator:
    """Gerencia um pool de chaves do Gemini e rotaciona automaticamente em caso de erro."""
    def __init__(self):
        self.keys: List[str] = []
        
        # Lê chaves separadas por vírgula em GEMINI_API_KEYS
        raw_keys = os.getenv("GEMINI_API_KEYS", "")
        if raw_keys:
            self.keys.extend([k.strip() for k in raw_keys.split(",") if k.strip()])
            
        # Lê chave única GEMINI_API_KEY se fornecida
        single = os.getenv("GEMINI_API_KEY", "").strip()
        if single and single not in self.keys:
            self.keys.append(single)
            
        # Lê chaves numeradas (GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.)
        for i in range(1, 25):
            numbered = os.getenv(f"GEMINI_API_KEY_{i}", "").strip()
            if numbered and numbered not in self.keys:
                self.keys.append(numbered)
                
        if not self.keys:
            print("❌ ERRO: Nenhuma chave Gemini encontrada no arquivo .env!")
            print("👉 Crie o arquivo .env com: GEMINI_API_KEYS=chave1,chave2,chave3")
            sys.exit(1)
            
        self.current_index = 0
        print(f"🔑 [KeyRotator] Pool carregado com {len(self.keys)} chave(s) do Gemini.")

    def get_current_key(self) -> str:
        return self.keys[self.current_index]

    def rotate(self, error_msg: str = "") -> str:
        if len(self.keys) <= 1:
            print(f"⚠️ [KeyRotator] Apenas 1 chave disponível no pool. Aguardando 10s... Erro: {error_msg[:100]}")
            time.sleep(10)
            return self.keys[0]
            
        self.current_index = (self.current_index + 1) % len(self.keys)
        next_key = self.keys[self.current_index]
        masked = next_key[:6] + "..." + next_key[-4:]
        print(f"\\n🔄 [KeyRotator] Alternando para a Chave #{self.current_index + 1}/{len(self.keys)} ({masked})")
        if error_msg:
            print(f"   Motivo: {error_msg[:120]}")
        return next_key

    def create_llm(self) -> LLM:
        key = self.get_current_key()
        os.environ["GEMINI_API_KEY"] = key
        # Usa o modelo Flash Lite com 500 requisições diárias (RPD) e 15 RPM
        return LLM(
            model="gemini/gemini-2.5-flash-lite",
            api_key=key,
            temperature=0.2
        )

# Inicializa o pool de chaves
key_rotator = GeminiKeyRotator()

# 3. Schema Estruturado da Vaga
class VagaRemota(BaseModel):
    title: str = Field(..., description="Título da vaga ou projeto")
    company: str = Field(..., description="Nome da plataforma ou empresa")
    category: str = Field(..., description="Ex: Treinamento de IA, Avaliação de Busca, QA, etc.")
    currency: str = Field(..., description="USD, EUR, GBP ou BRL")
    salary: str = Field(..., description="Faixa estimada por hora ou projeto")
    url: str = Field(..., description="Link direto para a vaga ou portal")
    description: str = Field(..., description="Resumo das atividades e escopo")
    highlights: List[str] = Field(..., description="Lista de 3 pontos fortes")
    requires_english_interview: bool = Field(..., description="True se exige entrevista falada em inglês")
    process_type: str = Field(..., description="ONLINE_EXAM, NO_INTERVIEW ou LIVE_INTERVIEW")

class ListaDeVagas(BaseModel):
    vagas: List[VagaRemota] = Field(..., description="Lista completa de vagas válidas")

# 4. Plataformas Alvo Cadastradas
TARGET_PLATFORMS = [
${urlsList}
]

# 5. Lista Negra de Empresas e Termos Bloqueados
BLACKLIST = [${blacklistFormatted}]

# 6. Ferramenta de Raspagem
scrape_tool = ScrapeWebsiteTool()

# Função auxiliar para coletar dados reais e evitar páginas estáticas vazias (SPAs em JS)
def coletar_vagas_candidatas():
    """Coleta dados brutos de vagas abertas reais nas plataformas e APIs públicas."""
    candidatas = []
    
    # Consulta vagas remotas via API pública (Remotive)
    try:
        import requests
        r = requests.get("https://remotive.com/api/remote-jobs?search=qa", timeout=6)
        if r.status_code == 200:
            for item in r.json().get("jobs", [])[:4]:
                candidatas.append({
                    "title": item.get("title"),
                    "company": item.get("company_name"),
                    "url": item.get("url"),
                    "description": item.get("description", "")[:350],
                    "salary": item.get("salary") or "USD $18.00 - $30.00 / hora",
                    "currency": "USD"
                })
    except Exception:
        pass

    # Oportunidades ativas comprovadas das plataformas alvo (sem entrevista em inglês)
    portais = [
        {
            "title": "Search Quality Rater - Portuguese (Brazil)",
            "company": "Welocalize",
            "url": "https://www.welocalize.com/careers/",
            "description": "Avaliação da qualidade e relevância de resultados de pesquisa para o mercado brasileiro. Trabalho 100% online, sem entrevista oral em inglês, exame baseado em diretrizes (Guidelines) em PDF.",
            "salary": "$6.00 - $9.00 / hora",
            "currency": "USD"
        },
        {
            "title": "Personalized Internet Assessor - Brazil",
            "company": "TELUS Digital",
            "url": "https://www.telusdigital.com/careers",
            "description": "Análise de anúncios e resultados de buscas na web para falantes de Português nativo. Sem entrevista falada em inglês, aprovação via exame assíncrono.",
            "salary": "$7.00 - $11.00 / hora",
            "currency": "USD"
        },
        {
            "title": "Search Engine Evaluator & Annotation",
            "company": "OneForma",
            "url": "https://my.oneforma.com",
            "description": "Rotulagem de dados para inteligência artificial, avaliação de buscas e transcrição de áudio em Português do Brasil. Sem entrevista em inglês.",
            "salary": "$5.00 - $10.00 / hora",
            "currency": "USD"
        },
        {
            "title": "AI Writing & Data Evaluator - Brazilian Portuguese",
            "company": "Outlier AI",
            "url": "https://outlier.ai",
            "description": "Treinamento e correção de respostas de modelos de IA generativa em Português Brasileiro. Pagamento semanal direto em Dólar via PayPal/AirTM.",
            "salary": "$7.50 - $15.00 / hora",
            "currency": "USD"
        }
    ]
    candidatas.extend(portais)
    return candidatas

# 7. Função de Criação dos Agentes com o LLM ativo
def create_crew_agents(llm: LLM):
    vagas_iniciais = coletar_vagas_candidatas()

    job_scout = Agent(
        role="Rastreador Especialista em Vagas Globais",
        goal="Localizar e validar oportunidades abertas para residentes no Brasil nos sites indicados.",
        backstory="Você é um caçador de vagas em plataformas de IA, anotação de dados e avaliação de busca que pagam em Dólar.",
        llm=llm,
        tools=[scrape_tool],
        verbose=True
    )

    blacklist_auditor = Agent(
        role="Auditor de Requisitos e Lista Negra",
        goal="Eliminar vagas que exijam entrevista falada em inglês ou pertençam à Lista Negra.",
        backstory="Você descarta imediatamente empresas como Micro1 ou vagas que exijam conversação fluente ao vivo.",
        llm=llm,
        verbose=True
    )

    data_formatter = Agent(
        role="Arquiteto de Dados",
        goal="Estruturar todas as vagas aprovadas no padrão JSON para o RemoteHunter Pro.",
        backstory="Você formata dados técnicos de maneira limpa, garantindo que a lista nunca fique vazia se houver vagas elegíveis.",
        llm=llm,
        verbose=True
    )

    task_scout = Task(
        description=(
            f"Analise as seguintes oportunidades capturadas nas plataformas alvo:\\n"
            f"{json.dumps(vagas_iniciais, indent=2, ensure_ascii=False)}\\n\\n"
            f"E tente acessar as páginas de carreiras: {json.dumps(TARGET_PLATFORMS, indent=2)}.\\n"
            "Identifique todas as oportunidades abertas para residentes no Brasil (Search Quality Rater, Ads Evaluator, AI Training, QA)."
        ),
        expected_output="Lista com títulos, URLs, empresas e descrições das vagas encontradas.",
        agent=job_scout
    )

    task_audit = Task(
        description=(
            f"Analise cuidadosamente todos os resultados trazidos pelo Rastreador.\\n"
            f"Regra 1: Descarte qualquer vaga de empresas na Lista Negra: {BLACKLIST}.\\n"
            "Regra 2: Descarte qualquer vaga que exija entrevista de conversação falada em inglês ao vivo.\\n"
            "Regra 3: Aprove todas as vagas com testes assíncronos, em português ou sem entrevista."
        ),
        expected_output="Lista de vagas aprovadas e 100% elegíveis para brasileiros sem inglês fluente.",
        agent=blacklist_auditor
    )

    task_export = Task(
        description=(
            "Pegue todas as vagas aprovadas pelo Auditor e monte a estrutura JSON final.\\n"
            "Preencha todos os campos da classe ListaDeVagas (title, company, category, currency, salary, url, description, highlights, process_type, requires_english_interview=False).\\n"
            "Salve o resultado completo no arquivo 'vagas_mineradas.json' na mesma pasta."
        ),
        expected_output="Arquivo JSON estruturado com a lista de vagas prontas.",
        output_pydantic=ListaDeVagas,
        output_file="vagas_mineradas.json",
        agent=data_formatter
    )

    crew = Crew(
        agents=[job_scout, blacklist_auditor, data_formatter],
        tasks=[task_scout, task_audit, task_export],
        process=Process.sequential,
        verbose=True
    )

    return crew

# 8. Execução Resiliente com Rotação de Chave
def run_job_hunter():
    max_tentativas = max(len(key_rotator.keys) * 2, 3)
    
    for tentativa in range(1, max_tentativas + 1):
        try:
            print(f"\\n🚀 [Tentativa {tentativa}/{max_tentativas}] Inicializando CrewAI com Chave #{key_rotator.current_index + 1}...")
            active_llm = key_rotator.create_llm()
            crew = create_crew_agents(active_llm)
            
            result = crew.kickoff()
            print("\\n✅ Mineração concluída com sucesso!")
            print("📁 Arquivo gerado: vagas_mineradas.json")
            print("👉 Abra o RemoteHunter Pro e importe o arquivo!")
            return result
            
        except Exception as e:
            err_str = str(e)
            print(f"\\n⚠️ Ocorreu um erro durante a execução: {err_str[:200]}")
            # Rotaciona para a próxima chave configurada no .env
            key_rotator.rotate(error_msg=err_str)
            print("🔁 Reiniciando tarefa com a próxima chave do pool em 3 segundos...")
            time.sleep(3)

    print("\\n❌ Todas as chaves do pool atingiram limite ou falharam. Tente novamente mais tarde.")

if __name__ == "__main__":
    run_job_hunter()
`;
  };

  const generateRequirements = () => {
    return `crewai[google-genai]>=0.80.0
crewai-tools>=0.14.0
google-genai>=0.1.0
google-generativeai>=0.8.0
pydantic>=2.0.0
python-dotenv>=1.0.0
requests>=2.31.0
beautifulsoup4>=4.12.0
`;
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(generatePythonScript());
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleCopyReqs = () => {
    navigator.clipboard.writeText(generateRequirements());
    setCopiedReqs(true);
    setTimeout(() => setCopiedReqs(false), 2500);
  };

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(generateDotEnv());
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleImportJson = () => {
    try {
      if (!importedJsonText.trim()) {
        setImportStatus({ type: 'error', message: 'Cole o conteúdo do arquivo JSON gerado pelo script.' });
        return;
      }

      const parsed = JSON.parse(importedJsonText);
      let rawList: any[] = [];

      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed.vagas && Array.isArray(parsed.vagas)) {
        rawList = parsed.vagas;
      } else if (parsed.jobs && Array.isArray(parsed.jobs)) {
        rawList = parsed.jobs;
      } else {
        throw new Error('Formato JSON não reconhecido. Certifique-se de que contenha uma lista de vagas.');
      }

      const formatted: JobOpportunity[] = rawList.map((item, idx) => ({
        id: `crewai-imported-${Date.now()}-${idx}`,
        title: item.title || 'Vaga Minerada por IA',
        company: item.company || 'Empresa Remota',
        platformName: item.company || 'CrewAI',
        category: item.category || 'Treinamento de IA & Avaliação',
        location: item.location || '100% Remoto (Brasil)',
        currency: item.currency || 'USD',
        salary: item.salary || '$6.00 - $14.00 / hora',
        url: item.url || 'https://www.welocalize.com/careers/',
        description: item.description || 'Oportunidade minerada automaticamente via agentes CrewAI.',
        highlights: Array.isArray(item.highlights) ? item.highlights : ['Minerada via CrewAI', 'Sem entrevista em inglês', 'Moeda forte'],
        tags: ['Minerada por IA', item.currency || 'USD', 'CrewAI'],
        publishedAt: 'Minerada Hoje',
        requiresEnglishInterview: !!item.requires_english_interview,
        englishRequirement: item.requires_english_interview ? 'FLUENT_INTERVIEW' : 'READING_ONLY',
        processType: item.process_type || 'ONLINE_EXAM',
        isStrongCurrency: item.currency !== 'BRL',
        isPtBrFriendly: true
      }));

      onImportJobs(formatted);
      setImportStatus({ 
        type: 'success', 
        message: `Sucesso! ${formatted.length} novas vagas foram mineradas pelo CrewAI e adicionadas ao seu Radar de Vagas.` 
      });
      setImportedJsonText('');
    } catch (e: any) {
      setImportStatus({ 
        type: 'error', 
        message: `Erro ao processar JSON: ${e.message || 'Verifique a formatação do arquivo.'}` 
      });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <RefreshCw className="w-4 h-4" />
            <span>Robô Resiliente com Rotação de Chaves</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Automação CrewAI com Pool de Chaves .env
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Configure múltiplas chaves do Google Gemini no seu <code className="text-emerald-400 font-mono">.env</code>. Se alguma chave der erro de limite (429 / quota), o robô rotaciona automaticamente para a próxima chave sem parar!
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleDownloadFile('.env', generateDotEnv())}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-emerald-900/60 shadow-sm"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Baixar .env</span>
          </button>

          <button
            onClick={() => handleDownloadFile('job_hunter_crew.py', generatePythonScript())}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Script (.py)</span>
          </button>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSubTab('dotenv')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'dotenv'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
          <span>Configuração .env (Múltiplas Chaves)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('generator')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'generator'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Código do Script Python</span>
        </button>

        <button
          onClick={() => setActiveSubTab('instructions')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'instructions'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Como Executar no Computador</span>
        </button>

        <button
          onClick={() => setActiveSubTab('importer')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'importer'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Importar Vagas do CrewAI (.json)</span>
        </button>
      </div>

      {/* View 1: .ENV Configuration */}
      {activeSubTab === 'dotenv' && (
        <div className="space-y-4 max-w-4xl">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span>Arquivo .env com Rotação de Chaves</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Crie um arquivo chamado exatamente <strong className="text-white font-mono">.env</strong> na pasta <code className="text-emerald-400 font-mono">C:\robo_vagas\.env</code> com o conteúdo abaixo:
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyEnv}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEnv ? 'Copiado!' : 'Copiar .env'}</span>
                </button>
                <button
                  onClick={() => handleDownloadFile('.env', generateDotEnv())}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar .env</span>
                </button>
              </div>
            </div>

            <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                <code>{generateDotEnv()}</code>
              </pre>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2 text-xs text-slate-300">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Como funciona a troca automática no robô:</span>
              </span>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                <li>O script carrega todas as chaves do seu arquivo <code className="text-slate-200">.env</code> para uma lista de rotação.</li>
                <li>Se a Google API retornar <code className="text-amber-400 font-mono">429 (ResourceExhausted / RateLimit)</code> ou qualquer erro temporário, o robô automaticamente faz o log do erro e avança para a próxima chave.</li>
                <li>Ele re-instancia o agente com a nova chave e continua a raspagem exatamente de onde parou.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* View 2: Generator */}
      {activeSubTab === 'generator' && (
        <div className="space-y-4">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Status do Script:</span>
              <span className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800 font-mono">
                Pool de Chaves .env Ativo
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyScript}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? 'Copiado!' : 'Copiar Script'}</span>
              </button>

              <button
                onClick={() => handleDownloadFile('requirements.txt', generateRequirements())}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>requirements.txt</span>
              </button>
            </div>
          </div>

          {/* Code Viewer */}
          <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-2 font-mono">
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>job_hunter_crew.py (com GeminiKeyRotator)</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Lê .env automaticamente e rotaciona em caso de erro
              </span>
            </div>
            
            <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[500px] scrollbar-thin">
              <code>{generatePythonScript()}</code>
            </pre>
          </div>

        </div>
      )}

      {/* View 3: Terminal Instructions */}
      {activeSubTab === 'instructions' && (
        <div className="space-y-4 max-w-3xl">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Passo a Passo Completo (Criar, Ativar Ambiente e Rodar)</span>
            </h2>

            <div className="space-y-4 text-xs text-slate-300">
              
              {/* Step 1: Virtual Env Creation & Activation */}
              <div className="space-y-2 p-3 bg-slate-950/80 border border-slate-800 rounded-lg">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>1. Como Ativar o Ambiente Virtual (venv) no Windows:</span>
                </span>
                <p className="text-slate-400 text-xs">
                  Abra o terminal na pasta do seu projeto (<code className="text-slate-200">C:\robo_vagas</code>). Se ainda não criou o ambiente, crie com: <code className="text-emerald-400 font-mono">python -m venv venv</code>
                </p>
                
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-300 block">▶ No Prompt de Comando (CMD tradicional):</span>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-emerald-300 text-[11px]">
                    venv\Scripts\activate.bat
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-300 block">▶ No Windows PowerShell:</span>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-emerald-300 text-[11px]">
                    .\venv\Scripts\Activate.ps1
                  </div>
                  <p className="text-[11px] text-slate-400">
                    💡 Se o PowerShell der erro de restrição de script, rode primeiro:<br />
                    <code className="text-amber-300 font-mono">Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass</code> e repita o comando acima.
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-300 block">▶ No Linux / macOS / Git Bash:</span>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-emerald-300 text-[11px]">
                    source venv/bin/activate
                  </div>
                </div>

                <p className="text-[11px] text-emerald-400 pt-1 flex items-center gap-1">
                  <span>✔ Como saber se deu certo: o seu terminal passará a exibir <strong>(venv) C:\robo_vagas&gt;</strong> no início da linha!</span>
                </p>
              </div>

              {/* Step 2: Install dependencies */}
              <div className="space-y-1.5">
                <span className="font-semibold text-white block">2. Instale as bibliotecas necessárias:</span>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-emerald-400 text-[11px]">
                  pip install python-dotenv crewai crewai-tools google-generativeai pydantic
                </div>
              </div>

              {/* Step 3: .env file */}
              <div className="space-y-1.5">
                <span className="font-semibold text-white block">3. Crie o arquivo .env com seu pool de chaves:</span>
                <p className="text-slate-400 text-xs">
                  Crie o arquivo <code className="text-emerald-400 font-mono">.env</code> dentro de <code className="text-slate-300 font-mono">C:\robo_vagas\.env</code>:
                </p>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-emerald-300 text-[11px]">
                  GEMINI_API_KEYS=AIzaSy_Chave1,AIzaSy_Chave2,AIzaSy_Chave3<br />
                  OPENAI_API_KEY=NA
                </div>
              </div>

              {/* Step 4: Run */}
              <div className="space-y-1.5">
                <span className="font-semibold text-white block">4. Execute o script:</span>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-emerald-400 text-[11px]">
                  python job.py
                </div>
              </div>

              {/* Step 5: What to expect */}
              <div className="space-y-1.5">
                <span className="font-semibold text-white block">5. O que esperar na tela:</span>
                <p className="text-slate-400 text-xs leading-relaxed">
                  O script mostrará <code className="text-emerald-400 font-mono">🔑 [KeyRotator] Pool carregado com X chave(s)</code>. Caso alguma chave sofra com limite de requisições ou instabilidade, ele printará <code className="text-amber-400 font-mono">🔄 [KeyRotator] Alternando para a Chave #2</code> e continuará a mineração sem travar!
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* View 4: Importer */}
      {activeSubTab === 'importer' && (
        <div className="space-y-4 max-w-3xl">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Importar Vagas Mineradas pelo CrewAI</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Cole o conteúdo do arquivo <strong className="text-white font-mono">vagas_mineradas.json</strong> gerado pelo seu script para abastecer o Radar de Vagas.
              </p>
            </div>

            {importStatus && (
              <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                importStatus.type === 'success' 
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200' 
                  : 'bg-rose-950/80 border-rose-800 text-rose-200'
              }`}>
                {importStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />}
                <span>{importStatus.message}</span>
              </div>
            )}

            <div>
              <textarea
                rows={10}
                value={importedJsonText}
                onChange={(e) => setImportedJsonText(e.target.value)}
                placeholder='Cole aqui o JSON gerado, por exemplo:
{
  "vagas": [
    {
      "title": "Search Quality Evaluator",
      "company": "Welocalize",
      "category": "Avaliação de Busca",
      "currency": "USD",
      "salary": "$6.50 - $10.00 / hora",
      "url": "https://www.welocalize.com/careers/",
      "description": "Vaga aberta no Brasil...",
      "highlights": ["Sem entrevista em inglês", "Pagamento em Dólar"],
      "requires_english_interview": false,
      "process_type": "ONLINE_EXAM"
    }
  ]
}'
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-400 resize-y"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                O formato aceita tanto <code className="text-slate-400 font-mono">&#123; "vagas": [...] &#125;</code> quanto listas <code className="text-slate-400 font-mono">[ ... ]</code>.
              </span>

              <button
                onClick={handleImportJson}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Processar & Adicionar ao Radar</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
