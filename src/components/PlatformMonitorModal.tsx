import React, { useState } from 'react';
import { Platform } from '../types/job';
import { UnifiedJobWithStatus } from '../services/jobsSyncService';
import { 
  Activity, 
  CheckCircle2, 
  ExternalLink, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle, 
  X, 
  Clock, 
  Globe, 
  Database,
  Search
} from 'lucide-react';

interface PlatformMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  platforms: Platform[];
  jobs: UnifiedJobWithStatus[];
  lastSyncFormatted: string;
  onScanSinglePlatform: (platform: Platform) => Promise<void>;
  onScanAllPlatforms: () => Promise<void>;
  isScanning: boolean;
}

export const PlatformMonitorModal: React.FC<PlatformMonitorModalProps> = ({
  isOpen,
  onClose,
  platforms,
  jobs,
  lastSyncFormatted,
  onScanSinglePlatform,
  onScanAllPlatforms,
  isScanning
}) => {
  const [individualLoading, setIndividualLoading] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  if (!isOpen) return null;

  // Filtra apenas plataformas ativas ou favoritas (não blacklist)
  const activePlatforms = platforms.filter(p => p.status !== 'BLACKLIST');

  const filtered = activePlatforms.filter(p => 
    p.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
    (p.careersUrl || p.websiteUrl).toLowerCase().includes(filterSearch.toLowerCase())
  );

  const getJobsCountForPlatform = (p: Platform) => {
    const slug = (p.id || p.name).toLowerCase().replace(/[^a-z0-9]/g, '-');
    const name = p.name.toLowerCase();
    return jobs.filter(j => {
      const jSlug = j.platform_slug.toLowerCase();
      const jComp = j.company.toLowerCase();
      return jSlug.includes(slug) || slug.includes(jSlug) || jComp.includes(name) || name.includes(jComp);
    }).length;
  };

  const handleScanSingle = async (p: Platform) => {
    setIndividualLoading(p.id);
    try {
      await onScanSinglePlatform(p);
    } finally {
      setIndividualLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl relative my-6 text-slate-100 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Sistema de Monitoramento das Plataformas
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Supabase Live
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Auditoria e varredura em tempo real para garantir que todas as fontes cadastradas trazem vagas.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estatísticas no topo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 shrink-0">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-medium">Plataformas Monitoradas</span>
            <span className="text-lg font-bold text-white flex items-center gap-1.5 mt-0.5">
              <Globe className="w-4 h-4 text-blue-400" />
              {activePlatforms.length} ativas
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-medium">Vagas no Banco de Dados</span>
            <span className="text-lg font-bold text-white flex items-center gap-1.5 mt-0.5">
              <Database className="w-4 h-4 text-emerald-400" />
              {jobs.length} vagas
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-medium">Última Varredura Geral</span>
            <span className="text-xs font-semibold text-white flex items-center gap-1.5 mt-1 truncate">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {lastSyncFormatted}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block font-medium">Registro no Supabase</span>
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              Tabela source_logs Ativa
            </span>
          </div>
        </div>

        {/* Barra de Ações & Busca */}
        <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center mb-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar por nome ou URL da plataforma..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="button"
            disabled={isScanning}
            onClick={onScanAllPlatforms}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-900/30 transition shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Varrendo Todas as Plataformas...' : 'Varredura Completa em Todas as Fontes'}
          </button>
        </div>

        {/* Lista de Plataformas Monitoradas */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/40">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              Nenhuma plataforma correspondente encontrada.
            </div>
          ) : (
            filtered.map((platform) => {
              const jobsCount = getJobsCountForPlatform(platform);
              const isCurrentlyIndividualScanning = individualLoading === platform.id;
              const hasJobs = jobsCount > 0;

              return (
                <div 
                  key={platform.id}
                  className="pt-2 pb-2 px-3 hover:bg-slate-800/30 rounded-xl transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm truncate">{platform.name}</h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        hasJobs 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {hasJobs ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            {jobsCount} vaga(s) ativas
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                            Sem dados
                          </>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 px-1.5 py-0.2 bg-slate-800 rounded">
                        {platform.currency}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <a 
                        href={platform.careersUrl || platform.websiteUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1 truncate max-w-xs text-[11px]"
                      >
                        <Globe className="w-3 h-3 shrink-0" />
                        <span className="truncate">{platform.careersUrl || platform.websiteUrl}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                      <span className="text-[11px] text-slate-500">•</span>
                      <span className="text-[11px] text-slate-400">{platform.category}</span>
                    </div>
                  </div>

                  {/* Ação individual de varredura */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isCurrentlyIndividualScanning || isScanning}
                      onClick={() => handleScanSingle(platform)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                      title="Forçar varredura e coleta imediata desta plataforma"
                    >
                      <RefreshCw className={`w-3 h-3 ${isCurrentlyIndividualScanning ? 'animate-spin text-blue-400' : ''}`} />
                      {isCurrentlyIndividualScanning ? 'Varrendo...' : 'Varredura Agora'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0 mt-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Todos os dados e logs de cada varredura são persistidos automaticamente no Supabase.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-slate-400 hover:text-white bg-slate-800 rounded-lg text-xs"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
