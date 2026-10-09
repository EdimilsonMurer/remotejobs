import React, { useState, useEffect, useRef } from 'react';
import { 
  Clipboard, 
  Check, 
  Save, 
  Database, 
  Download, 
  Upload, 
  Sparkles, 
  User, 
  Link as LinkIcon, 
  DollarSign, 
  FileText, 
  BookOpen, 
  Plus, 
  Trash2, 
  Search, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  X,
  RefreshCw,
  Copy
} from 'lucide-react';
import { 
  CandidateProfileData, 
  DEFAULT_CANDIDATE_PROFILE, 
  loadCandidateNotes, 
  saveCandidateNotesToSupabase,
  CustomSnippet 
} from '../lib/supabase/candidateNotes';
import { isSupabaseConfigured } from '../lib/supabase/client';

interface CandidateNotepadProps {
  isDrawer?: boolean;
  onClose?: () => void;
}

export const CandidateNotepad: React.FC<CandidateNotepadProps> = ({ isDrawer = false, onClose }) => {
  const [profile, setProfile] = useState<CandidateProfileData>(DEFAULT_CANDIDATE_PROFILE);
  const [activeSubTab, setActiveSubTab] = useState<'contact' | 'links' | 'rates' | 'templates' | 'snippets' | 'free_notes'>('contact');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'saved' | 'saving' | 'error'; message: string; source: 'supabase' | 'local' }>({
    type: 'saved',
    message: 'Carregando dados...',
    source: 'local'
  });
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [newSnippetTitle, setNewSnippetTitle] = useState('');
  const [newSnippetContent, setNewSnippetContent] = useState('');
  const [showAddSnippet, setShowAddSnippet] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Carrega dados iniciais do Supabase / localStorage
  useEffect(() => {
    let isMounted = true;
    loadCandidateNotes().then(({ data, source }) => {
      if (!isMounted) return;
      setProfile(data);
      const isCloud = source === 'supabase' && isSupabaseConfigured();
      setSaveStatus({
        type: 'saved',
        message: isCloud ? 'Sincronizado com Supabase ✓' : 'Armazenado Localmente (Offline)',
        source: isCloud ? 'supabase' : 'local'
      });
      if (data.updated_at) {
        try {
          const d = new Date(data.updated_at);
          setLastSavedTime(d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        } catch {}
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Autosave com debounce (800ms) quando o usuário digita
  const triggerAutoSave = (updatedProfile: CandidateProfileData) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSaveStatus(prev => ({ ...prev, type: 'saving', message: 'Gravando alterações...' }));

    debounceTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      const res = await saveCandidateNotesToSupabase(updatedProfile);
      setIsSaving(false);
      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setLastSavedTime(timeStr);

      if (res.success) {
        const isCloud = isSupabaseConfigured();
        setSaveStatus({
          type: 'saved',
          message: isCloud ? `Gravado no Supabase às ${timeStr} ✓` : `Salvo localmente às ${timeStr}`,
          source: isCloud ? 'supabase' : 'local'
        });
      } else {
        setSaveStatus({
          type: 'error',
          message: res.error || 'Erro ao sincronizar com Supabase',
          source: 'local'
        });
      }
    }, 800);
  };

  const handleFieldChange = (field: keyof CandidateProfileData, value: any) => {
    const updated = { ...profile, [field]: value };
    setProfile(updated);
    triggerAutoSave(updated);
  };

  const handleManualSave = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setIsSaving(true);
    setSaveStatus({ type: 'saving', message: 'Gravando no Supabase...', source: 'supabase' });
    const res = await saveCandidateNotesToSupabase(profile);
    setIsSaving(false);
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setLastSavedTime(timeStr);

    if (res.success) {
      const isCloud = isSupabaseConfigured();
      setSaveStatus({
        type: 'saved',
        message: isCloud ? `Salvo no Supabase com sucesso às ${timeStr} ✓` : `Salvo localmente com sucesso`,
        source: isCloud ? 'supabase' : 'local'
      });
    } else {
      setSaveStatus({
        type: 'error',
        message: res.error || 'Erro ao salvar no banco',
        source: 'local'
      });
    }
  };

  const copyToClipboard = async (text: string, identifier: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(identifier);
      setTimeout(() => {
        setCopiedKey(prev => (prev === identifier ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  // Snippets personalizados
  const handleAddSnippet = () => {
    if (!newSnippetTitle.trim()) return;
    const newSnippet: CustomSnippet = {
      id: `snippet-${Date.now()}`,
      title: newSnippetTitle.trim(),
      content: newSnippetContent.trim()
    };
    const updated = {
      ...profile,
      custom_snippets: [...(profile.custom_snippets || []), newSnippet]
    };
    setProfile(updated);
    triggerAutoSave(updated);
    setNewSnippetTitle('');
    setNewSnippetContent('');
    setShowAddSnippet(false);
  };

  const handleDeleteSnippet = (snippetId: string) => {
    const updated = {
      ...profile,
      custom_snippets: (profile.custom_snippets || []).filter(s => s.id !== snippetId)
    };
    setProfile(updated);
    triggerAutoSave(updated);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(profile, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `remotejobs_candidato_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const merged = { ...DEFAULT_CANDIDATE_PROFILE, ...parsed };
        setProfile(merged);
        handleManualSave();
      } catch (err) {
        alert('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Renderizador de cada campo com botão de cópia
  const renderField = (
    label: string, 
    value: string, 
    fieldKey: keyof CandidateProfileData, 
    placeholder: string, 
    isMultiline: boolean = false,
    helperText?: string,
    isExternalUrl: boolean = false
  ) => {
    const isCopied = copiedKey === fieldKey;

    // Filtro de pesquisa
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchLabel = label.toLowerCase().includes(term);
      const matchVal = (value || '').toLowerCase().includes(term);
      const matchHelper = (helperText || '').toLowerCase().includes(term);
      if (!matchLabel && !matchVal && !matchHelper) {
        return null;
      }
    }

    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            {label}
            {isExternalUrl && value && (
              <a 
                href={value.startsWith('http') ? value : `https://${value}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 ml-1 inline-flex items-center"
                title="Abrir link no navegador"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </label>
          <button
            type="button"
            onClick={() => copyToClipboard(value, fieldKey)}
            disabled={!value}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
              isCopied
                ? 'bg-emerald-500 text-slate-950 font-bold scale-105'
                : value
                ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
            }`}
            title="Copiar para a área de transferência"
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>

        {helperText && (
          <p className="text-[11px] text-slate-400 leading-tight">
            {helperText}
          </p>
        )}

        {isMultiline ? (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed resize-y"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
            placeholder={placeholder}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
          />
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col bg-slate-950 text-slate-100 ${isDrawer ? 'h-full border-l border-slate-800' : 'min-h-[85vh] rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden'}`}>
      
      {/* Top Bar / Header */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Clipboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Bloco de Notas do Candidato
                </h1>
                <span className="text-[10px] font-mono font-bold bg-blue-950 text-blue-400 border border-blue-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Cópia Rápida 1-Clique
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralize suas informações para preencher cadastros de vagas sem precisar procurar no seu computador.
              </p>
            </div>
          </div>
        </div>

        {/* Status e Ações de Salvar / Sincronizar */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Badge de Sincronização */}
          <div className={`px-2.5 py-1 text-xs rounded-lg border flex items-center gap-1.5 font-mono ${
            saveStatus.type === 'saved'
              ? saveStatus.source === 'supabase'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                : 'bg-blue-950/80 border-blue-800 text-blue-300'
              : saveStatus.type === 'saving'
              ? 'bg-amber-950/80 border-amber-800 text-amber-300 animate-pulse'
              : 'bg-rose-950/80 border-rose-800 text-rose-300'
          }`}>
            <Database className="w-3.5 h-3.5" />
            <span className="truncate max-w-[200px]">{saveStatus.message}</span>
          </div>

          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Gravar agora todas as informações no Supabase"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSaving ? 'Gravando...' : 'Salvar no Supabase'}</span>
          </button>

          {/* Backup JSON */}
          <button
            onClick={handleExportJson}
            className="p-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors"
            title="Exportar backup em arquivo JSON"
          >
            <Download className="w-4 h-4" />
          </button>

          <label 
            className="p-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors cursor-pointer"
            title="Importar backup de arquivo JSON"
          >
            <Upload className="w-4 h-4" />
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportJson} 
              className="hidden" 
            />
          </label>

          {isDrawer && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Barra de Pesquisa Rápida */}
      <div className="px-4 sm:px-6 py-3 bg-slate-900/40 border-b border-slate-800/60 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Filtrar rapidamente qualquer campo ou texto cadastrado..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Barra de Navegação Interna de Categorias */}
      <div className="px-4 sm:px-6 pt-3 border-b border-slate-800/80 bg-slate-950 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSubTab('contact')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'contact'
              ? 'text-blue-400 border-blue-500 bg-slate-900/60'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/30'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Dados Pessoais & Contato</span>
        </button>

        <button
          onClick={() => setActiveSubTab('links')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'links'
              ? 'text-blue-400 border-blue-500 bg-slate-900/60'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/30'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span>Links & Currículo (PDF/Drive)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rates')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'rates'
              ? 'text-blue-400 border-blue-500 bg-slate-900/60'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/30'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Valores, Horas & Pagamentos</span>
        </button>

        <button
          onClick={() => setActiveSubTab('templates')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'templates'
              ? 'text-emerald-400 border-emerald-500 bg-slate-900/60'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/30'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Textos Prontos & Pitches (PT / EN)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('snippets')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'snippets'
              ? 'text-purple-400 border-purple-500 bg-slate-900/60'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/30'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-purple-400" />
          <span>Snippets Personalizados ({profile.custom_snippets?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('free_notes')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'free_notes'
              ? 'text-amber-400 border-amber-500 bg-slate-900/60'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/30'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-400" />
          <span>Bloco Livre / Rascunhos</span>
        </button>
      </div>

      {/* Conteúdo Principal do Formulário */}
      <div className="p-4 sm:p-6 overflow-y-auto flex-1 max-h-[calc(100vh-220px)] space-y-6">

        {/* 1. DADOS PESSOAIS & CONTATO */}
        {activeSubTab === 'contact' && (
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 text-xs text-blue-300 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
              <div>
                <strong>Dica de Produtividade:</strong> Formulários como Lever, Greenhouse, Workable e portais de IA sempre solicitam esses dados. Clique no botão azul <strong>"Copiar"</strong> de qualquer campo e cole direto no formulário com <code>Ctrl+V</code>.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {renderField('Nome Completo (Full Name)', profile.full_name, 'full_name', 'Ex: Carlos Silva')}
              {renderField('E-mail Principal', profile.email, 'email', 'Ex: seu.email@gmail.com')}
              {renderField('Telefone / WhatsApp (Phone with Country Code)', profile.phone, 'phone', 'Ex: +55 11 98765-4321', false, 'Inclua sempre o código internacional (+55)')}
              {renderField('Fuso Horário (Timezone)', profile.timezone, 'timezone', 'Ex: America/Sao_Paulo (UTC-3)', false, 'Garante agendamento no horário correto')}
              {renderField('Cidade (City)', profile.city, 'city', 'Ex: São Paulo / Curitiba')}
              {renderField('Estado / Região (State/Province)', profile.state, 'state', 'Ex: SP / PR / RJ')}
              {renderField('País (Country)', profile.country, 'country', 'Ex: Brasil / Brazil')}
              {renderField('CPF / ID Fiscal (Tax ID / SSN alternative)', profile.tax_id, 'tax_id', 'Ex: 123.456.789-00', false, 'Para contratos, faturamento ou verificação de identidade')}
            </div>
          </div>
        )}

        {/* 2. LINKS & CURRÍCULO */}
        {activeSubTab === 'links' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 flex items-start gap-2.5">
              <LinkIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
              <div>
                Mantenha aqui os links diretos para seu currículo (Google Drive ou Dropbox com permissão de visualização pública) e perfis profissionais.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {renderField('LinkedIn URL', profile.linkedin_url, 'linkedin_url', 'Ex: https://linkedin.com/in/seuperfil', false, 'Perfil atualizado em inglês ou português', true)}
              {renderField('GitHub / Portfólio / Website', profile.github_url, 'github_url', 'Ex: https://github.com/seuperfil', false, 'Para vagas técnicas ou portfólio', true)}
              {renderField('Link do Currículo em PDF (Google Drive / Nuvem)', profile.resume_url, 'resume_url', 'Ex: https://drive.google.com/file/d/...', false, 'Certifique-se de que o link está como "Qualquer pessoa com o link pode ver"', true)}
              {renderField('Link do Currículo em INGLÊS (English Resume)', profile.resume_en_url, 'resume_en_url', 'Ex: https://drive.google.com/file/d/...', false, 'Versão recomendada para empresas internacionais', true)}
              {renderField('Portfólio / Outros Trabalhos (Portfolio Link)', profile.portfolio_url, 'portfolio_url', 'Ex: https://meuportfolio.com', false, 'Amostras de escrita, tradução ou código', true)}
            </div>
          </div>
        )}

        {/* 3. VALORES, HORAS & PAGAMENTOS */}
        {activeSubTab === 'rates' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 flex items-start gap-2.5">
              <DollarSign className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
              <div>
                Facilite a resposta para os campos obrigatórios de pretensão salarial e contas de recebimento internacional.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {renderField('Pretensão / Taxa Horária em USD (Hourly Rate)', profile.hourly_rate_usd, 'hourly_rate_usd', 'Ex: $15.00/h ou $20.00/hour', false, 'Valor por hora pedido em formulários')}
              {renderField('Pretensão Mensal em USD (Expected Monthly Salary)', profile.monthly_salary_usd, 'monthly_salary_usd', 'Ex: $2,500.00/month', false, 'Para contratos de dedicação integral')}
              {renderField('Disponibilidade de Início (Availability / Notice Period)', profile.availability, 'availability', 'Ex: Immediate / Imediata / 2 weeks', false, 'Frequentemente perguntado em formulários internacionais')}
              {renderField('Horas por Semana (Weekly Availability)', profile.hours_per_week, 'hours_per_week', 'Ex: 20-40 hours/week / Full-time (40h)', false, 'Carga horária que você pode dedicar')}
              {renderField('E-mail da Conta PayPal', profile.payment_paypal, 'payment_paypal', 'Ex: pagamentos@gmail.com', false, 'Utilizado pela Outlier, DataAnnotation, etc.')}
              {renderField('E-mail / ID Payoneer', profile.payment_payoneer, 'payment_payoneer', 'Ex: payoneer.user@gmail.com', false, 'Utilizado por OneForma, Clickworker, RWS')}
              {renderField('Conta Deel / E-mail Deel', profile.payment_deel, 'payment_deel', 'Ex: seu.deel@gmail.com', false, 'Utilizado por Alignerr')}
              {renderField('Conta Wise (E-mail ou Chave)', profile.payment_wise, 'payment_wise', 'Ex: wise.account@gmail.com', false, 'Para transferências diretas em moeda estrangeira')}
            </div>
          </div>
        )}

        {/* 4. TEXTOS PRONTOS & PITCHES (PT / EN) */}
        {activeSubTab === 'templates' && (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-xs text-emerald-300 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
              <div>
                <strong>Textos Otimizados para Formulários Internacionais:</strong> Modelos prontos em inglês e português para perguntas frequentes como "Describe your experience", "Cover letter" e "Hardware requirements".
              </div>
            </div>

            <div className="space-y-4">
              {renderField(
                'Experiência em IA & Avaliação de Modelos (AI / LLM Experience - EN)', 
                profile.ai_experience_en, 
                'ai_experience_en', 
                'Descreva sua experiência em inglês...', 
                true, 
                'Excelente resposta para caixas de texto sobre familiaridade com inteligência artificial, RLHF e anotação.'
              )}

              {renderField(
                'Declaração de Nível de Inglês (English Proficiency Statement - EN)', 
                profile.english_level_statement, 
                'english_level_statement', 
                'Ex: Native Portuguese speaker with C1 advanced written comprehension...', 
                true, 
                'Texto para colar quando perguntarem como você lida com diretrizes em inglês.'
              )}

              {renderField(
                'Especificações do Computador & Internet (Hardware & Connection Specs - EN)', 
                profile.hardware_specs, 
                'hardware_specs', 
                'Ex: OS, RAM, Internet speed...', 
                true, 
                'Exigido em cadastros de QA, testes e anotação que demandam velocidade de internet comprovada.'
              )}

              {renderField(
                'Carta de Apresentação Base em Inglês (Cover Letter - EN)', 
                profile.cover_letter_en, 
                'cover_letter_en', 
                'Dear Hiring Team...', 
                true, 
                'Texto completo para colar na caixa "Cover Letter" de plataformas internacionais.'
              )}

              {renderField(
                'Carta de Apresentação Base em Português (Cover Letter - PT)', 
                profile.cover_letter_pt, 
                'cover_letter_pt', 
                'Prezada equipe de recrutamento...', 
                true, 
                'Versão para empresas com operação ou times locais no Brasil.'
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {renderField(
                  'Mini Bio / Resumo Curto em Inglês (Short Bio - EN)', 
                  profile.short_bio_en, 
                  'short_bio_en', 
                  '2-3 frases de apresentação em inglês...', 
                  true, 
                  'Ideal para campos curtos de perfil com limite de caracteres.'
                )}

                {renderField(
                  'Mini Bio / Resumo Curto em Português (Short Bio - PT)', 
                  profile.short_bio_pt, 
                  'short_bio_pt', 
                  '2-3 frases de apresentação em português...', 
                  true, 
                  'Ideal para campos curtos em português.'
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. SNIPPETS PERSONALIZADOS */}
        {activeSubTab === 'snippets' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                Crie seus próprios blocos de texto com perguntas específicas que você encontra com frequência nos formulários.
              </p>
              <button
                onClick={() => setShowAddSnippet(!showAddSnippet)}
                className="px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Snippet</span>
              </button>
            </div>

            {showAddSnippet && (
              <div className="bg-slate-900 border border-purple-500/40 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-purple-300">Criar Novo Snippet de Resposta</h3>
                <input
                  type="text"
                  value={newSnippetTitle}
                  onChange={(e) => setNewSnippetTitle(e.target.value)}
                  placeholder="Título (ex: 'Link do Loom de Apresentação' ou 'Graduação')"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
                <textarea
                  value={newSnippetContent}
                  onChange={(e) => setNewSnippetContent(e.target.value)}
                  placeholder="Conteúdo que será copiado em 1 clique..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-y"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowAddSnippet(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddSnippet}
                    disabled={!newSnippetTitle.trim()}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50"
                  >
                    Salvar Snippet
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3.5">
              {(profile.custom_snippets || []).length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  Nenhum snippet personalizado criado ainda. Clique em "Novo Snippet" acima para adicionar.
                </div>
              ) : (
                (profile.custom_snippets || []).map((snippet) => {
                  const isCopied = copiedKey === snippet.id;
                  if (searchTerm.trim()) {
                    const term = searchTerm.toLowerCase();
                    if (!snippet.title.toLowerCase().includes(term) && !snippet.content.toLowerCase().includes(term)) {
                      return null;
                    }
                  }
                  return (
                    <div key={snippet.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-purple-300">
                          {snippet.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(snippet.content, snippet.id)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                              isCopied
                                ? 'bg-emerald-500 text-slate-950 font-bold scale-105'
                                : 'bg-purple-600 hover:bg-purple-500 text-white active:scale-95'
                            }`}
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSnippet(snippet.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                            title="Excluir Snippet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap font-sans bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                        {snippet.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 6. BLOCO LIVRE / RASCUNHOS */}
        {activeSubTab === 'free_notes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Área de anotações livres, rascunhos de testes práticos, diretrizes temporárias e instruções de exames. Salvo automaticamente no Supabase.
              </span>
              <button
                onClick={() => copyToClipboard(profile.free_notes, 'free_notes')}
                disabled={!profile.free_notes}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  copiedKey === 'free_notes'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold'
                }`}
              >
                {copiedKey === 'free_notes' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'free_notes' ? 'Copiado!' : 'Copiar Todas as Notas'}</span>
              </button>
            </div>

            <textarea
              value={profile.free_notes}
              onChange={(e) => handleFieldChange('free_notes', e.target.value)}
              placeholder="Digite aqui anotações livres, resumos de diretrizes de exames, lembretes de prazos, credenciais não sensíveis de plataformas ou respostas em rascunho..."
              rows={14}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono leading-relaxed resize-y"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Caracteres: {profile.free_notes?.length || 0} | Palavras: {(profile.free_notes?.trim().split(/\s+/).filter(Boolean) || []).length}</span>
              {lastSavedTime && <span>Última gravação: {lastSavedTime}</span>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
