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
  AlertCircle,
  EyeOff,
  RotateCcw,
  Languages,
  Plus,
  X,
  Tag,
  Link as LinkIcon,
  Server
} from 'lucide-react';
import { 
  getSupabaseConfig, 
  setCustomSupabaseConfig, 
  reinitializeSupabaseClient 
} from '../lib/supabase/client';
import { syncAllPlatformsToSupabase } from '../lib/supabase/platforms';
import { syncAllJobsToSupabase, checkSupabaseHealth } from '../lib/supabase/jobs';
import { getHiddenJobIds, unhideAllJobs } from '../services/jobsSyncService';
import { 
  getBlockedKeywords, 
  loadBlockedKeywordsFromSupabase,
  addBlockedKeyword, 
  removeBlockedKeyword, 
  resetDefaultBlockedKeywords, 
  clearAllBlockedKeywords 
} from '../services/blockedKeywordsService';

export const SettingsManager: React.FC = () => {
  // Configurações do Supabase
  const [supabaseCfg, setSupabaseCfg] = useState(() => getSupabaseConfig());
  const [inputUrl, setInputUrl] = useState(() => supabaseCfg.url);
  const [inputKey, setInputKey] = useState(() => supabaseCfg.anonKey);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [supabaseFeedback, setSupabaseFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [copiedVarName, setCopiedVarName] = useState<string | null>(null);

  const refreshHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const h = await checkSupabaseHealth();
      setHealthStatus(h);
    } catch {
      setHealthStatus(null);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    refreshHealth();
  }, [supabaseCfg.isConfigured]);

  useEffect(() => {
    const handler = () => {
      const updated = getSupabaseConfig();
      setSupabaseCfg(updated);
      setInputUrl(updated.url);
      setInputKey(updated.anonKey);
      refreshHealth();
    };
    window.addEventListener('supabase-configured-from-vercel', handler);
    return () => window.removeEventListener('supabase-configured-from-vercel', handler);
  }, []);

  // Intervalo de busca em horas (padrão: 6 horas)
  const [intervalHours, setIntervalHours] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('remotejobs_collector_interval_hours');
      return saved ? Number(saved) : 6;
    } catch {
      return 6;
    }
  });

  const [hiddenCount, setHiddenCount] = useState<number>(() => {
    return getHiddenJobIds().size;
  });

  // Lista de Palavras Proibidas / Blacklist de Termos em Anúncios
  const [blockedWords, setBlockedWords] = useState<string[]>(() => {
    return getBlockedKeywords();
  });

  useEffect(() => {
    // Carrega do Supabase ao montar o componente
    loadBlockedKeywordsFromSupabase().then(dbWords => {
      if (dbWords && dbWords.length > 0) {
        setBlockedWords(dbWords);
      }
    }).catch(() => {});

    const handler = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setBlockedWords(e.detail);
      }
    };
    window.addEventListener('blocked-keywords-updated', handler);
    return () => window.removeEventListener('blocked-keywords-updated', handler);
  }, []);

  const [newWordInput, setNewWordInput] = useState<string>('');

  const handleAddWord = () => {
    const trimmed = newWordInput.trim();
    if (!trimmed) return;
    const updated = addBlockedKeyword(trimmed);
    setBlockedWords(updated);
    setNewWordInput('');
    setSaveFeedback(`Palavra "${trimmed}" adicionada às regras de bloqueio!`);
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleRemoveWord = (word: string) => {
    const updated = removeBlockedKeyword(word);
    setBlockedWords(updated);
    setSaveFeedback(`Palavra "${word}" removida!`);
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleResetWords = () => {
    const updated = resetDefaultBlockedKeywords();
    setBlockedWords(updated);
    setSaveFeedback('Lista de palavras padrão de idiomas restaurada com sucesso!');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleClearWords = () => {
    const updated = clearAllBlockedKeywords();
    setBlockedWords(updated);
    setSaveFeedback('Todas as palavras proibidas foram limpas.');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

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

  const supabaseReady = supabaseCfg.isConfigured;

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

        {/* Vercel Webhook & Cron Card */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>URL do Webhook de Coleta Automática (Vercel)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/api/cron`;
                  navigator.clipboard.writeText(url);
                  setCopiedWorkflow(true);
                  setTimeout(() => setCopiedWorkflow(false), 3000);
                }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                {copiedWorkflow ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span className="text-white font-bold">URL Copiada!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar URL do Webhook</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="font-mono text-xs text-cyan-300 select-all truncate">
              {typeof window !== 'undefined' ? `${window.location.origin}/api/cron` : 'https://seu-app.vercel.app/api/cron'}
            </div>
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
              Endpoint Ativo
            </span>
          </div>

          {/* Duas Opções de Agendamento */}
          <div className="mt-4 pt-4 border-t border-slate-900 space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>🚀 Como Funciona o Agendamento Sem Precisar do GitHub Actions:</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Opção 1: Nativo Vercel */}
              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    1. Nativo da Vercel (1x por dia)
                  </span>
                  <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded text-slate-400">100% Automático</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Já configurado no seu arquivo <code className="text-cyan-300 font-mono">vercel.json</code>. A própria Vercel chama o <code className="text-cyan-300 font-mono">/api/cron</code> todos os dias às 21:00 (Horário de Brasília) sem você precisar configurar nada extra.
                </p>
              </div>

              {/* Opção 2: cron-job.org para 6h ou 12h */}
              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    2. Para 6h ou 12h (Via cron-job.org)
                  </span>
                  <span className="text-[10px] font-mono bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800">Gratuito</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Para rodar com intervalos menores no plano gratuito da Vercel, acesse o <strong className="text-white">cron-job.org</strong>, cole a URL copiada acima e escolha "A cada 12 horas". Ele dispara a Vercel na hora exata, sem nenhuma fila!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção 2: Palavras Proibidas nos Anúncios (Anti-Idiomas Estrangeiros) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Languages className="w-4 h-4 text-amber-400" />
              <span>Palavras Proibidas nos Anúncios (Filtro "Apenas Português")</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Vagas que contiverem qualquer um destes termos no título ou na descrição serão desqualificadas do modo "Apenas Português".
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleResetWords}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              title="Restaurar a lista padrão de termos de idiomas estrangeiros"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Restaurar Padrão</span>
            </button>
            {blockedWords.length > 0 && (
              <button
                onClick={handleClearWords}
                className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 text-xs font-medium rounded-lg transition-colors border border-slate-700 cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Input para Adicionar Nova Palavra */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Tag className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={newWordInput}
              onChange={(e) => setNewWordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddWord();
                }
              }}
              placeholder="Digite uma palavra para proibir (ex: italiano, bilingue, english, alemão)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <button
            onClick={handleAddWord}
            disabled={!newWordInput.trim()}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Termo</span>
          </button>
        </div>

        {/* Lista de Chips / Tags Ativas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Termos Ativos ({blockedWords.length}):</span>
            <span className="text-[11px] text-slate-500">Clique no "x" para remover qualquer termo</span>
          </div>

          {blockedWords.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
              Nenhuma palavra cadastrada. Use o campo acima ou clique em "Restaurar Padrão".
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800/90 max-h-48 overflow-y-auto">
              {blockedWords.map((word) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs rounded-lg font-medium transition-colors group"
                >
                  <span className="text-amber-400 font-semibold">{word}</span>
                  <button
                    onClick={() => handleRemoveWord(word)}
                    className="text-slate-400 hover:text-rose-400 transition-colors p-0.5 rounded cursor-pointer"
                    title={`Remover "${word}"`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Seção 3: Regras de Expiração & Limpeza */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Sliders className="w-4 h-4 text-emerald-400" />
          Regras de Atualização & Expiração de Vagas
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2 flex flex-col justify-between">
            <div>
              <label className="text-xs font-semibold text-slate-300 block flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Vagas Ocultadas pelo Usuário:</span>
              </label>
              <div className="text-xs text-slate-300 mt-1 font-medium">
                {hiddenCount > 0 ? (
                  <span className="text-amber-400 font-bold">{hiddenCount} vaga(s) oculta(s) da listagem</span>
                ) : (
                  <span className="text-slate-500">Nenhuma vaga oculta</span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                Permanecem registradas na base de dados para sincronização sem duplicidade.
              </span>
            </div>

            {hiddenCount > 0 && (
              <button
                onClick={() => {
                  unhideAllJobs();
                  setHiddenCount(0);
                  setSaveFeedback('Todas as vagas ocultadas foram restauradas com sucesso!');
                  setTimeout(() => setSaveFeedback(null), 4000);
                }}
                className="mt-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer w-full"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Restaurar Todas</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Seção 4: Configuração & Sincronização com Banco de Dados Supabase */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Conexão e Gravação com o Supabase PostgreSQL</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure suas credenciais do Supabase para gravar todas as plataformas e vagas na sua própria instância em nuvem.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              supabaseCfg.isConfigured 
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                : 'bg-amber-950 text-amber-300 border-amber-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${supabaseCfg.isConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{supabaseCfg.isConfigured ? 'Conectado ao Supabase' : 'Pendente de Configuração'}</span>
            </span>
          </div>
        </div>

        {/* Feedback de Sincronização */}
        {supabaseFeedback && (
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in ${
            supabaseFeedback.type === 'success' 
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200' 
              : 'bg-rose-950/90 border-rose-600 text-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {supabaseFeedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <span>{supabaseFeedback.message}</span>
            </div>
            <button
              onClick={() => setSupabaseFeedback(null)}
              className="text-slate-400 hover:text-white p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Card Principal: Configuração Centralizada na Vercel & Supabase */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              <span>Conexão Universal com o Supabase (Hospedado na Vercel)</span>
            </h3>

            {supabaseCfg.isConfigured && (
              <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950 border border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 w-fit">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Ativo para todos os navegadores</span>
              </span>
            )}
          </div>

          {/* Quando já configurado pela Vercel */}
          {supabaseCfg.isConfigured ? (
            <div className="p-4 bg-emerald-950/30 border border-emerald-800/80 rounded-xl space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Supabase Conectado Automaticamente via Vercel</span>
                  </span>
                  <p className="text-[11px] text-slate-300">
                    As credenciais estão salvas no servidor da Vercel. Qualquer novo navegador, aba anônima ou dispositivo conecta instantaneamente sem precisar digitar chaves.
                  </p>
                  <div className="font-mono text-[11px] text-slate-400 pt-1">
                    URL: <span className="text-cyan-300">{supabaseCfg.url}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => refreshHealth()}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                  <span>Testar Conexão</span>
                </button>
              </div>
            </div>
          ) : (
            /* Quando pendente: Instruções exatas para a Vercel */
            <div className="p-4 bg-blue-950/30 border border-blue-800/80 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 mt-0.5">
                  <Database className="w-4 h-4" />
                </div>
                <div className="space-y-1 text-xs text-slate-300">
                  <span className="font-bold text-white block text-sm">
                    Como Configurar na Vercel (Uma única vez para todos os navegadores):
                  </span>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Para não precisar digitar credenciais toda vez que abrir o app em outro navegador, basta cadastrar estas duas variáveis nas configurações do seu projeto na Vercel (<strong className="text-white">Settings &gt; Environment Variables</strong>):
                  </p>
                </div>
              </div>

              {/* Cards de Variáveis para copiar com 1 clique */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Nome da Variável 1 (URL):</span>
                    <span className="font-mono text-xs font-bold text-cyan-300">VITE_SUPABASE_URL</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('VITE_SUPABASE_URL');
                      setCopiedVarName('VITE_SUPABASE_URL');
                      setTimeout(() => setCopiedVarName(null), 2500);
                    }}
                    className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Copiar nome da variável"
                  >
                    {copiedVarName === 'VITE_SUPABASE_URL' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Nome da Variável 2 (Chave Anon):</span>
                    <span className="font-mono text-xs font-bold text-cyan-300">VITE_SUPABASE_ANON_KEY</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('VITE_SUPABASE_ANON_KEY');
                      setCopiedVarName('VITE_SUPABASE_ANON_KEY');
                      setTimeout(() => setCopiedVarName(null), 2500);
                    }}
                    className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Copiar nome da variável"
                  >
                    {copiedVarName === 'VITE_SUPABASE_ANON_KEY' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] text-slate-400">
                  Dica: Você também pode cadastrar como <code className="text-white font-mono">SUPABASE_URL</code> e <code className="text-white font-mono">SUPABASE_ANON_KEY</code>.
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    setIsCheckingHealth(true);
                    try {
                      const res = await fetch('/api/config');
                      if (res.ok) {
                        const data = await res.json();
                        if (data.isConfigured) {
                          window.location.reload();
                        } else {
                          setSupabaseFeedback({
                            type: 'error',
                            message: 'A Vercel ainda não detectou as variáveis de ambiente. Verifique o painel da Vercel e faça um Redeploy se necessário.'
                          });
                        }
                      }
                    } catch {
                      setSupabaseFeedback({
                        type: 'error',
                        message: 'Erro ao consultar endpoint da Vercel.'
                      });
                    } finally {
                      setIsCheckingHealth(false);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                  <span>Verificar Configuração da Vercel Agora</span>
                </button>
              </div>
            </div>
          )}

          {/* Opção discreta de substituição manual neste navegador (apenas para testes) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowManualOverride(!showManualOverride)}
              className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
            >
              <span>{showManualOverride ? '▲ Ocultar substituição manual' : '▼ Deseja inserir ou alterar credenciais manualmente neste navegador?'}</span>
            </button>

            {showManualOverride && (
              <div className="mt-3 p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3 animate-in fade-in">
                <span className="text-xs font-semibold text-slate-300 block">
                  Substituição Local (Salva apenas neste navegador atual):
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">URL do Projeto Supabase:</label>
                    <input
                      type="url"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="https://seu-projeto.supabase.co"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono placeholder:text-slate-600 text-xs focus:outline-hidden focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Chave Anônima Pública (Anon Key):</label>
                    <input
                      type="password"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono placeholder:text-slate-600 text-xs focus:outline-hidden focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomSupabaseConfig(inputUrl, inputKey);
                      reinitializeSupabaseClient();
                      const updated = getSupabaseConfig();
                      setSupabaseCfg(updated);
                      if (updated.isConfigured) {
                        setSupabaseFeedback({
                          type: 'success',
                          message: 'Credenciais locais ativadas com sucesso!'
                        });
                        refreshHealth();
                      } else {
                        setSupabaseFeedback({
                          type: 'error',
                          message: 'Credenciais inválidas. Verifique a URL e a Chave.'
                        });
                      }
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar neste Navegador</span>
                  </button>

                  {(inputUrl || inputKey) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomSupabaseConfig('', '');
                        reinitializeSupabaseClient();
                        const updated = getSupabaseConfig();
                        setSupabaseCfg(updated);
                        setInputUrl('');
                        setInputKey('');
                        setSupabaseFeedback({
                          type: 'success',
                          message: 'Substituição manual removida. Usando configuração padrão da Vercel.'
                        });
                        refreshHealth();
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Limpar Manual
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-400">
              Operações de Sincronização em Massa:
            </span>

            {/* BOTÕES DE GRAVAÇÃO NO SUPABASE */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isSyncingSupabase}
                onClick={async () => {
                  setIsSyncingSupabase(true);
                  setSupabaseFeedback(null);
                  try {
                    const res = await syncAllPlatformsToSupabase();
                    if (res.success) {
                      setSupabaseFeedback({ type: 'success', message: res.message });
                      refreshHealth();
                    } else {
                      setSupabaseFeedback({ type: 'error', message: res.message });
                    }
                  } catch (err: any) {
                    setSupabaseFeedback({
                      type: 'error',
                      message: err.message || 'Erro ao gravar plataformas no Supabase.'
                    });
                  } finally {
                    setIsSyncingSupabase(false);
                  }
                }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-spin' : ''}`} />
                <span>Gravar Plataformas</span>
              </button>

              <button
                type="button"
                disabled={isSyncingSupabase}
                onClick={async () => {
                  setIsSyncingSupabase(true);
                  setSupabaseFeedback(null);
                  try {
                    const res = await syncAllJobsToSupabase();
                    if (res.success) {
                      setSupabaseFeedback({ type: 'success', message: res.message });
                      refreshHealth();
                    } else {
                      setSupabaseFeedback({ type: 'error', message: res.message });
                    }
                  } catch (err: any) {
                    setSupabaseFeedback({
                      type: 'error',
                      message: err.message || 'Erro ao gravar vagas no Supabase.'
                    });
                  } finally {
                    setIsSyncingSupabase(false);
                  }
                }}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                <span>Gravar Vagas + IA</span>
              </button>

              <button
                type="button"
                disabled={isSyncingSupabase}
                onClick={async () => {
                  setIsSyncingSupabase(true);
                  setSupabaseFeedback(null);
                  try {
                    const resPlat = await syncAllPlatformsToSupabase();
                    const resJobs = await syncAllJobsToSupabase();
                    if (resPlat.success || resJobs.success) {
                      setSupabaseFeedback({
                        type: 'success',
                        message: `Banco sincronizado! Plataformas: ${resPlat.totalSynced}/${resPlat.totalAttempted} | Vagas: ${resJobs.totalSynced}/${resJobs.totalAttempted}`
                      });
                      refreshHealth();
                    } else {
                      setSupabaseFeedback({
                        type: 'error',
                        message: resPlat.message || resJobs.message || 'Erro na sincronização completa.'
                      });
                    }
                  } catch (err: any) {
                    setSupabaseFeedback({
                      type: 'error',
                      message: err.message || 'Erro inesperado na sincronização total.'
                    });
                  } finally {
                    setIsSyncingSupabase(false);
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Sincronizar TUDO no Supabase</span>
              </button>
            </div>
          </div>

          {/* DIAGNÓSTICO EM TEMPO REAL DAS TABELAS DO SUPABASE */}
          {supabaseCfg.isConfigured && (
            <div className="pt-3 border-t border-slate-900 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Diagnóstico em Tempo Real do Banco de Dados:</span>
                </span>
                <button
                  type="button"
                  onClick={refreshHealth}
                  disabled={isCheckingHealth}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                  <span>Atualizar Status</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">Tabela platforms</span>
                  <span className="text-sm font-bold text-white">
                    {healthStatus?.platformsTableExists ? `${healthStatus.platformsCount} gravadas` : (
                      <span className="text-rose-400 text-xs">Não encontrada</span>
                    )}
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">Tabela jobs</span>
                  <span className="text-sm font-bold text-white">
                    {healthStatus?.jobsTableExists ? `${healthStatus.jobsCount} gravadas` : (
                      <span className="text-rose-400 text-xs">Não encontrada</span>
                    )}
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">Tabela job_analysis</span>
                  <span className="text-sm font-bold text-white">
                    {healthStatus?.jobAnalysisTableExists ? (
                      <span className="text-emerald-400 text-xs">Ativa</span>
                    ) : (
                      <span className="text-rose-400 text-xs">Não encontrada</span>
                    )}
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">Palavras Bloqueadas</span>
                  <span className="text-sm font-bold text-white">
                    {healthStatus?.blockedKeywordsCount ? `${healthStatus.blockedKeywordsCount} regras` : 'Padrão Local'}
                  </span>
                </div>
              </div>

              {healthStatus && (!healthStatus.platformsTableExists || !healthStatus.jobsTableExists) && (
                <div className="p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Tabelas pendentes de criação no Supabase:</strong> Execute o script SQL unificado abaixo no seu painel do Supabase para criar as tabelas <code className="text-white">platforms</code>, <code className="text-white">jobs</code> e <code className="text-white">job_analysis</code>.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* AJUDA DE CRIAÇÃO COMPLETA DO BANCO (SQL MIGRATION UNIFICADO) */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Server className="w-4 h-4 text-emerald-400" />
                <span>Script SQL Completo: Criação das Tabelas de Plataformas, Vagas e IA</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Cria e configura com 1 clique todas as tabelas (<code className="text-cyan-300 font-mono">platforms</code>, <code className="text-cyan-300 font-mono">jobs</code>, <code className="text-cyan-300 font-mono">job_analysis</code>, <code className="text-cyan-300 font-mono">job_applications</code>, <code className="text-cyan-300 font-mono">blocked_keywords</code>, <code className="text-cyan-300 font-mono">source_logs</code>) com permissões públicas de leitura e escrita.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const completeSql = `-- ============================================================================
-- REMOTEHUNTER PRO / REMOTEJOBS PT - SCHEMA UNIFICADO E COMPLETO DO SUPABASE
-- Execute este script no SQL Editor do seu projeto Supabase:
-- Painel Supabase > SQL Editor > New Query > Colar este código > Run
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE PLATAFORMAS (platforms)
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

-- 2. TABELA DE VAGAS (jobs)
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

-- 3. TABELA DE ANÁLISE DE IA (job_analysis)
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

-- 4. TABELA DE CANDIDATURAS (job_applications)
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

-- 5. TABELA DE PALAVRAS BLOQUEADAS (blocked_keywords)
CREATE TABLE IF NOT EXISTS blocked_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    term VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) DEFAULT 'IDIOMA_ESTRANGEIRO',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE LOGS DOS COLETORES (source_logs)
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

-- 7. ÍNDICES DE ALTA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_platforms_slug ON platforms(slug);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_platform_slug ON jobs(platform_slug);
CREATE INDEX IF NOT EXISTS idx_jobs_published_at ON jobs(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_analysis_job_id ON job_analysis(job_id);

-- 8. POLÍTICAS DE ROW LEVEL SECURITY (RLS) - Permite leitura e escrita públicas
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

-- 9. SEED DAS 13 PLATAFORMAS OFICIAIS
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

-- 10. RECARREGA SCHEMA NO POSTGREST DO SUPABASE
NOTIFY pgrst, 'reload schema';`;

                navigator.clipboard.writeText(completeSql);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 3000);
              }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-cyan-300 border border-cyan-800/60 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              {copiedSql ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">SQL Completo Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-cyan-400" />
                  <span>Copiar Script SQL Completo (Todas as Tabelas)</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-2 text-[11px] text-slate-300">
            <span className="font-bold text-white block">📋 Passo a Passo para Ativar o Banco no Supabase:</span>
            <ol className="list-decimal list-inside space-y-1 text-slate-400">
              <li>Acesse o seu painel do Supabase (<code className="text-cyan-300 font-mono">https://supabase.com/dashboard</code>).</li>
              <li>No menu lateral esquerdo, clique em <strong>SQL Editor</strong> &gt; <strong>New Query</strong>.</li>
              <li>Clique no botão acima <strong>"Copiar Script SQL Completo"</strong>, cole na caixa do editor do Supabase e clique no botão verde <strong>Run</strong>.</li>
              <li>Pronto! Todas as tabelas (<code className="text-white">platforms</code>, <code className="text-white">jobs</code>, etc.) serão criadas com as permissões corretas. Em seguida, clique em <strong>"Sincronizar TUDO no Supabase"</strong> acima para popular os dados!</li>
            </ol>
          </div>
        </div>

      </div>
    </div>
  );
};
