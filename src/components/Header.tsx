import React from 'react';
import { ShieldAlert, Compass, Layers, Settings, BookOpen, Plus, Bot, Globe, Activity } from 'lucide-react';

interface HeaderProps {
  activeTab: 'jobs' | 'platforms' | 'blacklist' | 'crewai' | 'guide' | 'pipeline' | 'settings';
  setActiveTab: (tab: 'jobs' | 'platforms' | 'blacklist' | 'crewai' | 'guide' | 'pipeline' | 'settings') => void;
  blacklistCount: number;
  favoritesCount: number;
  activeAccountsCount: number;
  onOpenAddModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  blacklistCount,
  favoritesCount,
  activeAccountsCount,
  onOpenAddModal
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3">
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); setActiveTab('jobs'); }}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:border-blue-400 transition-colors">
              <Globe className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold tracking-tight text-white group-hover:text-blue-300 transition-colors">
                RemoteJobs
              </span>
              <span className="text-blue-400 font-mono text-sm font-bold bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800/60">
                PT
              </span>
            </div>
          </a>
        </div>

        {/* Zone 2: Navigation Links (Clean single line typography) */}
        <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'jobs'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Radar de Vagas</span>
          </button>

          {/* Unified Plataformas & Inscrições */}
          <button
            onClick={() => setActiveTab('platforms')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'platforms'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Plataformas & Inscrições</span>
            {activeAccountsCount > 0 && (
              <span className="font-mono text-[10px] bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 px-1.5 py-0.2 rounded tabular-nums">
                {activeAccountsCount} ativas
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('blacklist')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'blacklist'
                ? 'bg-slate-800 text-rose-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-rose-300 hover:bg-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Lista Negra</span>
            {blacklistCount > 0 && (
              <span className="font-mono text-[10px] bg-rose-950/80 border border-rose-800/60 text-rose-300 px-1.5 py-0.2 rounded tabular-nums">
                {blacklistCount}
              </span>
            )}
          </button>

          {/* CrewAI Automation Generator */}
          <button
            onClick={() => setActiveTab('crewai')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'crewai'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-emerald-400" />
            <span>Robô CrewAI</span>
          </button>

          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'pipeline'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Automação & Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-slate-800 text-blue-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-blue-300 hover:bg-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configurações</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Guia Moeda Forte</span>
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddModal}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova Plataforma</span>
            <span className="sm:hidden">Adicionar</span>
          </button>
        </div>

      </div>

      {/* Mobile navigation bar */}
      <div className="md:hidden flex items-center gap-1 overflow-x-auto pt-2.5 pb-1 border-t border-slate-800/60 mt-2.5 scrollbar-none">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'jobs' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400'
          }`}
        >
          Radar de Vagas
        </button>
        <button
          onClick={() => setActiveTab('platforms')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'platforms' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400'
          }`}
        >
          Plataformas
        </button>
        <button
          onClick={() => setActiveTab('crewai')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'crewai' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400'
          }`}
        >
          Robô CrewAI
        </button>
        <button
          onClick={() => setActiveTab('blacklist')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'blacklist' ? 'bg-slate-800 text-rose-400' : 'text-slate-400'
          }`}
        >
          Lista Negra ({blacklistCount})
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'pipeline' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'
          }`}
        >
          Automação & Logs
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'settings' ? 'bg-slate-800 text-blue-400' : 'text-slate-400'
          }`}
        >
          Configurações
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'guide' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400'
          }`}
        >
          Guia
        </button>
      </div>
    </header>
  );
};
