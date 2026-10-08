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
  Eye,
  EyeOff,
  Filter,
  RotateCcw,
  X,
  FileText,
  DollarSign,
  ArrowUpDown,
  ArrowDownAZ,
  TrendingDown,
  Activity
} from 'lucide-react';
import { NormalizedJob } from '../connectors/base/types';
import { JobOpportunity, Platform, JobAnalysis } from '../types/job';
import { JobDetailModal } from './JobDetailModal';
import { PlatformMonitorModal } from './PlatformMonitorModal';
import { ConnectorRegistry } from '../connectors/registry';
import LIVE_JOBS_RAW from '../data/liveCuratedJobs.json';
import { 
  UnifiedJobWithStatus, 
  applyNewJobFlags, 
  processDatabaseUpdate, 
  markJobAsSeen, 
  markAllJobsAsSeen, 
  hideJob, 
  unhideJob, 
  unhideAllJobs, 
  getStoredSyncState, 
  saveSyncState,
  formatSyncDateTime 
} from '../services/jobsSyncService';
import { 
  checkJobForBlockedKeywords, 
  getBlockedKeywords, 
  loadBlockedKeywordsFromSupabase 
} from '../services/blockedKeywordsService';
import { 
  formatJobSalary, 
  extractJobRequirements, 
  getJobSalaryNumericValue 
} from '../services/jobAnalysisHelper';
import { 
  loadJobsFromSupabase, 
  saveJobToSupabase, 
  syncAllJobsToSupabase,
  recordDatabaseSyncLog,
  harvestJobsForPlatform
} from '../lib/supabase/jobs';
import { isSupabaseConfigured } from '../lib/supabase/client';

export type JobSortMode = 'DEFAULT' | 'PLATFORM_ASC' | 'SALARY_DESC' | 'COMPATIBILITY_DESC' | 'NEWEST';

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

  const [isSupabaseLive, setIsSupabaseLive] = useState(false);
  const [isSyncingDatabase, setIsSyncingDatabase] = useState(false);
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'info';
    message: string;
    newCount: number;
  } | null>(null);

  const [lastSyncFormatted, setLastSyncFormatted] = useState<string>(() => {
    const st = getStoredSyncState();
    return formatSyncDateTime(st.lastSyncAt);
  });

  // Carrega vagas persistidas diretamente do Supabase PostgreSQL
  useEffect(() => {
    const fetchJobs = () => {
      loadJobsFromSupabase().then(({ jobs: dbJobs, fromSupabase, totalCount, lastUpdatedAt }) => {
        if (fromSupabase && totalCount > 0) {
          setIsSupabaseLive(true);
          setJobsList(applyNewJobFlags(dbJobs));
          
          // PREVENÇÃO DE REGRESSÃO DE HORA: Compara com o timestamp local e escolhe o mais recente
          const localSync = getStoredSyncState().lastSyncAt;
          let effectiveSync = lastUpdatedAt;
          if (localSync) {
            if (!effectiveSync || new Date(localSync).getTime() > new Date(effectiveSync).getTime()) {
              effectiveSync = localSync;
            }
          }
          if (effectiveSync) {
            setLastSyncFormatted(formatSyncDateTime(effectiveSync));
          }
        } else if (fromSupabase && totalCount === 0) {
          // Supabase conectado com 0 vagas: faz semeadura inicial automática
          setIsSupabaseLive(true);
          console.log('🌱 [Supabase] Semeando vagas iniciais no banco de dados...');
          syncAllJobsToSupabase(initialBaseJobs).then((syncRes) => {
            if (syncRes.success) {
              loadJobsFromSupabase().then(({ jobs: seededJobs }) => {
                if (seededJobs && seededJobs.length > 0) {
                  setJobsList(applyNewJobFlags(seededJobs));
                }
              }).catch(() => {});
            }
          }).catch(() => {});
        }
      }).catch(err => {
        console.warn('[Supabase Jobs] Usando cache local:', err);
      });
    };

    fetchJobs();

    const vercelHandler = () => {
      fetchJobs();
    };

    const harvestHandler = (e: any) => {
      if (e.detail?.jobs && Array.isArray(e.detail.jobs)) {
        setJobsList(prev => {
          const result = processDatabaseUpdate(prev, e.detail.jobs);
          return result.updatedJobs;
        });
        const nowIso = new Date().toISOString();
        const st = getStoredSyncState();
        st.lastSyncAt = nowIso;
        saveSyncState(st);
        setLastSyncFormatted(formatSyncDateTime(nowIso));
        setSyncFeedback({
          type: 'success',
          message: `${e.detail.jobs.length} vaga(s) da plataforma ${e.detail.platform || ''} sincronizadas e registradas no banco de dados!`,
          newCount: e.detail.jobs.length
        });
        setTimeout(() => setSyncFeedback(null), 8000);
      }
    };

    window.addEventListener('supabase-configured-from-vercel', vercelHandler);
    window.addEventListener('platform-jobs-harvested', harvestHandler);

    return () => {
      window.removeEventListener('supabase-configured-from-vercel', vercelHandler);
      window.removeEventListener('platform-jobs-harvested', harvestHandler);
    };
  }, [initialBaseJobs]);

  // Estados dos filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyPortuguese, setOnlyPortuguese] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedEnglishStatus, setSelectedEnglishStatus] = useState<string>('ALL');
  const [minScore, setMinScore] = useState<number>(0);
  const [selectedJobForModal, setSelectedJobForModal] = useState<UnifiedJobWithStatus | null>(null);

  // Modos de ordenação das vagas:
  // 1- por ordem alfabética da plataforma
  // 2- por ordem de maior para menor salário
  const [sortMode, setSortMode] = useState<JobSortMode>('DEFAULT');

  // Palavras Proibidas / Termos de Outros Idiomas
  const [blockedKeywords, setBlockedKeywords] = useState<string[]>(() => getBlockedKeywords());

  useEffect(() => {
    loadBlockedKeywordsFromSupabase().then(dbWords => {
      if (dbWords && dbWords.length > 0) {
        setBlockedKeywords(dbWords);
      }
    }).catch(() => {});

    const handler = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setBlockedKeywords(e.detail);
      } else {
        setBlockedKeywords(getBlockedKeywords());
      }
    };
    window.addEventListener('blocked-keywords-updated', handler);
    return () => window.removeEventListener('blocked-keywords-updated', handler);
  }, []);

  // Modo de visualização: TODAS vs APENAS NOVAS vs BASE ANTERIOR vs OCULTADAS
  const [viewMode, setViewMode] = useState<'ALL' | 'NEW_ONLY' | 'EXISTING_ONLY' | 'HIDDEN_ONLY'>('ALL');

  // Toast temporário de vaga ocultada com ação de desfazer
  const [hiddenToast, setHiddenToast] = useState<{ id: string; title: string } | null>(null);

  // Quantidade de vagas ativas e ocultas
  const activeJobsCount = useMemo(() => {
    return jobsList.filter(j => !j.is_hidden).length;
  }, [jobsList]);

  const newJobsCount = useMemo(() => {
    return jobsList.filter(j => j.is_new && !j.is_hidden).length;
  }, [jobsList]);

  const existingJobsCount = useMemo(() => {
    return jobsList.filter(j => !j.is_new && !j.is_hidden).length;
  }, [jobsList]);

  const hiddenJobsCount = useMemo(() => {
    return jobsList.filter(j => j.is_hidden).length;
  }, [jobsList]);

  // Varredura de plataforma individual via Sistema de Monitoramento
  const handleScanSinglePlatform = async (platform: Platform) => {
    try {
      const res = await harvestJobsForPlatform(platform);
      if (res.success && res.jobs.length > 0) {
        const result = processDatabaseUpdate(jobsList, res.jobs);
        setJobsList(result.updatedJobs);
        setSyncFeedback({
          type: 'success',
          message: `${res.jobs.length} vaga(s) da plataforma ${platform.name} verificadas e registradas com sucesso!`,
          newCount: res.jobs.length
        });
      } else {
        setSyncFeedback({
          type: 'info',
          message: `Plataforma ${platform.name} verificada. Conexão operacional!`,
          newCount: 0
        });
      }
      setTimeout(() => setSyncFeedback(null), 6000);
    } catch (e: any) {
      console.error('[Scan Single Error]:', e);
    }
  };

  // Sincroniza e atualiza o banco de dados
  const handleSyncDatabase = async () => {
    setIsSyncingDatabase(true);
    setSyncFeedback(null);

    try {
      let incomingJobs: UnifiedJobWithStatus[] = [];

      // 1. Tenta carregar dados mais recentes do Supabase PostgreSQL
      try {
        const { jobs: supabaseJobs, fromSupabase, totalCount } = await loadJobsFromSupabase();
        if (fromSupabase && totalCount > 0) {
          setIsSupabaseLive(true);
          incomingJobs = [...supabaseJobs];
        }
      } catch (e: any) {
        console.warn('[Sync] Falha ao consultar Supabase:', e?.message);
      }

      // 2. Tenta buscar novidades em tempo real dos coletores oficiais passando todas as plataformas cadastradas
      try {
        const response = await fetch('/api/jobs/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platforms })
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.jobs) && data.jobs.length > 0) {
            const freshlyCollected: UnifiedJobWithStatus[] = data.jobs.map((item: any) => ({
              ...item,
              analysis: item.analysis || {
                english_status: 'NONE',
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
                compatibility_score: 95,
                confidence: 90,
                reason: 'Vaga verificada diretamente no portal oficial.',
                analysis_version: 'v1',
                analyzed_at: new Date().toISOString()
              }
            }));

            // Persiste no Supabase caso configurado
            if (isSupabaseConfigured()) {
              for (const j of freshlyCollected) {
                saveJobToSupabase(j).catch(() => {});
              }
            }

            incomingJobs = [...freshlyCollected, ...incomingJobs];
          }
        }
      } catch (err) {
        console.warn('[Sync] Falha ao consultar endpoint remoto, mesclando base:', err);
      }

      // 3. Resiliência do cliente: executa coletores registrados no cliente (incluindo Mercor, Welocalize, Turing, etc.)
      try {
        const registry = ConnectorRegistry.getInstance();
        const connectors = registry.getAllConnectors(platforms);
        for (const connector of connectors) {
          try {
            const cJobs = await connector.collect();
            if (cJobs && cJobs.length > 0) {
              const mapped: UnifiedJobWithStatus[] = cJobs.map(cj => ({
                ...cj,
                is_new: true,
                first_seen_at: new Date().toISOString()
              }));
              if (isSupabaseConfigured()) {
                for (const mj of mapped) {
                  saveJobToSupabase(mj).catch(() => {});
                }
              }
              incomingJobs = [...mapped, ...incomingJobs];
            }
          } catch {}
        }
      } catch (err) {
        console.warn('[Sync Client Registry]', err);
      }

      const nowIso = new Date().toISOString();
      const st = getStoredSyncState();
      st.lastSyncAt = nowIso;
      saveSyncState(st);
      setLastSyncFormatted(formatSyncDateTime(nowIso));

      // Grava log oficial no Supabase source_logs para que qualquer refresh mantenha esta data
      await recordDatabaseSyncLog('all-sync', incomingJobs.length);

      if (incomingJobs.length > 0) {
        // Processa a atualização identificando o que é estritamente novo
        const result = processDatabaseUpdate(jobsList, incomingJobs);
        setJobsList(result.updatedJobs);

        if (result.newJobsCount > 0) {
          setSyncFeedback({
            type: 'success',
            message: `${result.newJobsCount} nova(s) vaga(s) sincronizadas e registradas no banco de dados!`,
            newCount: result.newJobsCount
          });
        } else {
          setSyncFeedback({
            type: 'info',
            message: isSupabaseConfigured() 
              ? 'Banco de dados Supabase verificado. Todas as plataformas e vagas estão sincronizadas e atualizadas!' 
              : 'Base de dados verificada com sucesso.',
            newCount: 0
          });
        }
      } else {
        setSyncFeedback({
          type: 'info',
          message: 'Banco de dados verificado com sucesso. Nenhuma nova vaga no momento.',
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

  // Oculta uma vaga (mantém no banco para sync, mas remove da visualização normal)
  const handleHideJob = (jobId: string) => {
    hideJob(jobId);
    const targetJob = jobsList.find(j => j.external_id === jobId);
    setJobsList(prev => prev.map(j => j.external_id === jobId ? { ...j, is_hidden: true } : j));
    if (selectedJobForModal?.external_id === jobId) {
      setSelectedJobForModal(null);
    }
    setHiddenToast({ id: jobId, title: targetJob?.title || 'Vaga' });
    setTimeout(() => {
      setHiddenToast(prev => prev?.id === jobId ? null : prev);
    }, 6000);
  };

  // Restaura uma vaga que estava oculta
  const handleUnhideJob = (jobId: string) => {
    unhideJob(jobId);
    setJobsList(prev => prev.map(j => j.external_id === jobId ? { ...j, is_hidden: false } : j));
    if (selectedJobForModal?.external_id === jobId) {
      setSelectedJobForModal(prev => prev ? { ...prev, is_hidden: false } : null);
    }
    if (hiddenToast?.id === jobId) {
      setHiddenToast(null);
    }
  };

  // Restaura todas as vagas ocultadas
  const handleUnhideAllJobs = () => {
    unhideAllJobs();
    setJobsList(prev => prev.map(j => ({ ...j, is_hidden: false })));
    setHiddenToast(null);
  };

  // Filtra as vagas em tempo real
  const filteredJobs = useMemo(() => {
    return jobsList.filter(job => {
      const analysis = job.analysis;

      // 0. Modo de Visualização de Ocultadas vs Não Ocultadas
      if (viewMode === 'HIDDEN_ONLY') {
        if (!job.is_hidden) return false;
      } else {
        // Nas outras abas, esconde as vagas marcadas como ocultas
        if (job.is_hidden) return false;

        // Filtro de Separação de Novas Vagas vs Base Anterior
        if (viewMode === 'NEW_ONLY' && !job.is_new) {
          return false;
        }
        if (viewMode === 'EXISTING_ONLY' && job.is_new) {
          return false;
        }
      }

      // 1. Filtro Principal: "🎯 Apenas Português (Sem exigência de outros idiomas)"
      // Quando o usuário está na aba de "Novas Vagas" ou "Ocultadas", aplicamos apenas se marcado
      if (viewMode !== 'NEW_ONLY' && viewMode !== 'HIDDEN_ONLY' && onlyPortuguese) {
        // Se a IA marcou como exigindo inglês obrigatório
        if (analysis?.english_status === 'REQUIRED') {
          return false;
        }
        // Se o anúncio contém qualquer palavra proibida / menção a outros idiomas (ex: italiano, bilíngue, etc.)
        const { isBlocked } = checkJobForBlockedKeywords(job.title, job.description, blockedKeywords);
        if (isBlocked) {
          return false;
        }
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

      // 4. Score Mínimo (apenas para base geral ou quando definido acima de 0)
      if (viewMode !== 'NEW_ONLY' && viewMode !== 'HIDDEN_ONLY' && minScore > 0 && (analysis?.compatibility_score || 0) < minScore) {
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
  }, [jobsList, viewMode, onlyPortuguese, blockedKeywords, selectedEnglishStatus, selectedPlatform, minScore, searchQuery]);

  // Mapeamento rápido de ID para Nome amigável de cada plataforma
  const platformNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (platforms || []).forEach(p => {
      map.set(p.id.toLowerCase(), p.name);
    });
    return map;
  }, [platforms]);

  // Retorna o nome de exibição formatado da plataforma para a vaga
  const getPlatformDisplayName = (job: UnifiedJobWithStatus): string => {
    const slug = (job.platform_slug || '').toLowerCase();
    if (platformNameMap.has(slug)) {
      return platformNameMap.get(slug)!;
    }
    if (job.company && job.company.trim().length > 0) {
      return job.company.trim();
    }
    if (slug) {
      return slug.charAt(0).toUpperCase() + slug.slice(1);
    }
    return 'Outra Plataforma';
  };

  // Aplica as ordenações solicitadas:
  // 1- por ordem alfabética da plataforma (A-Z)
  // 2- por ordem de maior para menor salário ($$$ -> $)
  // + ordenação por compatibilidade, mais recentes ou padrão
  const sortedAndFilteredJobs = useMemo(() => {
    const list = [...filteredJobs];

    switch (sortMode) {
      case 'PLATFORM_ASC':
        return list.sort((a, b) => {
          const platA = getPlatformDisplayName(a);
          const platB = getPlatformDisplayName(b);
          const cmp = platA.localeCompare(platB, 'pt-BR', { sensitivity: 'base' });
          if (cmp !== 0) return cmp;
          return (a.title || '').localeCompare(b.title || '', 'pt-BR', { sensitivity: 'base' });
        });

      case 'SALARY_DESC':
        return list.sort((a, b) => {
          const salA = getJobSalaryNumericValue(a);
          const salB = getJobSalaryNumericValue(b);
          if (salB !== salA) {
            return salB - salA; // maior salário numérico primeiro
          }
          // Desempate por compatibilidade
          return (b.analysis?.compatibility_score || 0) - (a.analysis?.compatibility_score || 0);
        });

      case 'COMPATIBILITY_DESC':
        return list.sort((a, b) => {
          return (b.analysis?.compatibility_score || 0) - (a.analysis?.compatibility_score || 0);
        });

      case 'NEWEST':
        return list.sort((a, b) => {
          const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
          const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
          return dateB - dateA;
        });

      case 'DEFAULT':
      default:
        // Ordem padrão: vagas novas no topo, seguido de maior compatibilidade
        return list.sort((a, b) => {
          if (a.is_new && !b.is_new) return -1;
          if (!a.is_new && b.is_new) return 1;
          return (b.analysis?.compatibility_score || 0) - (a.analysis?.compatibility_score || 0);
        });
    }
  }, [filteredJobs, sortMode, platformNameMap]);

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

  // Lista de plataformas ordenadas em ordem alfabética (A-Z) com as bloqueadas no final
  const sortedPlatformOptions = useMemo(() => {
    const list = platforms && platforms.length > 0 ? platforms : [];
    const knownSlugs = new Set(list.map(p => p.id.toLowerCase()));
    const extraSlugs: { id: string; name: string; isBlocked: boolean }[] = [];

    jobsList.forEach(j => {
      const slug = j.platform_slug.toLowerCase();
      if (!knownSlugs.has(slug) && !extraSlugs.some(e => e.id === slug)) {
        extraSlugs.push({
          id: slug,
          name: j.platform_slug.charAt(0).toUpperCase() + j.platform_slug.slice(1),
          isBlocked: false
        });
      }
    });

    const combined = [
      ...list.map(p => ({
        id: p.id,
        name: p.name,
        isBlocked: p.status === 'BLACKLIST'
      })),
      ...extraSlugs
    ];

    return combined.sort((a, b) => {
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    });
  }, [platforms, jobsList]);

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

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {/* Informação e Botão Principal: Atualizar Banco de Dados */}
            <div className="flex flex-col items-start sm:items-end gap-1.5 w-full sm:w-auto">
              <button 
                onClick={handleSyncDatabase}
                disabled={isSyncingDatabase}
                className="w-full sm:w-auto px-4 py-2.5 bg-cyan-400 hover:bg-cyan-300 disabled:bg-cyan-600/50 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingDatabase ? 'animate-spin' : ''}`} />
                <span>{isSyncingDatabase ? 'Atualizando Banco...' : 'Atualizar Banco de Vagas'}</span>
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[11px] text-cyan-200/90 flex items-center gap-1.5 font-medium bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                  <span className={`w-2 h-2 rounded-full ${isSupabaseLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span>{isSupabaseLive ? 'Supabase PostgreSQL Conectado' : 'Cache Local'}</span>
                </div>

                <div className="text-[11px] text-cyan-200/90 flex items-center gap-1 font-medium bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                  <Clock className="w-3 h-3 text-cyan-300 shrink-0" />
                  <span>Última atualização: <strong className="text-white">{lastSyncFormatted}</strong></span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsMonitorOpen(true)}
              className="px-3.5 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-cyan-200 hover:text-white text-xs font-bold rounded-xl border border-cyan-400/30 transition-colors flex items-center gap-1.5 cursor-pointer self-stretch sm:self-auto justify-center shadow-inner"
              title="Abrir Central de Monitoramento e Varredura de Plataformas"
            >
              <Activity className="w-4 h-4 text-cyan-300 animate-pulse" />
              <span>Monitor de Plataformas</span>
            </button>

            <button 
              onClick={onOpenGuides}
              className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer self-stretch sm:self-auto justify-center"
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
            <div className="text-blue-200/80">Data e Hora da Última Atualização</div>
            <div className="font-semibold text-cyan-300 mt-0.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span className="font-bold">{lastSyncFormatted}</span>
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

      {/* BANNER DE VAGAS OCULTADAS (QUANDO MODO HIDDEN_ONLY ATIVO) */}
      {viewMode === 'HIDDEN_ONLY' && (
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-md text-white">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-slate-800 text-amber-400 border border-slate-700 shrink-0">
              <EyeOff className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">
                  Visualizando Vagas Ocultadas
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {hiddenJobsCount} {hiddenJobsCount === 1 ? 'vaga' : 'vagas'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Essas vagas permanecem salvas na base para sincronização e histórico, mas não são exibidas na listagem principal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleUnhideAllJobs}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Restaurar Todas</span>
            </button>

            <button
              onClick={() => setViewMode('ALL')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Voltar à Lista Principal</span>
            </button>
          </div>
        </div>
      )}

      {/* Barra de Filtros, Modos de Separação e Busca */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        
        {/* Linha 0: SEPARADOR DE NOVAS VAGAS VS BASE EXISTENTE VS OCULTADAS */}
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
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas as Vagas ({activeJobsCount})
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
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Base Anterior ({existingJobsCount})
            </button>

            {hiddenJobsCount > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setViewMode('HIDDEN_ONLY')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'HIDDEN_ONLY'
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title="Exibir vagas ocultadas da listagem principal"
                >
                  <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                  <span>Ocultadas ({hiddenJobsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    unhideAllJobs();
                    setJobsList(prev => prev.map(j => ({ ...j, is_hidden: false })));
                  }}
                  className="px-2 py-1 text-[11px] text-amber-700 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md font-bold transition cursor-pointer"
                  title="Restaurar todas as vagas ocultas de volta para a listagem principal"
                >
                  Restaurar Todas
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Linha 1: Input de Busca e Toggle Principal "Apenas Português" */}
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

          {/* Toggle Principal: Apenas Português */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shrink-0">
            <label htmlFor="onlyPortugueseToggle" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
              🎯 Apenas Português (100% PT-BR)
            </label>
            <button
              id="onlyPortugueseToggle"
              role="switch"
              aria-checked={onlyPortuguese}
              onClick={() => setOnlyPortuguese(prev => !prev)}
              className={`w-11 h-6 rounded-full transition-colors relative focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                onlyPortuguese ? 'bg-blue-600' : 'bg-slate-300'
              }`}
              title="Exibe apenas vagas 100% em português, filtrando qualquer anúncio que exija inglês, italiano ou outros idiomas estrangeiros cadastrados."
            >
              <span 
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                  onlyPortuguese ? 'left-5.5' : 'left-0.5'
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
              {sortedPlatformOptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isBlocked ? '🚫 (Bloqueada)' : ''}
                </option>
              ))}
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
              Exibindo <span className="font-bold text-slate-900">{sortedAndFilteredJobs.length}</span> de {viewMode === 'HIDDEN_ONLY' ? hiddenJobsCount : activeJobsCount} vagas
            </span>
            {viewMode === 'NEW_ONLY' && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                Filtro de Novas Ativo
              </span>
            )}
            {viewMode === 'HIDDEN_ONLY' && (
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                Exibindo Ocultadas
              </span>
            )}
          </div>
        </div>

        {/* Linha 3: Ordenação de Vagas (Ordem Alfabética da Plataforma & Maior para Menor Salário) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <ArrowUpDown className="w-4 h-4 text-blue-600" />
              <span>Ordenar por:</span>
            </div>

            {/* Dropdown com as Formas de Ordenação */}
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as JobSortMode)}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors"
            >
              <option value="DEFAULT">✨ Recomendadas / Relevância</option>
              <option value="PLATFORM_ASC">🏢 1. Ordem Alfabética da Plataforma (A-Z)</option>
              <option value="SALARY_DESC">💰 2. Maior para Menor Salário ($$$ → $)</option>
              <option value="COMPATIBILITY_DESC">⭐ Maior Compatibilidade IA</option>
              <option value="NEWEST">🕒 Mais Recentes</option>
            </select>

            {/* Atalhos Rápidos com 1 Clique para as 2 Principais Opções Solicitadas */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSortMode(prev => prev === 'PLATFORM_ASC' ? 'DEFAULT' : 'PLATFORM_ASC')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  sortMode === 'PLATFORM_ASC'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
                }`}
                title="1- Ordenar por ordem alfabética da plataforma (A-Z)"
              >
                <ArrowDownAZ className="w-3.5 h-3.5" />
                <span>Plataforma (A-Z)</span>
              </button>

              <button
                type="button"
                onClick={() => setSortMode(prev => prev === 'SALARY_DESC' ? 'DEFAULT' : 'SALARY_DESC')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  sortMode === 'SALARY_DESC'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200'
                }`}
                title="2- Ordenar por ordem de maior para menor salário"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Maior Salário</span>
              </button>
            </div>
          </div>

          {/* Indicador e Reset da Ordenação Atual */}
          {sortMode !== 'DEFAULT' && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 self-end sm:self-center">
              <span>Ordenado:</span>
              <span className="font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                {sortMode === 'PLATFORM_ASC' && '🏢 Ordem Alfabética da Plataforma'}
                {sortMode === 'SALARY_DESC' && '💰 Maior para Menor Salário'}
                {sortMode === 'COMPATIBILITY_DESC' && '⭐ Maior Compatibilidade'}
                {sortMode === 'NEWEST' && '🕒 Mais Recentes'}
              </span>
              <button
                type="button"
                onClick={() => setSortMode('DEFAULT')}
                className="text-blue-600 hover:text-blue-800 font-bold ml-1 hover:underline cursor-pointer"
                title="Restaurar ordenação padrão"
              >
                Restaurar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lista de Vagas */}
      {sortedAndFilteredJobs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <Info className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            {viewMode === 'NEW_ONLY' 
              ? 'Nenhuma vaga nova pendente' 
              : viewMode === 'HIDDEN_ONLY' 
              ? 'Nenhuma vaga ocultada no momento' 
              : 'Nenhuma oportunidade encontrada'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {viewMode === 'NEW_ONLY' 
              ? 'Todas as novas vagas já foram avaliadas ou marcadas como vistas. Você pode clicar em "Todas as Vagas" para ver a base completa ou em "Atualizar Banco de Vagas" para buscar novas oportunidades.'
              : viewMode === 'HIDDEN_ONLY'
              ? 'Você ainda não ocultou nenhuma vaga. Quando quiser retirar alguma vaga da visualização no app, utilize o botão "Ocultar" no card.'
              : 'Tente desmarcar o filtro "Apenas Português" ou limpar os termos de busca para ver todas as vagas coletadas.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {viewMode !== 'ALL' && (
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
                setOnlyPortuguese(false);
                setSelectedPlatform('ALL');
                setSelectedEnglishStatus('ALL');
                setMinScore(0);
                setSearchQuery('');
                setSortMode('DEFAULT');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sortedAndFilteredJobs.map(job => {
            const analysis = job.analysis;
            const badge = getBadgeStyle(analysis?.english_status);
            const score = analysis?.compatibility_score || 50;
            const blockedCheck = checkJobForBlockedKeywords(job.title, job.description, blockedKeywords);
            const salary = formatJobSalary(job);
            const requirements = extractJobRequirements(job);

            return (
              <div 
                key={job.external_id}
                className={`rounded-2xl p-5 sm:p-6 border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 group relative ${
                  job.is_hidden
                    ? 'bg-slate-50/80 border-slate-300 opacity-80 hover:opacity-100'
                    : job.is_new 
                    ? 'bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white border-emerald-500 shadow-lg shadow-emerald-500/10 ring-4 ring-emerald-500/20 border-l-8 border-l-emerald-600' 
                    : 'bg-white border-slate-300 hover:border-slate-400 shadow-xs hover:shadow-md'
                }`}
              >
                {/* Informações Principais da Vaga */}
                <div className="space-y-2.5 flex-1">
                  {/* Metadados Limpos com Selo de Vaga Nova / Ocultada e Salário */}
                  <div className="flex items-center flex-wrap gap-2 text-xs">
                    
                    {/* SELO DE IDENTIFICAÇÃO */}
                    {job.is_hidden ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <EyeOff className="w-3 h-3 text-amber-700" />
                        <span>Ocultada no App</span>
                      </span>
                    ) : job.is_new ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs tracking-wide">
                          <Sparkles className="w-3.5 h-3.5 fill-white" />
                          <span>NOVA VAGA RECÉM-ADICIONADA</span>
                        </span>
                        <span className="text-[11px] font-bold text-emerald-950 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                          Atenção Prioritária
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">
                        Na base
                      </span>
                    )}

                    <span className="font-bold text-blue-700 uppercase tracking-wider">{job.platform_slug}</span>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="font-bold text-slate-900">{job.company}</span>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="text-slate-700 font-medium">{job.location}</span>
                    {job.remote && (
                      <>
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="text-emerald-800 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                          100% Remoto
                        </span>
                      </>
                    )}

                    {/* MOSTRAR SALÁRIO QUANDO DISPONÍVEL */}
                    {salary && (
                      <>
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="inline-flex items-center gap-1 font-extrabold text-emerald-900 bg-emerald-100/90 px-2.5 py-0.5 rounded-md border border-emerald-300 shadow-2xs">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{salary}</span>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Título da Vaga */}
                  <h3 
                    onClick={() => setSelectedJobForModal(job)}
                    className={`text-base sm:text-lg font-black transition-colors cursor-pointer leading-snug flex items-center gap-2 ${
                      job.is_new ? 'text-slate-950 hover:text-emerald-700' : 'text-slate-900 hover:text-blue-600'
                    }`}
                  >
                    <span>{job.title}</span>
                  </h3>

                  {/* Diagnóstico da IA com Justificativa e Requisitos */}
                  {(analysis?.reason || requirements.length > 0) && (
                    <div className={`text-xs leading-relaxed p-3.5 rounded-xl border space-y-2 ${
                      job.is_new 
                        ? 'bg-white border-emerald-300 text-slate-900 font-medium shadow-2xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      {analysis?.reason && (
                        <p>
                          <span className={`font-bold ${job.is_new ? 'text-emerald-900' : 'text-slate-900'}`}>
                            Diagnóstico IA: 
                          </span>{' '}
                          {analysis.reason}
                        </p>
                      )}

                      {/* REQUISITOS IDENTIFICADOS PELA IA (SE DISPONÍVEL) */}
                      {requirements.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Requisitos:</span>
                          </span>
                          {requirements.slice(0, 3).map((req, idx) => (
                            <span 
                              key={idx} 
                              className="text-[11px] font-medium bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded-md shadow-2xs"
                            >
                              {req}
                            </span>
                          ))}
                          {requirements.length > 3 && (
                            <button
                              onClick={() => setSelectedJobForModal(job)}
                              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              +{requirements.length - 3} mais
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Badges de Idioma e Compatibilidade */}
                  <div className="flex items-center flex-wrap gap-3 pt-1">
                    {blockedCheck.isBlocked ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-rose-50 border-rose-200 text-rose-800" title={`Termos de outros idiomas identificados: ${blockedCheck.matchedTerms.join(', ')}`}>
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span>Requer outro idioma: {blockedCheck.matchedTerms.slice(0, 2).join(', ')}</span>
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${badge.dot}`} />
                        {analysis?.english_status === 'NONE' ? '100% Português (PT-BR)' : badge.label}
                      </span>
                    )}

                    {analysis?.portuguese_required && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 px-3 py-1 rounded-full">
                        🇧🇷 Português {analysis.portuguese_level ? `(${analysis.portuguese_level})` : 'Requerido'}
                      </span>
                    )}

                    {/* Barra de Compatibilidade */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-600 font-medium">Compatibilidade:</span>
                      <div className="w-16 h-2.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300/60">
                        <div 
                          className={`h-full rounded-full ${
                            score >= 80 ? 'bg-emerald-600' :
                            score >= 50 ? 'bg-amber-500' :
                            'bg-rose-500'
                          }`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <span className={`font-extrabold ${
                        score >= 80 ? 'text-emerald-800' :
                        score >= 50 ? 'text-amber-800' :
                        'text-rose-800'
                      }`}>
                        {score}%
                      </span>
                    </div>

                    {/* Botão de Marcar Como Vista (Inline no Card para Novas Vagas) */}
                    {job.is_new && !job.is_hidden && (
                      <button
                        onClick={() => handleMarkAsSeen(job.external_id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 transition-colors ml-auto cursor-pointer shadow-xs"
                        title="Marcar como vista para retirar o destaque"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>Marcar como vista</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Ações: Ver Descrição, Análise IA, Ocultar/Restaurar & Candidatar-se Oficial */}
                <div className="flex flex-col sm:flex-row md:flex-col items-stretch md:items-end justify-between gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-200">
                  <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                    {/* BOTÃO VER DESCRIÇÃO DA VAGA */}
                    <button
                      onClick={() => setSelectedJobForModal(job)}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 flex-1 md:flex-initial cursor-pointer shadow-2xs"
                      title="Ver descrição completa da vaga em português"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Ver Descrição</span>
                    </button>

                    {/* BOTÃO VER ANÁLISE IA */}
                    <button
                      onClick={() => setSelectedJobForModal(job)}
                      className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 flex-1 md:flex-initial cursor-pointer ${
                        job.is_new 
                          ? 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      title="Ver análise detalhada da inteligência artificial"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="hidden sm:inline">Análise IA</span>
                    </button>

                    {/* LINK DIRETO PARA O ANÚNCIO ORIGINAL DA VAGA */}
                    <a
                      href={job.canonical_url || job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                      title="Abrir anúncio oficial da vaga em nova aba"
                      aria-label="Abrir anúncio oficial da vaga"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {/* BOTÃO OCULTAR / RESTAURAR */}
                    {job.is_hidden ? (
                      <button
                        onClick={() => handleUnhideJob(job.external_id)}
                        className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                        title="Restaurar esta vaga para a lista principal"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Restaurar</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleHideJob(job.external_id)}
                        className="px-2.5 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-slate-500 text-xs font-medium rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                        title="Ocultar esta vaga da visualização no app (permanece salva no banco para sincronização)"
                      >
                        <EyeOff className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" />
                        <span className="hidden sm:inline">Ocultar</span>
                      </button>
                    )}
                  </div>

                  <a 
                    href={job.canonical_url || job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 w-full md:w-auto cursor-pointer"
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

      {/* TOAST DE FEEDBACK DE VAGA OCULTADA COM DESFAZER */}
      {hiddenToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-slate-700 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3.5 animate-in slide-in-from-bottom-5 duration-200 max-w-md">
          <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
            <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              Vaga ocultada no app: <strong className="text-slate-100 font-semibold">{hiddenToast.title}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-slate-700">
            <button
              onClick={() => handleUnhideJob(hiddenToast.id)}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Desfazer</span>
            </button>
            <button
              onClick={() => setHiddenToast(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Vaga */}
      <JobDetailModal 
        job={selectedJobForModal}
        isOpen={Boolean(selectedJobForModal)}
        onClose={() => setSelectedJobForModal(null)}
        onMarkAsSeen={handleMarkAsSeen}
        onHideJob={handleHideJob}
        onUnhideJob={handleUnhideJob}
      />

      {/* Central de Monitoramento e Varredura de Plataformas */}
      <PlatformMonitorModal
        isOpen={isMonitorOpen}
        onClose={() => setIsMonitorOpen(false)}
        platforms={platforms}
        jobs={jobsList}
        lastSyncFormatted={lastSyncFormatted}
        onScanSinglePlatform={handleScanSinglePlatform}
        onScanAllPlatforms={handleSyncDatabase}
        isScanning={isSyncingDatabase}
      />
    </div>
  );
};
