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
import { CandidateNotepad } from './components/CandidateNotepad';
import { Platform, BlacklistRule, JobOpportunity } from './types/job';
import { INITIAL_PLATFORMS, INITIAL_BLACKLIST_RULES } from './data/initialPlatforms';
import { loadPlatformsFromSupabase, savePlatformToSupabase, deletePlatformFromSupabase } from './lib/supabase/platforms';
import { saveJobToSupabase, harvestJobsForPlatform, isFabricatedJob } from './lib/supabase/jobs';
import { PasswordLockScreen } from './components/PasswordLockScreen';
import { isAppAuthenticated, logoutApp } from './lib/supabase/security';

const STORAGE_KEY_PLATFORMS = 'remotehunter_platforms_v1';
const STORAGE_KEY_RULES = 'remotehunter_blacklist_rules_v1';

const sortPlatformsAlphabetically = (list: Platform[]): Platform[] => {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isAppAuthenticated());

  useEffect(() => {
    const authHandler = (e: any) => {
      if (e.detail && typeof e.detail.authenticated === 'boolean') {
        setIsAuthenticated(e.detail.authenticated);
      } else {
        setIsAuthenticated(isAppAuthenticated());
      }
    };
    window.addEventListener('app-auth-changed', authHandler);
    return () => window.removeEventListener('app-auth-changed', authHandler);
  }, []);

  const [activeTab, setActiveTab] = useState<'jobs' | 'platforms' | 'blacklist' | 'crewai' | 'guide' | 'pipeline' | 'settings' | 'notepad'>('jobs');
  
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
            // Auto-desbloqueia Turing do cache antigo se possuía a regra antiga
            if (p.id === 'turing' && p.status === 'BLACKLIST' && p.blacklistReason?.includes('Exige testes avançados')) {
              return {
                ...p,
                category: 'Desenvolvimento & IA',
                currency: 'USD' as const,
                englishRequirement: 'BASIC' as const,
                processType: 'ONLINE_EXAM' as const,
                status: 'ACTIVE' as const,
                blacklistReason: undefined,
                averagePayRate: '$15.00 - $40.00 / hora',
                notes: p.notes || 'Foco em desenvolvedores e treinadores de IA em código.'
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

  // Carrega do Supabase e sincroniza em tempo real com controle de frequência
  useEffect(() => {
    let lastFetched = 0;
    const fetchLivePlatforms = (force = false) => {
      const now = Date.now();
      if (!force && now - lastFetched < 15000) {
        return;
      }
      lastFetched = now;
      loadPlatformsFromSupabase().then(loaded => {
        if (loaded && loaded.length > 0) {
          setPlatforms(sortPlatformsAlphabetically(loaded));
        }
      }).catch(err => {
        console.warn('[Supabase] Usando cache local:', err);
      });
    };

    fetchLivePlatforms(true);

    const vercelHandler = () => fetchLivePlatforms(true);
    const focusHandler = () => fetchLivePlatforms(false);

    window.addEventListener('supabase-configured-from-vercel', vercelHandler);
    window.addEventListener('focus', focusHandler);

    return () => {
      window.removeEventListener('supabase-configured-from-vercel', vercelHandler);
      window.removeEventListener('focus', focusHandler);
    };
  }, []);

  const [blacklistRules, setBlacklistRules] = useState<BlacklistRule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RULES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(r => r.id !== 'bl-turing' && r.name.toLowerCase() !== 'turing');
        }
      }
    } catch (e) {
      console.error('Error loading blacklist rules from storage:', e);
    }
    return INITIAL_BLACKLIST_RULES.filter(r => r.id !== 'bl-turing' && r.name.toLowerCase() !== 'turing');
  });

  const [jobs, setJobs] = useState<JobOpportunity[]>(() => {
    try {
      const savedJobs = localStorage.getItem('remotehunter_custom_jobs_v1');
      if (savedJobs) {
        const parsed = JSON.parse(savedJobs);
        if (Array.isArray(parsed)) {
          return parsed.filter(j => !isFabricatedJob({ external_id: j.id, title: j.title, description: j.description }));
        }
      }
    } catch (e) {
      console.error('Error loading custom jobs:', e);
    }
    return [];
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
      analysis: undefined
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

    // Se a plataforma não estiver na lista negra, faz varredura imediata de vagas e limpa regra de bloqueio
    if (savedPlatform.status !== 'BLACKLIST') {
      harvestJobsForPlatform(savedPlatform).catch(err => {
        console.warn('[Harvest Platform Jobs] Erro ao coletar vagas da nova plataforma:', err);
      });
      // Remove de forma consistente qualquer regra da lista negra com o mesmo nome
      setBlacklistRules(r => {
        const filtered = r.filter(rule => rule.name.toLowerCase() !== savedPlatform.name.toLowerCase());
        try {
          localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(filtered));
        } catch {}
        return filtered;
      });
    }

    // Se marcada como Blacklist, garante que haja uma regra correspondente
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
        setBlacklistRules(r => {
          const updated = [newRule, ...r];
          try {
            localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    }
  };

  const handleDeletePlatform = (id: string) => {
    setPlatforms(prev => prev.filter(p => p.id !== id));
    deletePlatformFromSupabase(id).catch(err => console.warn('[Supabase] Erro ao deletar plataforma:', err));
  };

  const handleAddRule = (rule: BlacklistRule) => {
    setBlacklistRules(prev => [rule, ...prev]);
  };

  const handleRemoveRule = (id: string) => {
    const ruleToRemove = blacklistRules.find(r => r.id === id);
    setBlacklistRules(prev => {
      const updated = prev.filter(r => r.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (ruleToRemove) {
      setPlatforms(prev => {
        let changed = false;
        const updated = prev.map(p => {
          if (p.name.toLowerCase() === ruleToRemove.name.toLowerCase() && p.status === 'BLACKLIST') {
            changed = true;
            const updatedPlatform: Platform = {
              ...p,
              status: 'ACTIVE',
              blacklistReason: undefined
            };
            savePlatformToSupabase(updatedPlatform).catch(() => {});
            return updatedPlatform;
          }
          return p;
        });
        if (changed) {
          try {
            localStorage.setItem(STORAGE_KEY_PLATFORMS, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });
    }
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

  if (!isAuthenticated) {
    return <PasswordLockScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

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
        onLockApp={() => logoutApp()}
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

        {activeTab === 'notepad' && (
          <CandidateNotepad />
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
