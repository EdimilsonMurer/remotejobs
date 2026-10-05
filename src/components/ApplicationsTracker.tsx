import React from 'react';
import { 
  CheckSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Plus, 
  Layers,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { Platform, UserAccountStatus } from '../types/job';

interface ApplicationsTrackerProps {
  platforms: Platform[];
  onUpdatePlatform: (platform: Platform) => void;
  onOpenAddModal: () => void;
}

export const ApplicationsTracker: React.FC<ApplicationsTrackerProps> = ({
  platforms,
  onUpdatePlatform,
  onOpenAddModal
}) => {
  const activePlatforms = platforms.filter(p => p.status !== 'BLACKLIST');

  const statusCounts = {
    NOT_REGISTERED: activePlatforms.filter(p => p.userStatus === 'NOT_REGISTERED').length,
    REGISTERED: activePlatforms.filter(p => p.userStatus === 'REGISTERED').length,
    EXAM_PENDING: activePlatforms.filter(p => p.userStatus === 'EXAM_PENDING').length,
    UNDER_REVIEW: activePlatforms.filter(p => p.userStatus === 'UNDER_REVIEW').length,
    APPROVED_ACTIVE: activePlatforms.filter(p => p.userStatus === 'APPROVED_ACTIVE').length,
  };

  const handleStatusChange = (platform: Platform, newStatus: UserAccountStatus) => {
    onUpdatePlatform({
      ...platform,
      userStatus: newStatus,
      updatedAt: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Meu Acompanhamento de Inscrições</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            A estratégia recomendada para ganhar em Dólar/Euro de forma contínua é manter cadastro ativo em <strong>3 a 5 plataformas simultâneas</strong>. Acompanhe o progresso de cada uma aqui.
          </p>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800 shrink-0">
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Aprovadas</span>
            <span className="text-sm font-bold font-mono text-emerald-400 tabular-nums">
              {statusCounts.APPROVED_ACTIVE}
            </span>
          </div>
          <div className="w-[1px] h-6 bg-slate-800" />
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Em Exame</span>
            <span className="text-sm font-bold font-mono text-amber-400 tabular-nums">
              {statusCounts.EXAM_PENDING}
            </span>
          </div>
          <div className="w-[1px] h-6 bg-slate-800" />
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">A Iniciar</span>
            <span className="text-sm font-bold font-mono text-slate-300 tabular-nums">
              {statusCounts.NOT_REGISTERED}
            </span>
          </div>
        </div>
      </div>

      {/* Tracker Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activePlatforms.map((platform) => {
          return (
            <div
              key={platform.id}
              className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
            >
              <div className="space-y-3">
                
                {/* Platform Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {platform.name}
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      {platform.category}
                    </span>
                  </div>

                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                    {platform.currency}
                  </span>
                </div>

                {/* Status Selector */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Status da Minha Conta
                  </label>
                  <select
                    value={platform.userStatus}
                    onChange={(e) => handleStatusChange(platform, e.target.value as UserAccountStatus)}
                    className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none transition-colors ${
                      platform.userStatus === 'APPROVED_ACTIVE'
                        ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                        : platform.userStatus === 'EXAM_PENDING'
                        ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                        : platform.userStatus === 'UNDER_REVIEW'
                        ? 'bg-blue-950/80 border-blue-700 text-blue-300'
                        : platform.userStatus === 'REGISTERED'
                        ? 'bg-purple-950/80 border-purple-700 text-purple-300'
                        : 'bg-slate-950 border-slate-700 text-slate-300'
                    }`}
                  >
                    <option value="NOT_REGISTERED">⚪ Ainda não tenho conta</option>
                    <option value="REGISTERED">🟣 Cadastro realizado</option>
                    <option value="EXAM_PENDING">🟡 Prova de qualificação pendente</option>
                    <option value="UNDER_REVIEW">🔵 Perfil em análise</option>
                    <option value="APPROVED_ACTIVE">🟢 Aprovado & Ativo em projetos</option>
                    <option value="INACTIVE">⚫ Inativo / Pausado</option>
                  </select>
                </div>

                {/* Quick Info */}
                <div className="text-xs text-slate-400 space-y-1 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span>Remuneração:</span>
                    <span className="font-mono text-emerald-400 font-medium">{platform.averagePayRate || 'A combinar'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Processo:</span>
                    <span className="text-slate-300">
                      {platform.processType === 'NO_INTERVIEW' ? 'Sem entrevista' : 'Exame online'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Recebimento:</span>
                    <span className="text-slate-300 truncate max-w-[140px]">{platform.paymentMethods.join(', ')}</span>
                  </div>
                </div>

              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <a
                  href={platform.careersUrl || platform.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Abrir Portal de Inscrição</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
