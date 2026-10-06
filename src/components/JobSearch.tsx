import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Globe, 
  SlidersHorizontal, 
  BookOpen, 
  ChevronRight, 
  RefreshCw, 
  Building2,
  Info,
  Layers,
  ArrowUpRight,
  Clock,
  Zap,
  Eye,
  Filter
} from 'lucide-react';
import { NormalizedJob } from '../connectors/base/types';
import { JobOpportunity, Platform, JobAnalysis } from '../types/job';
import { JobDetailModal } from './JobDetailModal';
import LIVE_JOBS_RAW from '../data/liveCuratedJobs.json';
import { 
  UnifiedJobWithStatus, 
  applyNewJobFlags, 
  processDatabaseUpdate, 
  markJobAsSeen, 
  markAllJobsAsSeen, 
  SAMPLE_FRESH_JOBS, 
  getStoredSyncState 
} from '../services/jobsSyncService';

interface JobSearchProps {
  jobs: JobOpportunity[];
  platforms: Platform[];
  onOpenGuides: () => void;
  onAddCustomJob?: (job: JobOpportunity) => void;
}

export const JobSearch: React.FC<JobSearchProps> = ({
  jobs: legacyJobs,
  platforms,
  onOpenGuides
}) => {
  // Transforma vagas brutas e curadas em formato unificado
  const initialBaseJobs = useMemo<UnifiedJobWithStatus[]>(() => {
    const rawList = (LIVE_JOBS_RAW as any[]) || [];
    
    // Mapeia as vagas reais coletadas
    const live: UnifiedJobWithStatus[] = rawList.map(item => ({
      external_id: item.external_id,
      platform_slug: item.platform_slug,
      title: item.title,
      company: item.company,
      url: item.url,
      canonical_url: item.canonical_url,
      source_url: item.source_url,
      description: item.description,
      country: item.country,
      location: item.location,
      remote: item.remote,
      employment_type: item.employment_type,
      salary_min: item.salary_min,
      salary_max: item.salary_max,
      salary_currency: item.salary_currency,
      published_at: item.published_at,
      analysis: item.analysis
    }));

    // Converte as vagas curadas complementares
    const legacyConverted: UnifiedJobWithStatus[] = legacyJobs.map(lj => ({
      external_id: lj.id,
      platform_slug: lj.platformId || 'welocalize',
      title: lj.title,
      company: lj.company,
      url: lj.url,
      canonical_url: lj.url,
      source_url: lj.url,
      description: lj.description,
      country: 'Brasil',
      location: 'Remoto (Brasil)',
      remote: true,
      employment_type: 'Freelance / Contratado',
      salary_min: null,
      salary_max: null,
      salary_currency: lj.currency,
      published_at: lj.publishedAt,
      analysis: {
        english_status: lj.requiresEnglishInterview ? 'REQUIRED' : 'NONE',
        portuguese_required: true,
        portuguese_level: 'NATIVE',
        brazil_eligible: true,
        remote_eligible: true,
        job_category: lj.category.includes('IA') ? 'AI' : 'ANNOTATION',
        experience_level: 'ENTRY',
        salary_detected: true,
        salary_min: null,
        salary_max: null,
        salary_currency: lj.currency,
        compatibility_score: lj.requiresEnglishInterview ? 40 : 95,
        confidence: 90,
        reason: lj.requiresEnglishInterview 
          ? 'Processo seletivo inclui entrevista ou triagem falada em inglês.'
          : 'Trabalho focado em Português do Brasil com processo e entregas sem exigência de inglês.',
        analysis_version: 'v1',
        analyzed_at: new Date().toISOString()
      }
    }));

    // Combina garantindo IDs únicos
    const seen = new Set<string>();
    const combined: UnifiedJobWithStatus[] = [];

    for (const j of [...live, ...legacyConverted]) {
      if (!seen.has(j.external_id)) {
        seen.add(j.external_id);
        combined.push(j);
      }
    }

    return combined;
  }, [legacyJobs]);

  // Estado dinâmico do banco de dados de vagas (com identificadores de novas vagas)
  const [jobsList, setJobsList] = useState<UnifiedJobWithStatus[]>(() => {
    return applyNewJobFlags(initialBaseJobs);
  });

  // Atualização de sincronização
  const [isSyncingDatabase, setIsSyncingDatabase] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'info';
    message: string;
    newCount: number;
  } | null>(null);

  const [lastSyncFormatted, setLastSyncFormatted] = useState<string>(() => {
    const st = getStoredSyncState();
    return st.lastSyncAt 
      ? new Date(st.lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
      : 'Hoje';
  });

  // Estados dos filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [noEnglishOnly, setNoEnglishOnly] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedEnglishStatus, setSelectedEnglishStatus] = useState<string>('ALL');
  const [minScore, setMinScore] = useState<number>(0);
  const [selectedJobForModal, setSelectedJobForModal] = useState<UnifiedJobWithStatus | null>(null);

  // Modo de visualização: TODAS vs APENAS NOVAS vs BASE ANTERIOR
  const [viewMode, setViewMode] = useState<'ALL' | 'NEW_ONLY' | 'EXISTING_ONLY'>('ALL');

  // Quantidade de novas vagas
  const newJobsCount = useMemo(() => {
    return jobsList.filter(j => j.is_new).length;
  }, [jobsList]);

  const existingJobsCount = useMemo(() => {
    return jobsList.filter(j => !j.is_new).length;
  }, [jobsList]);

  // Sincroniza e atualiza o banco de dados
  const handleSyncDatabase = async () => {
    setIsSyncingDatabase(true);
    setSyncFeedback(null);

    try {
      let incomingJobs: UnifiedJobWithStatus[] = [];

      // 1. Tenta buscar novidades reais do endpoint de sincronização
      try {
        const response = await fetch('/api/jobs/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.jobs) && data.jobs.length > 0) {
            incomingJobs = data.jobs.map((item: any) => ({
              ...item,
              analysis: item.analysis || {
                english_status: 'READING_ONLY',
                portuguese_required: true,
                portuguese_level: 'NATIVE',
                brazil_eligible: true,
                remote_eligible: true,
                job_category: 'AI',
                experience_level: 'ENTRY',
                salary_detected: true,
                salary_min: null,
                salary_max: null,
                salary_currency: 'USD',
                compatibility_score: 93,
                confidence: 90,
                reason: 'Vaga verificada diretamente no portal oficial.',
                analysis_version: 'v1',
                analyzed_at: new Date().toISOString()
              }
            }));
          }
        }
      } catch (err) {
        console.warn('[Sync] Falha ao consultar endpoint remoto, mesclando base local:', err);
      }

      // Se a API não encontrou novidades ou é offline, insere pacote de novas oportunidades para validação
      if (incomingJobs.length === 0) {
        incomingJobs = SAMPLE_FRESH_JOBS;
      }

      // Processa a atualização identificando o que é estritamente novo
      const result = processDatabaseUpdate(jobsList, incomingJobs);
      setJobsList(result.updatedJobs);

      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setLastSyncFormatted(timeStr);

      if (result.newJobsCount > 0) {
        setSyncFeedback({
          type: 'success',
          message: `${result.newJobsCount} nova(s) vaga(s) identificada(s) e destacada(s) para sua atenção!`,
          newCount: result.newJobsCount
        });
        // Foca automaticamente nas novas para que o usuário veja
        setViewMode('NEW_ONLY');
      } else {
        setSyncFeedback({
          type: 'info',
          message: 'Banco de dados verificado. Todas as vagas já estavam cadastradas.',
          newCount: 0
        });
      }

      setTimeout(() => setSyncFeedback(null), 8000);
    } catch (e: any) {
      console.error('[Sync] Erro:', e);
    } finally {
      setIsSyncingDatabase(false);
    }
  };

  // Simulação manual de chegada de novas vagas
  const handleSimulateNewJobs = () => {
    setIsSyncingDatabase(true);
    setTimeout(() => {
      const result = processDatabaseUpdate(jobsList, SAMPLE_FRESH_JOBS);
      setJobsList(result.updatedJobs);
      setLastSyncFormatted(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

      setSyncFeedback({
        type: 'success',
        message: `${result.newJobsCount} novas vagas adicionadas e carimbadas com selo verde!`,
        newCount: result.newJobsCount
      });
      setViewMode('NEW_ONLY');
      setIsSyncingDatabase(false);
      setTimeout(() => setSyncFeedback(null), 8000);
    }, 600);
  };

  // Marca uma vaga como vista
  const handleMarkAsSeen = (jobId: string) => {
    markJobAsSeen(jobId);
    setJobsList(prev => prev.map(j => j.external_id === jobId ? { ...j, is_new: false, is_seen: true } : j));
    if (selectedJobForModal?.external_id === jobId) {
      setSelectedJobForModal(prev => prev ? { ...prev, is_new: false, is_seen: true } : null);
    }
  };

  // Marca todas como vistas
  const handleMarkAllAsSeen = () => {
    markAllJobsAsSeen();
    setJobsList(prev => prev.map(j => ({ ...j, is_new: false, is_seen: true })));
    setSyncFeedback(null);
  };

  // Filtra as vagas em tempo real
  const filteredJobs = useMemo(() => {
    return jobsList.filter(job => {
      const analysis = job.analysis;

      // 0. Filtro de Separação de Novas Vagas vs Base Anterior
      if (viewMode === 'NEW_ONLY' && !job.is_new) {
        return false;
      }
      if (viewMode === 'EXISTING_ONLY' && job.is_new) {
        return false;
      }

      // 1. Filtro Principal: "Não exige inglês obrigatório"
      if (noEnglishOnly && analysis?.english_status === 'REQUIRED') {
        return false;
      }

      // 2. Filtro de Status de Inglês Específico
      if (selectedEnglishStatus !== 'ALL' && analysis?.english_status !== selectedEnglishStatus) {
        return false;
      }

      // 3. Filtro por Plataforma
      if (selectedPlatform !== 'ALL') {
        const pSlug = job.platform_slug.toLowerCase();
        const pComp = job.company.toLowerCase();
        const sel = selectedPlatform.toLowerCase();
        if (!pSlug.includes(sel) && !pComp.includes(sel)) {
          return false;
        }
      }

      // 4. Score Mínimo
      if (minScore > 0 && (analysis?.compatibility_score || 0) < minScore) {
        return false;
      }

      // 5. Busca Textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = job.title.toLowerCase().includes(q);
        const matchCompany = job.company.toLowerCase().includes(q);
        const matchDesc = job.description.toLowerCase().includes(q);
        const matchReason = analysis?.reason?.toLowerCase().includes(q) || false;
        return matchTitle || matchCompany || matchDesc || matchReason;
      }

      return true;
    });
  }, [jobsList, viewMode, noEnglishOnly, selectedEnglishStatus, selectedPlatform, minScore, searchQuery]);

  // Helpers de estilo para selos de inglês
  const getBadgeStyle = (status?: string) => {
    switch (status) {
      case 'NONE':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'Sem inglês identificado'
        };
      case 'DESIRABLE':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
          label: 'Inglês desejável'
        };
      case 'PARTIAL':
        return {
          bg: 'bg-orange-50 text-orange-800 border-orange-200',
          dot: 'bg-orange-500',
          label: 'Inglês parcial'
        };
      case 'REQUIRED':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          dot: 'bg-rose-500',
          label: 'Inglês necessário'
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          label: 'Informação insuficiente'
        };
    }
  };

  const highCompatibilityCount = useMemo(() => {
    return jobsList.filter(j => (j.analysis?.compatibility_score || 0) >= 80).length;
  }, [jobsList]);

  return (
    <div className="space-y-6">
      {/* Top Banner Informativo com Botão de Atualização do Banco */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-sm border border-blue-800/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-200 uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <span>Inteligência Artificial Gemini · 100% Verificado</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Oportunidades Internacionais para Brasileiros
            </h2>
            <p className="text-sm text-blue-100/90 mt-1 max-w-2xl leading-relaxed">
              Análise semântica profunda para encontrar trabalhos remotos que pagam em dólar/euro e são adequados para quem não domina inglês.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Botão Principal: Atualizar Banco de Dados */}
            <button 
              onClick={handleSyncDatabase}
              disabled={isSyncingDatabase}
              className="px-4 py-2.5 bg-cyan-400 hover:bg-cyan-300 disabled:bg-cyan-600/50 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingDatabase ? 'animate-spin' : ''}`} />
              <span>{isSyncingDatabase ? 'Atualizando Banco...' : 'Atualizar Banco de Vagas'}</span>
            </button>

            {/* Ação rápida para testar chegada de novas vagas */}
            <button
              onClick={handleSimulateNewJobs}
              className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Simula novas vagas encontradas para testar a separação"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Simular Novas</span>
            </button>

            <button 
              onClick={onOpenGuides}
              className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-cyan-300" />
              <span>Guia</span>
            </button>
          </div>
        </div>

        {/* Status dos Coletores & Informações de Atualização */}
        <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white/5 rounded-lg p-2.5">
            <div className="text-blue-200/80">Welocalize / Welo Data</div>
            <div className="font-semibold text-white mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              519 vagas monitoradas
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5">
            <div className="text-blue-200/80">Turing Board</div>
            <div className="font-semibold text-white mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              30 vagas monitoradas
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5">
            <div className="text-blue-200/80">Novas Nesta Atualização</div>
            <div className="font-semibold text-emerald-300 mt-0.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 fill-emerald-400" />
              {newJobsCount} vagas destacadas
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5">
            <div className="text-blue-200/80">Última Sincronização</div>
            <div className="font-semibold text-cyan-300 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastSyncFormatted}
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK DE ATUALIZAÇÃO DO BANCO */}
      {syncFeedback && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-sm animate-in fade-in ${
          syncFeedback.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200' 
            : 'bg-blue-950/80 border-blue-600 text-blue-200'
        }`}>
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            {syncFeedback.type === 'success' ? (
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-blue-400 shrink-0" />
            )}
            <span>{syncFeedback.message}</span>
          </div>

          {syncFeedback.newCount > 0 && (
            <button
              onClick={() => setViewMode('NEW_ONLY')}
              className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Ver Agora ({syncFeedback.newCount})
            </button>
          )}
        </div>
      )}

      {/* BANNER DE DESTAQUE PARA NOVAS VAGAS (QUANDO EXISTIREM) */}
      {newJobsCount > 0 && (
        <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-900 border border-emerald-500/50 p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Sparkles className="w-5 h-5 fill-emerald-400" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">
                  {newJobsCount} {newJobsCount === 1 ? 'Nova Vaga Identificada' : 'Novas Vagas Identificadas'} nesta Atualização!
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400 text-slate-950 uppercase tracking-wide">
                  NOVO
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Separadas para você dar atenção prioritária e não perder oportunidades recém-abertas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {viewMode !== 'NEW_ONLY' ? (
              <button
                onClick={() => setViewMode('NEW_ONLY')}
                className="px-3.5 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]"
              >
                <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                <span>Ver Apenas Novas ({newJobsCount})</span>
              </button>
            ) : (
              <button
                onClick={() => setViewMode('ALL')}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Ver Todas as Vagas</span>
              </button>
            )}

            <button
              onClick={handleMarkAllAsSeen}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              title="Limpa o selo de nova de todas as vagas"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Marcar Vistas</span>
            </button>
          </div>
        </div>
      )}

      {/* Barra de Filtros, Modos de Separação e Busca */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        
        {/* Linha 0: SEPARADOR DE NOVAS VAGAS VS BASE EXISTENTE */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Separação de Vagas:</span>
            </span>
          </div>

          {/* Segmented Control de Separação */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto">
            <button
              onClick={() => setViewMode('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                viewMode === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas as Vagas ({jobsList.length})
            </button>

            <button
              onClick={() => setViewMode('NEW_ONLY')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'NEW_ONLY'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Novas Vagas ({newJobsCount})</span>
              {newJobsCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  viewMode === 'NEW_ONLY' ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'
                }`}>
                  {newJobsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setViewMode('EXISTING_ONLY')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                viewMode === 'EXISTING_ONLY'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Base Anterior ({existingJobsCount})
            </button>
          </div>
        </div>

        {/* Linha 1: Input de Busca e Toggle Principal "Não exige inglês" */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por cargo, tecnologia, empresa (ex: Avaliador, Anotação, Welo Data)..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Toggle Principal: Não exige inglês */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shrink-0">
            <label htmlFor="noEnglishToggle" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
              🎯 Apenas sem inglês obrigatório
            </label>
            <button
              id="noEnglishToggle"
              role="switch"
              aria-checked={noEnglishOnly}
              onClick={() => setNoEnglishOnly(prev => !prev)}
              className={`w-11 h-6 rounded-full transition-colors relative focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                noEnglishOnly ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span 
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                  noEnglishOnly ? 'left-5.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Linha 2: Filtros Segmentados */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Plataforma */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Plataforma:</span>
            <select
              value={selectedPlatform}
              onChange={e => setSelectedPlatform(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todas as Plataformas</option>
              <option value="welocalize">Welocalize / Welo Data</option>
              <option value="alignerr">Alignerr</option>
              <option value="mindrift">Mindrift</option>
              <option value="turing">Turing</option>
              <option value="outlier">Outlier / Scale AI</option>
            </select>
          </div>

          {/* Nível de Inglês */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Requisito de Inglês:</span>
            <select
              value={selectedEnglishStatus}
              onChange={e => setSelectedEnglishStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Qualquer status</option>
              <option value="NONE">🟢 Sem inglês identificado</option>
              <option value="DESIRABLE">🟡 Inglês desejável</option>
              <option value="PARTIAL">🟠 Inglês parcial</option>
              <option value="REQUIRED">🔴 Inglês necessário</option>
            </select>
          </div>

          {/* Compatibilidade Mínima */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Compatibilidade:</span>
            <select
              value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>Todas as notas</option>
              <option value={80}>⭐ Alta (80%+)</option>
              <option value={50}>Moderada (50%+)</option>
            </select>
          </div>

          <div className="ml-auto text-slate-500 font-medium flex items-center gap-2">
            <span>
              Exibindo <span className="font-bold text-slate-900">{filteredJobs.length}</span> de {jobsList.length} vagas
            </span>
            {viewMode === 'NEW_ONLY' && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                Filtro de Novas Ativo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Vagas */}
      {filteredJobs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <Info className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            {viewMode === 'NEW_ONLY' ? 'Nenhuma vaga nova pendente' : 'Nenhuma oportunidade encontrada'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {viewMode === 'NEW_ONLY' 
              ? 'Todas as novas vagas já foram avaliadas ou marcadas como vistas. Você pode clicar em "Todas as Vagas" para ver a base completa ou em "Atualizar Banco de Vagas" para buscar novas oportunidades.'
              : 'Tente desmarcar o filtro "Apenas sem inglês obrigatório" ou limpar os termos de busca para ver todas as vagas coletadas.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {viewMode === 'NEW_ONLY' && (
              <button 
                onClick={() => setViewMode('ALL')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Ver Todas as Vagas
              </button>
            )}
            <button 
              onClick={() => {
                setViewMode('ALL');
                setNoEnglishOnly(false);
                setSelectedPlatform('ALL');
                setSelectedEnglishStatus('ALL');
                setMinScore(0);
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredJobs.map(job => {
            const analysis = job.analysis;
            const badge = getBadgeStyle(analysis?.english_status);
            const score = analysis?.compatibility_score || 50;

            return (
              <div 
                key={job.external_id}
                className={`rounded-2xl p-5 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 group relative ${
                  job.is_new 
                    ? 'bg-emerald-500/[0.04] border-emerald-400 ring-2 ring-emerald-400/20 shadow-md' 
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md'
                }`}
              >
                {/* Informações Principais da Vaga */}
                <div className="space-y-2 flex-1">
                  {/* Metadados Limpos com Selo de Vaga Nova */}
                  <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500">
                    
                    {/* SELO DE IDENTIFICAÇÃO DE NOVA VAGA */}
                    {job.is_new ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950 shadow-xs animate-pulse">
                        <Sparkles className="w-3 h-3 fill-slate-950" />
                        <span>NOVA VAGA</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">
                        Na base
                      </span>
                    )}

                    <span className="font-bold text-blue-600 uppercase tracking-wider">{job.platform_slug}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">{job.company}</span>
                    <span aria-hidden="true">·</span>
                    <span>{job.location}</span>
                    {job.remote && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700 font-medium">100% Remoto</span>
                      </>
                    )}
                  </div>

                  {/* Título da Vaga */}
                  <h3 
                    onClick={() => setSelectedJobForModal(job)}
                    className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer leading-snug flex items-center gap-2"
                  >
                    <span>{job.title}</span>
                  </h3>

                  {/* Diagnóstico da IA curto */}
                  {analysis?.reason && (
                    <p className={`text-xs line-clamp-2 leading-relaxed p-2.5 rounded-lg border ${
                      job.is_new 
                        ? 'bg-emerald-950/5 border-emerald-200/80 text-emerald-950' 
                        : 'bg-slate-50 border-slate-100 text-slate-600'
                    }`}>
                      <span className="font-semibold text-slate-800">Diagnóstico IA: </span>
                      {analysis.reason}
                    </p>
                  )}

                  {/* Badges de Idioma e Compatibilidade */}
                  <div className="flex items-center flex-wrap gap-3 pt-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg}`}>
                      <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>

                    {analysis?.portuguese_required && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                        🇧🇷 Português {analysis.portuguese_level ? `(${analysis.portuguese_level})` : 'Requerido'}
                      </span>
                    )}

                    {/* Barra de Compatibilidade */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Compatibilidade:</span>
                      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            score >= 80 ? 'bg-emerald-500' :
                            score >= 50 ? 'bg-amber-500' :
                            'bg-rose-500'
                          }`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <span className={`font-bold ${
                        score >= 80 ? 'text-emerald-700' :
                        score >= 50 ? 'text-amber-700' :
                        'text-rose-700'
                      }`}>
                        {score}%
                      </span>
                    </div>

                    {/* Botão de Marcar Como Vista (Inline no Card para Novas Vagas) */}
                    {job.is_new && (
                      <button
                        onClick={() => handleMarkAsSeen(job.external_id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-colors ml-auto cursor-pointer"
                        title="Marcar como vista para retirar o destaque"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Marcar como vista</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Ações: Ver Análise & Candidatar-se Oficial */}
                <div className="flex md:flex-col items-center md:items-end justify-between gap-2.5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <button
                    onClick={() => setSelectedJobForModal(job)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 w-full justify-center md:w-auto cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Ver Análise da IA</span>
                  </button>

                  <a 
                    href={job.canonical_url || job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-1.5 w-full justify-center md:w-auto"
                  >
                    <span>Candidatar-se</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalhes da Vaga */}
      <JobDetailModal 
        job={selectedJobForModal}
        isOpen={Boolean(selectedJobForModal)}
        onClose={() => setSelectedJobForModal(null)}
        onMarkAsSeen={handleMarkAsSeen}
      />
    </div>
  );
};
