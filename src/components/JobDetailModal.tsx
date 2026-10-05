import React from 'react';
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
  ArrowRight
} from 'lucide-react';
import { NormalizedJob } from '../connectors/base/types';
import { JobAnalysis } from '../types/job';

interface JobDetailModalProps {
  job: (NormalizedJob & { analysis?: JobAnalysis }) | null;
  isOpen: boolean;
  onClose: () => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, isOpen, onClose }) => {
  if (!isOpen || !job) return null;

  const analysis = job.analysis;

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
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
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

            {/* AI Reason */}
            {analysis?.reason && (
              <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-xs mb-4">
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

            {/* Key Facts Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
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

          {/* Full Job Description */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" />
              Descrição Original da Vaga
            </h3>
            <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-200/60 max-h-72 overflow-y-auto text-sm text-slate-700 leading-relaxed whitespace-pre-line font-mono text-xs">
              {job.description}
            </div>
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
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors flex-1 sm:flex-initial"
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
