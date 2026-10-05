import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Clock, 
  RefreshCw, 
  Copy, 
  Check, 
  CheckCircle2, 
  ShieldCheck, 
  Database, 
  Sparkles, 
  Layers, 
  Calendar,
  KeyRound,
  ExternalLink,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase/client';

export const SettingsManager: React.FC = () => {
  // Intervalo de busca em horas (padrão: 6 horas)
  const [intervalHours, setIntervalHours] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('remotejobs_collector_interval_hours');
      return saved ? Number(saved) : 6;
    } catch {
      return 6;
    }
  });

  const [missedCyclesToClose, setMissedCyclesToClose] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('remotejobs_missed_cycles_close');
      return saved ? Number(saved) : 3;
    } catch {
      return 3;
    }
  });

  const [copiedWorkflow, setCopiedWorkflow] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const getCronExpression = (hours: number): string => {
    switch (hours) {
      case 1:
        return '0 * * * *';
      case 2:
        return '0 */2 * * *';
      case 3:
        return '0 */3 * * *';
      case 6:
        return '0 */6 * * *';
      case 12:
        return '0 */12 * * *';
      case 24:
        return '0 0 * * *';
      default:
        return `0 */${hours} * * *`;
    }
  };

  const handleIntervalChange = (hours: number) => {
    setIntervalHours(hours);
    try {
      localStorage.setItem('remotejobs_collector_interval_hours', String(hours));
    } catch (e) {
      console.error(e);
    }
    setSaveFeedback(`Frequência de busca atualizada para a cada ${hours} hora${hours > 1 ? 's' : ''}!`);
    setTimeout(() => setSaveFeedback(null), 4000);
  };

  const handleCyclesChange = (cycles: number) => {
    setMissedCyclesToClose(cycles);
    try {
      localStorage.setItem('remotejobs_missed_cycles_close', String(cycles));
    } catch (e) {
      console.error(e);
    }
    setSaveFeedback('Regra de expiração de vagas atualizada!');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const generateWorkflowYaml = (hours: number) => {
    const cronExp = getCronExpression(hours);
    return `name: RemoteJobs Pipeline Ingestion

on:
  schedule:
    # Executa a cada ${hours} hora(s) automaticamente
    - cron: '${cronExp}'
  workflow_dispatch:

jobs:
  run-pipeline:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout do Repositório
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Instalar Dependências
        run: npm ci

      - name: Executar Ciclo de Ingestão e Classificação
        env:
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
          SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: npm run collect

      - name: Atualizar Snapshot no Repositório
        run: |
          git config --global user.name 'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
          git add src/data/
          git diff --quiet && git diff --staged --quiet || (git commit -m "chore(data): atualização automática de vagas [skip ci]" && git push)
`;
  };

  const handleCopyWorkflow = () => {
    navigator.clipboard.writeText(generateWorkflowYaml(intervalHours));
    setCopiedWorkflow(true);
    setTimeout(() => setCopiedWorkflow(false), 3000);
  };

  const intervalOptions = [
    { hours: 1, label: 'A cada 1 hora', desc: 'Monitoramento ultra-rápido para vagas concorridas' },
    { hours: 2, label: 'A cada 2 horas', desc: 'Frequência alta com detecção rápida' },
    { hours: 3, label: 'A cada 3 horas', desc: 'Equilíbrio excelente entre agilidade e consumo de quota' },
    { hours: 6, label: 'A cada 6 horas (Recomendado)', desc: 'Padrão ideal para plataformas como Welocalize e Turing' },
    { hours: 12, label: 'A cada 12 horas', desc: '2 coletas por dia (manhã e noite)' },
    { hours: 24, label: 'A cada 24 horas', desc: '1 coleta diária completa' }
  ];

  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Configurações do Pipeline & Agendador
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Defina a frequência da busca automática de vagas e gerencie parâmetros de automação.
              </p>
            </div>
          </div>
        </div>
      </div>

      {saveFeedback && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveFeedback}</span>
        </div>
      )}

      {/* Seção 1: Frequência da Busca Automática */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Frequência de Busca e Agendamento Automático
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Escolha a cada quantas horas os coletores oficiais devem buscar novas oportunidades nas empresas.
            </p>
          </div>

          <span className="font-mono text-xs font-semibold px-3 py-1 bg-blue-950/80 text-blue-300 border border-blue-800/80 rounded-full">
            Cron atual: <strong className="text-white">{getCronExpression(intervalHours)}</strong>
          </span>
        </div>

        {/* Radio Cards de Frequência */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {intervalOptions.map(opt => {
            const isSelected = intervalHours === opt.hours;
            return (
              <div
                key={opt.hours}
                onClick={() => handleIntervalChange(opt.hours)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none ${
                  isSelected
                    ? 'bg-blue-950/50 border-blue-500 shadow-sm shadow-blue-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-xs font-bold ${isSelected ? 'text-blue-300' : 'text-slate-200'}`}>
                    {opt.label}
                  </span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-blue-400 bg-blue-500' : 'border-slate-700 bg-slate-900'
                  }`}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {opt.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* GitHub Actions Cron Card */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Agendamento Automático no GitHub Actions</span>
            </div>
            <button
              onClick={handleCopyWorkflow}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              {copiedWorkflow ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span className="text-white font-bold">Código Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Workflow com {intervalHours}h</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            O arquivo de automação no GitHub executará a cada <strong>{intervalHours} hora{intervalHours > 1 ? 's' : ''}</strong> (expressão cron: <code className="text-cyan-300 font-mono bg-slate-900 px-1 py-0.5 rounded">{getCronExpression(intervalHours)}</code>).
          </p>

          {/* Guia Passo a Passo Visual */}
          <div className="mt-4 pt-4 border-t border-slate-900 space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>📋 Como ativar no seu GitHub (Passo a Passo Rápido):</span>
            </h4>

            <ol className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-start gap-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                <span className="w-5 h-5 rounded-full bg-blue-950 border border-blue-800 text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                <div>
                  Clique no botão azul <strong>"Copiar Workflow com {intervalHours}h"</strong> acima.
                </div>
              </li>

              <li className="flex items-start gap-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                <span className="w-5 h-5 rounded-full bg-blue-950 border border-blue-800 text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                <div>
                  No seu repositório no GitHub, clique no botão <strong>"Add file"</strong> ➔ <strong>"Create new file"</strong>.
                </div>
              </li>

              <li className="flex items-start gap-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                <span className="w-5 h-5 rounded-full bg-blue-950 border border-blue-800 text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                <div>
                  No campo do nome do arquivo, cole exatamente este caminho:
                  <div className="mt-1 font-mono text-[11px] bg-slate-950 border border-slate-800 text-cyan-300 p-1.5 rounded select-all">
                    .github/workflows/pipeline-cron.yml
                  </div>
                </div>
              </li>

              <li className="flex items-start gap-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                <span className="w-5 h-5 rounded-full bg-blue-950 border border-blue-800 text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">4</span>
                <div>
                  No corpo do arquivo, dê <strong>Colar (Ctrl+V)</strong> e clique no botão verde <strong>"Commit changes"</strong>.
                </div>
              </li>

              <li className="flex items-start gap-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">5</span>
                <div>
                  <strong className="text-emerald-400">Configurar Chave da IA (Segredo):</strong> No GitHub, vá em <strong>Settings ➔ Secrets and variables ➔ Actions</strong>, clique em <strong>"New repository secret"</strong>, crie o nome <code className="text-white font-mono bg-slate-950 px-1 py-0.5 rounded">GEMINI_API_KEY</code> e cole sua chave do Google AI Studio.
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Seção 2: Regras de Expiração & Limpeza */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Sliders className="w-4 h-4 text-emerald-400" />
          Regras de Atualização & Expiração de Vagas
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Desativar vaga após ausência na fonte oficial:
            </label>
            <select
              value={missedCyclesToClose}
              onChange={(e) => handleCyclesChange(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-hidden focus:border-blue-500"
            >
              <option value={1}>1 ciclo sem ser vista (Imediato)</option>
              <option value={2}>2 ciclos sem ser vista</option>
              <option value={3}>3 ciclos sem ser vista (Recomendado - evita falsos positivos)</option>
              <option value={5}>5 ciclos sem ser vista</option>
            </select>
            <span className="text-[11px] text-slate-500 block">
              Quando a empresa encerra a vaga, ela é marcada como CLOSED após esse número de checagens.
            </span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Deduplicação Criptográfica por Hash:
            </label>
            <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>SHA-256 Ativo (Economia de Quota da IA)</span>
            </div>
            <span className="text-[11px] text-slate-500 block">
              Vagas cujo conteúdo não mudou têm apenas a data de visualização atualizada, sem gastar chamadas do Gemini.
            </span>
          </div>
        </div>
      </div>

      {/* Seção 3: Status das Conexões */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          Status das Integrações do Sistema
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-bold text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Google Gemini AI</span>
              </div>
              <div className="text-slate-500 text-[11px]">Classificador com fallback heurístico</div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Operacional
            </span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-bold text-slate-200 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Supabase PostgreSQL</span>
              </div>
              <div className="text-slate-500 text-[11px]">Persistência em nuvem + Cache local</div>
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              supabaseReady 
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'bg-blue-950 text-blue-300 border border-blue-800'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {supabaseReady ? 'Conectado na Nuvem' : 'Cache Local Ativo'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
