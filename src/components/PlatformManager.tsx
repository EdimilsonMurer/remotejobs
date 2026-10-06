import React, { useState } from 'react';
import { 
  Globe, 
  Star, 
  ShieldAlert, 
  ExternalLink, 
  Edit, 
  Trash2, 
  Search, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  FileCheck,
  CreditCard,
  Ban,
  Filter,
  DollarSign,
  Layers,
  Sparkles,
  CheckSquare,
  HelpCircle
} from 'lucide-react';
import { Platform, PlatformStatus, CurrencyType, UserAccountStatus } from '../types/job';

interface PlatformManagerProps {
  platforms: Platform[];
  onUpdatePlatform: (platform: Platform) => void;
  onDeletePlatform: (id: string) => void;
  onOpenAddModal: (initialUrl?: string) => void;
  onOpenEditModal: (platform: Platform) => void;
}

// Componente para edição direta e instantânea das observações da plataforma
const InlinePlatformNotes: React.FC<{
  platform: Platform;
  onSave: (notes: string) => void;
}> = ({ platform, onSave }) => {
  const [text, setText] = useState(platform.notes || '');
  const [isSaved, setIsSaved] = useState(false);

  // Sincroniza se a plataforma for atualizada externamente
  React.useEffect(() => {
    setText(platform.notes || '');
  }, [platform.notes]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
  };

  const handleBlur = () => {
    if (text !== platform.notes) {
      onSave(text);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  return (
    <div className="mt-2 mb-3 bg-slate-950/80 border border-slate-800 focus-within:border-emerald-500/80 rounded-lg p-2.5 transition-all">
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <label className="font-semibold text-slate-400 flex items-center gap-1">
          <Edit className="w-3 h-3 text-emerald-400" />
          <span>Observações & Anotações:</span>
        </label>
        {isSaved ? (
          <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 animate-in fade-in">
            <CheckCircle2 className="w-3 h-3" />
            Salvo
          </span>
        ) : (
          <span className="text-[10px] text-slate-500">Edite diretamente</span>
        )}
      </div>

      <textarea
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={3}
        placeholder="Adicione observações, links de guidelines, dicas da prova ou anotações pessoais desta plataforma..."
        className="w-full bg-slate-900/90 text-xs text-slate-200 placeholder:text-slate-600 rounded-md p-2 border border-slate-800/80 focus:outline-hidden focus:border-emerald-500/80 transition-colors resize-y leading-relaxed font-sans"
      />
    </div>
  );
};

export const PlatformManager: React.FC<PlatformManagerProps> = ({
  platforms,
  onUpdatePlatform,
  onDeletePlatform,
  onOpenAddModal,
  onOpenEditModal
}) => {
  const [filterTab, setFilterTab] = useState<'ALL' | 'FAVORITE' | 'ACTIVE' | 'BLACKLIST'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserAccountStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | CurrencyType>('ALL');
  const [quickUrl, setQuickUrl] = useState('');

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickUrl.trim()) {
      onOpenAddModal(quickUrl.trim());
      setQuickUrl('');
    } else {
      onOpenAddModal();
    }
  };

  const filteredPlatforms = platforms.filter(p => {
    if (filterTab === 'FAVORITE' && p.status !== 'FAVORITE') return false;
    if (filterTab === 'ACTIVE' && p.status !== 'ACTIVE' && p.status !== 'FAVORITE') return false;
    if (filterTab === 'BLACKLIST' && p.status !== 'BLACKLIST') return false;

    if (statusFilter !== 'ALL' && p.userStatus !== statusFilter) return false;
    if (currencyFilter !== 'ALL' && p.currency !== currencyFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchCat = p.category.toLowerCase().includes(q);
      const matchNotes = p.notes.toLowerCase().includes(q);
      const matchReason = p.blacklistReason?.toLowerCase().includes(q) || false;
      return matchName || matchCat || matchNotes || matchReason;
    }

    return true;
  });

  // Ordenação Alfabética (A-Z), mantendo as plataformas bloqueadas (BLACKLIST) sempre no final
  const sortedPlatforms = React.useMemo(() => {
    return [...filteredPlatforms].sort((a, b) => {
      const aBlocked = a.status === 'BLACKLIST';
      const bBlocked = b.status === 'BLACKLIST';

      // Bloqueadas vão para o final
      if (!aBlocked && bBlocked) return -1;
      if (aBlocked && !bBlocked) return 1;

      // Ordem alfabética de A a Z
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    });
  }, [filteredPlatforms]);

  const favoritesCount = platforms.filter(p => p.status === 'FAVORITE').length;
  const blacklistCount = platforms.filter(p => p.status === 'BLACKLIST').length;
  const activePlatforms = platforms.filter(p => p.status !== 'BLACKLIST');

  const accountStats = {
    APPROVED_ACTIVE: activePlatforms.filter(p => p.userStatus === 'APPROVED_ACTIVE').length,
    EXAM_PENDING: activePlatforms.filter(p => p.userStatus === 'EXAM_PENDING').length,
    REGISTERED: activePlatforms.filter(p => p.userStatus === 'REGISTERED').length,
    UNDER_REVIEW: activePlatforms.filter(p => p.userStatus === 'UNDER_REVIEW').length,
    NOT_REGISTERED: activePlatforms.filter(p => p.userStatus === 'NOT_REGISTERED').length,
  };

  const handleToggleStatus = (platform: Platform, newStatus: PlatformStatus) => {
    onUpdatePlatform({
      ...platform,
      status: newStatus,
      blacklistReason: newStatus === 'BLACKLIST' 
        ? (platform.blacklistReason || 'Bloqueada manualmente pelo usuário') 
        : undefined
    });
  };

  const handleAccountStatusChange = (platform: Platform, newAccountStatus: UserAccountStatus) => {
    onUpdatePlatform({
      ...platform,
      userStatus: newAccountStatus,
      updatedAt: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Account Progression Stats Banner */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Central Unificada</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Plataformas & Minhas Inscrições
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Acompanhe suas contas, links de cadastro, status dos exames e gerencie quais plataformas monitorar ou bloquear.
          </p>
        </div>

        {/* Combined Account Pipeline Stats */}
        <div className="flex items-center gap-2 sm:gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800 shrink-0 overflow-x-auto">
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Ativas</span>
            <span className="text-sm font-bold font-mono text-emerald-400 tabular-nums">
              {accountStats.APPROVED_ACTIVE}
            </span>
          </div>
          <div className="w-[1px] h-6 bg-slate-800" />
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Em Exame</span>
            <span className="text-sm font-bold font-mono text-amber-400 tabular-nums">
              {accountStats.EXAM_PENDING}
            </span>
          </div>
          <div className="w-[1px] h-6 bg-slate-800" />
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Em Análise</span>
            <span className="text-sm font-bold font-mono text-blue-400 tabular-nums">
              {accountStats.UNDER_REVIEW}
            </span>
          </div>
          <div className="w-[1px] h-6 bg-slate-800" />
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Cadastrado</span>
            <span className="text-sm font-bold font-mono text-purple-400 tabular-nums">
              {accountStats.REGISTERED}
            </span>
          </div>
          <div className="w-[1px] h-6 bg-slate-800" />
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">A Iniciar</span>
            <span className="text-sm font-bold font-mono text-slate-300 tabular-nums">
              {accountStats.NOT_REGISTERED}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Auto-Register by URL Banner */}
      <form onSubmit={handleQuickSubmit} className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 p-3.5 sm:p-4 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>Cadastrar Nova Plataforma com Preenchimento Automático</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Cole apenas a URL e a IA preencherá automaticamente todos os dados (nome, moeda, inglês e testes).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          <input
            type="url"
            value={quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
            placeholder="Cole a URL: ex: https://mindrift.ai..."
            className="flex-1 bg-slate-950 border border-emerald-500/40 focus:border-emerald-400 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
            <span>Preencher</span>
          </button>
        </div>
      </form>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-3">
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Tab Filters */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                filterTab === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Todas ({platforms.length})</span>
            </button>

            <button
              onClick={() => setFilterTab('FAVORITE')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                filterTab === 'FAVORITE'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shadow-sm'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
              <span>Favoritas ({favoritesCount})</span>
            </button>

            <button
              onClick={() => setFilterTab('BLACKLIST')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                filterTab === 'BLACKLIST'
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80 shadow-sm'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Lista Negra ({blacklistCount})</span>
            </button>
          </div>

          {/* Search, Status & Currency dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar plataforma..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-400"
            >
              <option value="ALL">Todos os Status</option>
              <option value="NOT_REGISTERED">⚪ Ainda não tenho conta</option>
              <option value="REGISTERED">🟣 Cadastro realizado</option>
              <option value="EXAM_PENDING">🟡 Prova de qualificação pendente</option>
              <option value="UNDER_REVIEW">🔵 Perfil em análise</option>
              <option value="APPROVED_ACTIVE">🟢 Aprovado & Ativo em projetos</option>
              <option value="INACTIVE">⚫ Inativo / Pausado</option>
            </select>

            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-400"
            >
              <option value="ALL">Todas Moedas</option>
              <option value="USD">Dólar ($ USD)</option>
              <option value="EUR">Euro (€ EUR)</option>
              <option value="GBP">Libra (£ GBP)</option>
              <option value="BRL">Real (R$ BRL)</option>
            </select>

            <button
              onClick={() => onOpenAddModal()}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova</span>
            </button>
          </div>

        </div>

      </div>

      {/* Platforms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedPlatforms.map((platform) => {
          const isBlacklisted = platform.status === 'BLACKLIST';
          const isFavorite = platform.status === 'FAVORITE';

          return (
            <div
              key={platform.id}
              className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
                isBlacklisted
                  ? 'bg-rose-950/20 border-rose-900/50 hover:border-rose-700/60'
                  : isFavorite
                  ? 'bg-slate-900/95 border-slate-700/90 hover:border-emerald-500/50 shadow-sm'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                
                {/* Card Top: Title, Currency & Status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white tracking-tight">
                        {platform.name}
                      </h3>
                      {isFavorite && (
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {platform.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                      platform.currency === 'USD' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      platform.currency === 'EUR' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                      platform.currency === 'GBP' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                      'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {platform.currency}
                    </span>
                  </div>
                </div>

                {/* Blacklist Warning */}
                {isBlacklisted && (
                  <div className="mb-3 p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-lg">
                    <div className="flex items-center gap-1.5 text-rose-300 font-semibold text-xs mb-1">
                      <Ban className="w-3.5 h-3.5" />
                      <span>Bloqueada na Lista Negra</span>
                    </div>
                    <p className="text-[11px] text-rose-200/90 leading-relaxed">
                      {platform.blacklistReason || 'Esta plataforma foi descartada das buscas de vagas.'}
                    </p>
                  </div>
                )}

                {/* Inline My Account Status Control */}
                {!isBlacklisted && (
                  <div className="mb-3 p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>Status da Minha Conta:</span>
                      <span className="text-[10px] font-mono text-slate-500">Clique p/ mudar</span>
                    </label>
                    <select
                      value={platform.userStatus}
                      onChange={(e) => handleAccountStatusChange(platform, e.target.value as UserAccountStatus)}
                      className={`w-full border rounded-md px-2 py-1 text-xs font-semibold focus:outline-none transition-colors cursor-pointer ${
                        platform.userStatus === 'APPROVED_ACTIVE'
                          ? 'bg-emerald-950/90 border-emerald-700 text-emerald-300'
                          : platform.userStatus === 'EXAM_PENDING'
                          ? 'bg-amber-950/90 border-amber-700 text-amber-300'
                          : platform.userStatus === 'UNDER_REVIEW'
                          ? 'bg-blue-950/90 border-blue-700 text-blue-300'
                          : platform.userStatus === 'REGISTERED'
                          ? 'bg-purple-950/90 border-purple-700 text-purple-300'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
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
                )}

                {/* Metadata List */}
                <div className="space-y-1.5 mb-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Processo:</span>
                    <span>
                      {platform.processType === 'NO_INTERVIEW' && 'Sem entrevista (Início rápido)'}
                      {platform.processType === 'ONLINE_EXAM' && 'Teste prático / Guidelines online'}
                      {platform.processType === 'AI_TEST' && 'Teste assíncrono gravado / IA'}
                      {platform.processType === 'LIVE_INTERVIEW' && 'Entrevista com recrutador ao vivo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Inglês:</span>
                    <span className={platform.englishRequirement === 'FLUENT_INTERVIEW' ? 'text-rose-400 font-medium' : 'text-emerald-400'}>
                      {platform.englishRequirement === 'NONE' && 'Nenhum (100% Português)'}
                      {platform.englishRequirement === 'READING_ONLY' && 'Apenas Leitura / Instruções'}
                      {platform.englishRequirement === 'BASIC' && 'Básico'}
                      {platform.englishRequirement === 'INTERMEDIATE' && 'Intermediário'}
                      {platform.englishRequirement === 'FLUENT_INTERVIEW' && 'Exige Entrevista em Inglês'}
                    </span>
                  </div>

                  {platform.averagePayRate && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-medium">Remuneração:</span>
                      <span className="font-mono text-emerald-400 font-medium">{platform.averagePayRate}</span>
                    </div>
                  )}

                  {platform.paymentMethods && platform.paymentMethods.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-medium">Pagamento:</span>
                      <span className="text-slate-300 text-[11px]">{platform.paymentMethods.join(' · ')}</span>
                    </div>
                  )}
                </div>

                {/* Interactive Inline Notes */}
                <InlinePlatformNotes 
                  platform={platform}
                  onSave={(newNotes) => {
                    onUpdatePlatform({
                      ...platform,
                      notes: newNotes,
                      updatedAt: new Date().toISOString().split('T')[0]
                    });
                  }}
                />

              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                
                {/* Links */}
                <div className="flex items-center gap-1.5">
                  <a
                    href={platform.careersUrl || platform.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <span>Acessar Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={() => onOpenEditModal(platform)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    title="Editar informações"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Status Toggles */}
                <div className="flex items-center gap-1">
                  {isBlacklisted ? (
                    <button
                      onClick={() => handleToggleStatus(platform, 'ACTIVE')}
                      className="px-2 py-1 bg-slate-800 hover:bg-emerald-950 text-slate-300 hover:text-emerald-300 border border-slate-700 rounded text-[11px] transition-colors"
                    >
                      Desbloquear
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleToggleStatus(platform, isFavorite ? 'ACTIVE' : 'FAVORITE')}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isFavorite 
                            ? 'bg-amber-950/60 border-amber-800/80 text-amber-300' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-400'
                        }`}
                        title={isFavorite ? 'Remover dos favoritos' : 'Marcar como favorita'}
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(platform, 'BLACKLIST')}
                        className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 hover:border-rose-800 transition-colors"
                        title="Enviar para a Lista Negra (Bloquear)"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>

              </div>

            </div>
          );
        })}
      </div>

      {filteredPlatforms.length === 0 && (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-900/30 p-8">
          <Globe className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-300 font-medium">Nenhuma plataforma encontrada com os filtros selecionados.</p>
          <p className="text-xs text-slate-500 mt-1">Experimente limpar a busca ou cadastre uma nova plataforma.</p>
        </div>
      )}

    </div>
  );
};
