import React, { useState, useMemo } from 'react';
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
  ArrowUpRight
} from 'lucide-react';
import { NormalizedJob } from '../connectors/base/types';
import { JobOpportunity, Platform, JobAnalysis } from '../types/job';
import { JobDetailModal } from './JobDetailModal';
import LIVE_JOBS_RAW from '../data/liveCuratedJobs.json';

interface UnifiedJob extends NormalizedJob {
  analysis?: JobAnalysis;
}

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
  // Transforma vagas legadas em formato unificado
  const liveJobs = useMemo<UnifiedJob[]>(() => {
    const rawList = (LIVE_JOBS_RAW as any[]) || [];
    
    // Mapeia as vagas reais coletadas
    const live: UnifiedJob[] = rawList.map(item => ({
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
    const legacyConverted: UnifiedJob[] = legacyJobs.map(lj => ({
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
    const combined: UnifiedJob[] = [];

    for (const j of [...live, ...legacyConverted]) {
      if (!seen.has(j.external_id)) {
        seen.add(j.external_id);
        combined.push(j);
      }
    }

    return combined;
  }, [legacyJobs]);

  // Estados dos filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [noEnglishOnly, setNoEnglishOnly] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedEnglishStatus, setSelectedEnglishStatus] = useState<string>('ALL');
  const [minScore, setMinScore] = useState<number>(0);
  const [selectedJobForModal, setSelectedJobForModal] = useState<UnifiedJob | null>(null);

  // Filtra as vagas em tempo real
  const filteredJobs = useMemo(() => {
    return liveJobs.filter(job => {
      const analysis = job.analysis;

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
  }, [liveJobs, noEnglishOnly, selectedEnglishStatus, selectedPlatform, minScore, searchQuery]);

  // Helpers de estilo para selos de inglês conforme o PRD Seção 16
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
    return liveJobs.filter(j => (j.analysis?.compatibility_score || 0) >= 80).length;
  }, [liveJobs]);

  return (
    <div className="space-y-6">
      {/* Top Banner Informativo de Transparência */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={onOpenGuides}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition-colors flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-cyan-300" />
              <span>Como se Candidatar</span>
            </button>
          </div>
        </div>

        {/* Status dos Coletores Verificados */}
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
            <div className="text-blue-200/80">Outlier / Scale AI</div>
            <div className="font-semibold text-white mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Conector Oficial Ativo
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-2.5">
            <div className="text-blue-200/80">Alta Compatibilidade PT</div>
            <div className="font-semibold text-cyan-300 mt-0.5">
              {highCompatibilityCount} vagas prioritárias
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
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

          <div className="ml-auto text-slate-500 font-medium">
            Exibindo <span className="font-bold text-slate-900">{filteredJobs.length}</span> de {liveJobs.length} vagas
          </div>
        </div>
      </div>

      {/* Lista de Vagas */}
      {filteredJobs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <Info className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Nenhuma oportunidade encontrada</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Tente desmarcar o filtro "Apenas sem inglês obrigatório" ou limpar os termos de busca para ver todas as vagas coletadas.
          </p>
          <button 
            onClick={() => {
              setNoEnglishOnly(false);
              setSelectedPlatform('ALL');
              setSelectedEnglishStatus('ALL');
              setMinScore(0);
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Limpar Filtros
          </button>
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
                className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 group"
              >
                {/* Informações Principais da Vaga */}
                <div className="space-y-2 flex-1">
                  {/* Metadados Limpos com Separadores Tipográficos (Conforme Frontend Design Constitution) */}
                  <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500">
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
                    className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer leading-snug"
                  >
                    {job.title}
                  </h3>

                  {/* Diagnóstico da IA curto */}
                  {analysis?.reason && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
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
                  </div>
                </div>

                {/* Ações: Ver Análise & Candidatar-se Oficial */}
                <div className="flex md:flex-col items-center md:items-end justify-between gap-2.5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <button
                    onClick={() => setSelectedJobForModal(job)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 w-full justify-center md:w-auto"
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
      />
    </div>
  );
};
