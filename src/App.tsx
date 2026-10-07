import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { JobSearch } from './components/JobSearch';
import { PlatformManager } from './components/PlatformManager';
import { BlacklistManager } from './components/BlacklistManager';
import { CrewAIGenerator } from './components/CrewAIGenerator';
import { SettingsManager } from './components/SettingsManager';
import { GuidesModal } from './components/GuidesModal';
import { PlatformModal } from './components/PlatformModal';
import { PipelineMonitor } from './components/PipelineMonitor';
import { Platform, BlacklistRule, JobOpportunity } from './types/job';
import { INITIAL_PLATFORMS, INITIAL_BLACKLIST_RULES } from './data/initialPlatforms';
import { CURATED_JOBS } from './data/curatedJobs';
import { loadPlatformsFromSupabase, savePlatformToSupabase } from './lib/supabase/platforms';
import { saveJobToSupabase } from './lib/supabase/jobs';

const STORAGE_KEY_PLATFORMS = 'remotehunter_platforms_v1';
const STORAGE_KEY_RULES = 'remotehunter_blacklist_rules_v1';

const sortPlatformsAlphabetically = (list: Platform[]): Platform[] => {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'platforms' | 'blacklist' | 'crewai' | 'guide' | 'pipeline' | 'settings'>('jobs');
  
  // Load state from localStorage with fallbacks & auto-migration (sempre em ordem alfabética)
  const [platforms, setPlatforms] = useState<Platform[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLATFORMS);
      if (saved) {
        const parsed: Platform[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = parsed.map(p => {
            if (p.id === 'welocalize' && (p.careersUrl?.includes('jobs.lever.co') || p.websiteUrl?.includes('jobs.lever.co'))) {
              return {
                ...p,
                careersUrl: 'https://www.welocalize.com/careers/',
                websiteUrl: 'https://www.welocalize.com/'
              };
            }
            return p;
          });
          return sortPlatformsAlphabetically(migrated);
        }
      }
    } catch (e) {
      console.error('Error loading platforms from storage:', e);
    }
    return sortPlatformsAlphabetically(INITIAL_PLATFORMS);
  });

  // Carrega do Supabase em segundo plano ao inicializar
  useEffect(() => {
    loadPlatformsFromSupabase().then(loaded => {
      if (loaded && loaded.length > 0) {
        setPlatforms(sortPlatformsAlphabetically(loaded));
      }
    }).catch(err => {
      console.warn('[Supabase] Usando cache local:', err);
    });
  }, []);

  const [blacklistRules, setBlacklistRules] = useState<BlacklistRule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RULES);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading blacklist rules from storage:', e);
    }
    return INITIAL_BLACKLIST_RULES;
  });

  const [jobs, setJobs] = useState<JobOpportunity[]>(() => {
    try {
      const savedJobs = localStorage.getItem('remotehunter_custom_jobs_v1');
      if (savedJobs) {
        const parsed = JSON.parse(savedJobs);
        return [...parsed, ...CURATED_JOBS];
      }
    } catch (e) {
      console.error('Error loading custom jobs:', e);
    }
    return CURATED_JOBS;
  });

  const handleAddCustomJob = (newJob: JobOpportunity) => {
    const stampedJob = { ...newJob, isNew: true, firstSeenAt: new Date().toISOString() };
    setJobs(prev => [stampedJob, ...prev]);
    try {
      const savedCustom = JSON.parse(localStorage.getItem('remotehunter_custom_jobs_v1') || '[]');
      localStorage.setItem('remotehunter_custom_jobs_v1', JSON.stringify([stampedJob, ...savedCustom]));
    } catch (e) {
      console.error('Error saving custom job:', e);
    }

    // Persiste no Supabase PostgreSQL
    saveJobToSupabase({
      external_id: newJob.id,
      platform_slug: newJob.platformId || 'outros',
      title: newJob.title,
      company: newJob.company,
      url: newJob.url,
      canonical_url: newJob.url,
      source_url: newJob.url,
      description: newJob.description || '',
      country: 'Brasil',
      location: 'Remoto',
      remote: true,
      employment_type: 'Freelance',
      salary_min: null,
      salary_max: null,
      salary_currency: newJob.currency || 'USD',
      published_at: new Date().toISOString(),
      analysis: {
        english_status: newJob.requiresEnglishInterview ? 'REQUIRED' : 'NONE',
        portuguese_required: true,
        portuguese_level: 'NATIVE',
        brazil_eligible: true,
        remote_eligible: true,
        job_category: 'AI',
        experience_level: 'ENTRY',
        salary_detected: true,
        salary_min: null,
        salary_max: null,
        salary_currency: newJob.currency || 'USD',
        compatibility_score: newJob.requiresEnglishInterview ? 40 : 95,
        confidence: 90,
        reason: 'Vaga cadastrada pelo usuário.',
        analysis_version: 'v1',
        analyzed_at: new Date().toISOString()
      }
    }).catch(err => console.warn('[Supabase] Erro ao salvar vaga:', err));
  };

  const handleBatchImportJobs = (importedList: JobOpportunity[]) => {
    const stampedList = importedList.map(j => ({ ...j, isNew: true, firstSeenAt: new Date().toISOString() }));
    setJobs(prev => [...stampedList, ...prev]);
    try {
      const savedCustom = JSON.parse(localStorage.getItem('remotehunter_custom_jobs_v1') || '[]');
      localStorage.setItem('remotehunter_custom_jobs_v1', JSON.stringify([...stampedList, ...savedCustom]));
    } catch (e) {
      console.error('Error saving imported jobs:', e);
    }

    // Persiste no Supabase PostgreSQL
    for (const j of importedList) {
      saveJobToSupabase({
        external_id: j.id,
        platform_slug: j.platformId || 'outros',
        title: j.title,
        company: j.company,
        url: j.url,
        canonical_url: j.url,
        source_url: j.url,
        description: j.description || '',
        country: 'Brasil',
        location: 'Remoto',
        remote: true,
        employment_type: 'Freelance',
        salary_min: null,
        salary_max: null,
        salary_currency: j.currency || 'USD',
        published_at: new Date().toISOString()
      }).catch(() => {});
    }
  };
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [initialModalUrl, setInitialModalUrl] = useState<string>('');

  // Sync platforms to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PLATFORMS, JSON.stringify(platforms));
    } catch (e) {
      console.error('Error saving platforms:', e);
    }
  }, [platforms]);

  // Sync blacklist rules to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(blacklistRules));
    } catch (e) {
      console.error('Error saving blacklist rules:', e);
    }
  }, [blacklistRules]);

  // Handlers
  const handleSavePlatform = (savedPlatform: Platform) => {
    setPlatforms(prev => {
      const targetSlug = savedPlatform.id.toLowerCase();
      const targetName = savedPlatform.name.trim().toLowerCase();
      const exists = prev.some(p => p.id.toLowerCase() === targetSlug || p.name.trim().toLowerCase() === targetName);
      let updated: Platform[];
      if (exists) {
        updated = prev.map(p => (p.id.toLowerCase() === targetSlug || p.name.trim().toLowerCase() === targetName) ? savedPlatform : p);
      } else {
        updated = [savedPlatform, ...prev];
      }
      try {
        localStorage.setItem(STORAGE_KEY_PLATFORMS, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving platforms:', e);
      }
      return updated;
    });

    // Salva no Supabase e em cache local
    savePlatformToSupabase(savedPlatform).catch(err => {
      console.warn('[Supabase] Erro ao sincronizar plataforma:', err);
    });

    // If marked as Blacklist, ensure there's a rule for it too
    if (savedPlatform.status === 'BLACKLIST') {
      const ruleExists = blacklistRules.some(r => r.name.toLowerCase() === savedPlatform.name.toLowerCase());
      if (!ruleExists) {
        const newRule: BlacklistRule = {
          id: `rule-${Date.now()}`,
          name: savedPlatform.name,
          type: 'PLATFORM',
          reason: savedPlatform.blacklistReason || 'Plataforma adicionada à lista negra',
          addedAt: new Date().toISOString().split('T')[0]
        };
        setBlacklistRules(r => [newRule, ...r]);
      }
    }
  };

  const handleDeletePlatform = (id: string) => {
    setPlatforms(prev => prev.filter(p => p.id !== id));
  };

  const handleAddRule = (rule: BlacklistRule) => {
    setBlacklistRules(prev => [rule, ...prev]);
  };

  const handleRemoveRule = (id: string) => {
    setBlacklistRules(prev => prev.filter(r => r.id !== id));
  };

  const handleOpenEdit = (platform: Platform) => {
    setEditingPlatform(platform);
    setInitialModalUrl('');
    setIsAddModalOpen(true);
  };

  const handleOpenAdd = (url?: string) => {
    setEditingPlatform(null);
    setInitialModalUrl(url || '');
    setIsAddModalOpen(true);
  };

  const blacklistCount = platforms.filter(p => p.status === 'BLACKLIST').length + blacklistRules.filter(r => !platforms.some(p => p.status === 'BLACKLIST' && p.name.toLowerCase() === r.name.toLowerCase())).length;
  const favoritesCount = platforms.filter(p => p.status === 'FAVORITE').length;
  const activeAccountsCount = platforms.filter(p => p.status !== 'BLACKLIST' && p.userStatus === 'APPROVED_ACTIVE').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        blacklistCount={blacklistCount}
        favoritesCount={favoritesCount}
        activeAccountsCount={activeAccountsCount}
        onOpenAddModal={handleOpenAdd}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6">
        {activeTab === 'jobs' && (
          <JobSearch
            jobs={jobs}
            platforms={platforms}
            onOpenGuides={() => setActiveTab('guide')}
            onAddCustomJob={handleAddCustomJob}
          />
        )}

        {activeTab === 'platforms' && (
          <PlatformManager
            platforms={platforms}
            onUpdatePlatform={handleSavePlatform}
            onDeletePlatform={handleDeletePlatform}
            onOpenAddModal={handleOpenAdd}
            onOpenEditModal={handleOpenEdit}
          />
        )}

        {activeTab === 'blacklist' && (
          <BlacklistManager
            platforms={platforms}
            blacklistRules={blacklistRules}
            onAddRule={handleAddRule}
            onRemoveRule={handleRemoveRule}
            onUpdatePlatform={handleSavePlatform}
          />
        )}

        {activeTab === 'crewai' && (
          <CrewAIGenerator
            platforms={platforms}
            blacklistRules={blacklistRules}
            onImportJobs={handleBatchImportJobs}
          />
        )}

        {activeTab === 'pipeline' && (
          <PipelineMonitor />
        )}

        {activeTab === 'settings' && (
          <SettingsManager />
        )}

        {activeTab === 'guide' && (
          <GuidesModal />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>RemoteHunter Pro — Monitor de Oportunidades Remotas em Moeda Forte</span>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Dados salvos localmente</span>
            <span>·</span>
            <span>Sem intermediários</span>
          </div>
        </div>
      </footer>

      {/* Add / Edit Platform Modal */}
      <PlatformModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingPlatform(null);
          setInitialModalUrl('');
        }}
        onSave={handleSavePlatform}
        editingPlatform={editingPlatform}
        initialUrl={initialModalUrl}
      />

    </div>
  );
}
