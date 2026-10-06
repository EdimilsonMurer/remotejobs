import React, { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Building2, 
  MapPin, 
  Calendar, 
  Layers, 
  ArrowRight,
  Languages,
  Loader2,
  EyeOff,
  Eye,
  DollarSign
} from 'lucide-react';
import { NormalizedJob } from '../connectors/base/types';
import { JobAnalysis } from '../types/job';
import { getPortugueseJobDescription, quickTranslateText } from '../services/translationService';
import { checkJobForBlockedKeywords } from '../services/blockedKeywordsService';
import { formatJobSalary, extractJobRequirements } from '../services/jobAnalysisHelper';

interface JobDetailModalProps {
  job: (NormalizedJob & { analysis?: JobAnalysis; is_new?: boolean; is_seen?: boolean; is_hidden?: boolean }) | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkAsSeen?: (jobId: string) => void;
  onHideJob?: (jobId: string) => void;
  onUnhideJob?: (jobId: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ 
  job, 
  isOpen, 
  onClose, 
  onMarkAsSeen,
  onHideJob,
  onUnhideJob
}) => {
  const [language, setLanguage] = useState<'pt' | 'en'>('pt');
  const [translatedDescription, setTranslatedDescription] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  const blockedCheck = job ? checkJobForBlockedKeywords(job.title, job.description) : { isBlocked: false, matchedTerms: [] };

  useEffect(() => {
    if (job) {
      setLanguage('pt');
      // Tradução rápida determinística imediata
      const quick = quickTranslateText(job.description);
      setTranslatedDescription(quick);

      // Busca tradução aprofundada em background
      getPortugueseJobDescription(job.external_id, job.description, (enhanced) => {
        setTranslatedDescription(enhanced);
      });
    }
  }, [job]);

  if (!isOpen || !job) return null;

  const analysis = job.analysis;
  const salary = formatJobSalary(job);
  const requirements = extractJobRequirements(job);

  const getEnglishBadge = (status?: string) => {
    switch (status) {
      case 'NONE':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          dot: 'bg-emerald-500',
          label: 'Sem inglês identificado',
          desc: 'Não foi identificado requisito de inglês para execução do trabalho.'
        };
      case 'DESIRABLE':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          dot: 'bg-amber-500',
          label: 'Inglês desejável',
          desc: 'Inglês é diferencial ("nice to have"), mas não é requisito eliminatório.'
        };
      case 'PARTIAL':
        return {
          bg: 'bg-orange-50 border-orange-200 text-orange-800',
          dot: 'bg-orange-500',
          label: 'Inglês parcial',
          desc: 'Entregas em português, mas pode exigir leitura básica de interface ou documentos em inglês.'
        };
      case 'REQUIRED':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-800',
          dot: 'bg-rose-500',
          label: 'Inglês necessário',
          desc: 'Inglês é mandatório (entrevistas, reuniões frequentes ou comunicação diária).'
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-200 text-slate-700',
          dot: 'bg-slate-400',
          label: 'Informação insuficiente',
          desc: 'Não há dados suficientes na descrição para garantir a ausência de inglês.'
        };
    }
  };

  const badge = getEnglishBadge(analysis?.english_status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <div className="pr-6">
            <div className="flex items-center flex-wrap gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              {job.is_new && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-slate-950 shadow-xs animate-pulse">
                  <Sparkles className="w-3 h-3 fill-slate-950" />
                  NOVA VAGA RECÉM-ADICIONADA
                </span>
              )}
              <span className="text-blue-600 font-bold">{job.platform_slug.toUpperCase()}</span>
              <span>·</span>
              <span>{job.company}</span>
              {job.remote && (
                <>
                  <span>·</span>
                  <span className="text-emerald-700 font-medium">100% Remoto</span>
                </>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
              {job.title}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* Diagnostic Card */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg}`}>
                  <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                  {badge.label}
                </span>
                <span className="text-xs text-slate-500">Classificação Automática Gemini AI</span>
              </div>

              {analysis && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Compatibilidade:</span>
                  <span className={`text-sm font-bold px-2.5 py-0.5 rounded-md ${
                    analysis.compatibility_score >= 80 ? 'bg-emerald-100 text-emerald-800' :
                    analysis.compatibility_score >= 50 ? 'bg-amber-100 text-amber-800' :
                    'bg-rose-100 text-rose-800'
                  }`}>
                    {analysis.compatibility_score}%
                  </span>
                </div>
              )}
            </div>

            {/* Alerta de Idiomas Estrangeiros / Termos Bloqueados */}
            {blockedCheck.isBlocked && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 mb-4 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-950">
                    Atenção: Exigência de outro idioma ou termo identificado ({blockedCheck.matchedTerms.join(', ')})
                  </span>
                  <p className="mt-0.5 text-amber-800 leading-relaxed">
                    O anúncio desta oportunidade menciona idiomas adicionais (como {blockedCheck.matchedTerms.join(', ')}). Vagas com esses termos são desqualificadas no filtro "Apenas Português".
                  </p>
                </div>
              </div>
            )}

            {/* AI Reason */}
            {analysis?.reason && (
              <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-xs mb-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                      Diagnóstico da IA para quem não fala inglês:
                    </h4>
                    <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                      {analysis.reason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Requisitos Identificados pela IA (se disponível) */}
            {requirements.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-xs mb-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Requisitos Identificados pela IA ({requirements.length}):</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {requirements.map((req, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/70 text-slate-800">
                      <span className="text-emerald-600 font-bold text-sm leading-none mt-0.5">✓</span>
                      <span className="font-medium leading-tight">{req}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Facts Grid com Salário */}
            <div className={`grid gap-3 text-xs ${salary ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {salary && (
                <div className="bg-emerald-50/90 p-3 rounded-lg border border-emerald-300 shadow-2xs col-span-2 sm:col-span-1">
                  <div className="text-emerald-800 font-bold mb-1 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Salário</span>
                  </div>
                  <div className="font-extrabold text-emerald-950 text-xs sm:text-[13px] leading-tight">
                    {salary}
                  </div>
                </div>
              )}
              <div className="bg-white p-3 rounded-lg border border-slate-200/70">
                <div className="text-slate-500 mb-1">Português</div>
                <div className="font-semibold text-slate-900">
                  {analysis?.portuguese_required ? `Exigido (${analysis.portuguese_level})` : 'Não especificado'}
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200/70">
                <div className="text-slate-500 mb-1">Aceita Brasil</div>
                <div className="font-semibold text-slate-900">
                  {analysis?.brazil_eligible ? '✅ Sim (Elegível)' : '⚠️ Restrito'}
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200/70">
                <div className="text-slate-500 mb-1">Localização</div>
                <div className="font-semibold text-slate-900 truncate" title={job.location}>
                  {job.location}
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200/70">
                <div className="text-slate-500 mb-1">Contrato</div>
                <div className="font-semibold text-slate-900 truncate">
                  {job.employment_type || 'Freelance / PJ'}
                </div>
              </div>
            </div>
          </div>

          {/* Full Job Description Section in PORTUGUESE with Switcher */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Languages className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  {language === 'pt' ? 'Descrição da Vaga em Português' : 'Descrição Original da Vaga (Inglês)'}
                </h3>
                {language === 'pt' && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                    <span>🇧🇷 Tradução PT-BR</span>
                  </span>
                )}
              </div>

              {/* Botões de Seleção de Idioma e Link Original */}
              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setLanguage('pt')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      language === 'pt'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                  >
                    <span>🇧🇷 Português</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      language === 'en'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                  >
                    <span>🇺🇸 Original (Inglês)</span>
                  </button>
                </div>

                <a
                  href={job.canonical_url || job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Abrir página oficial da vaga no portal da empresa"
                >
                  <span>Link da Vaga</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Container do Texto da Descrição */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/90 max-h-80 overflow-y-auto text-sm text-slate-800 leading-relaxed whitespace-pre-line font-sans selection:bg-emerald-200 selection:text-emerald-950">
              {language === 'pt' ? (
                translatedDescription || quickTranslateText(job.description)
              ) : (
                job.description
              )}
            </div>

            <p className="text-[11px] text-slate-500 italic">
              {language === 'pt' 
                ? '💡 A descrição foi traduzida automaticamente para o português brasileiro. Você pode alternar para o texto original a qualquer momento no seletor acima.'
                : 'Exibindo o texto original publicado pela empresa no portal de contratação.'}
            </p>
          </div>

          {/* Transparency & Safety Box */}
          <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-100 flex items-start gap-3 text-xs text-blue-900">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Transparência e Isenção de Taxas:</span>
              <p className="mt-0.5 text-blue-800 leading-relaxed">
                O RemoteJobs PT não intermedia contratações, não recebe currículos e nunca cobra taxas de candidatos. Ao clicar em candidatar-se, você será direcionado com segurança diretamente para o portal de carreiras oficial da empresa contratante.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-4 sticky bottom-0">
          <div className="text-xs text-slate-500 hidden sm:block">
            Fonte Oficial: <span className="font-medium text-slate-700">{job.source_url || job.url}</span>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            {job.is_hidden ? (
              onUnhideJob && (
                <button
                  onClick={() => {
                    onUnhideJob(job.external_id);
                    onClose();
                  }}
                  className="px-3.5 py-2.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 flex-1 sm:flex-initial cursor-pointer"
                  title="Restaurar vaga para exibição na lista principal"
                >
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>Restaurar Vaga</span>
                </button>
              )
            ) : (
              onHideJob && (
                <button
                  onClick={() => {
                    onHideJob(job.external_id);
                    onClose();
                  }}
                  className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 flex-1 sm:flex-initial cursor-pointer"
                  title="Ocultar vaga da visualização no app sem removê-la do banco"
                >
                  <EyeOff className="w-4 h-4 text-slate-500 hover:text-rose-600" />
                  <span>Ocultar Vaga</span>
                </button>
              )
            )}

            {job.is_new && onMarkAsSeen && (
              <button 
                onClick={() => {
                  onMarkAsSeen(job.external_id);
                }}
                className="px-3.5 py-2.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 flex-1 sm:flex-initial cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Marcar como Vista</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors flex-1 sm:flex-initial cursor-pointer"
            >
              Voltar à Lista
            </button>
            <a 
              href={job.canonical_url || job.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 flex-1 sm:flex-initial"
            >
              <span>Candidatar-se no Site Oficial</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
