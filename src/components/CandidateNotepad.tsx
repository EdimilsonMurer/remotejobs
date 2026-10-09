import React, { useState, useEffect, useRef } from 'react';
import { 
  Clipboard, 
  Check, 
  Database, 
  Download, 
  Upload, 
  Sparkles, 
  FileText, 
  BookOpen, 
  Plus, 
  Trash2, 
  Search, 
  HelpCircle,
  X,
  Copy,
  Edit2,
  Tag
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
  const [activeSubTab, setActiveSubTab] = useState<'fields' | 'templates' | 'free_notes'>('fields');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ type: 'saved' | 'saving' | 'error'; message: string; source: 'supabase' | 'local' }>({
    type: 'saved',
    message: 'Carregando dados...',
    source: 'local'
  });
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  
  // Estado para novo campo
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldTitle, setNewFieldTitle] = useState('');
  const [newFieldContent, setNewFieldContent] = useState('');
  const [newFieldCategory, setNewFieldCategory] = useState('Geral');

  // Estado para edição de campo existente
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [editingCategory, setEditingCategory] = useState('');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Autosave automático no Supabase com debounce (500ms)
  const triggerAutoSave = (updatedProfile: CandidateProfileData) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSaveStatus(prev => ({ ...prev, type: 'saving', message: 'Gravando no Supabase...' }));

    debounceTimerRef.current = setTimeout(async () => {
      const res = await saveCandidateNotesToSupabase(updatedProfile);
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
    }, 500);
  };

  // Salva imediatamente sem esperar debounce (para inclusões ou exclusões de campos)
  const saveImmediately = async (updatedProfile: CandidateProfileData) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSaveStatus(prev => ({ ...prev, type: 'saving', message: 'Gravando no Supabase...' }));
    const res = await saveCandidateNotesToSupabase(updatedProfile);
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
  };

  const handleFieldChange = (field: keyof CandidateProfileData, value: any) => {
    const updated = { ...profile, [field]: value };
    setProfile(updated);
    triggerAutoSave(updated);
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

  // Criação de novos campos
  const handleCreateField = () => {
    if (!newFieldTitle.trim()) return;
    const newSnippet: CustomSnippet = {
      id: `field-${Date.now()}`,
      title: newFieldTitle.trim(),
      content: newFieldContent.trim(),
      category: newFieldCategory.trim() || 'Geral'
    };
    const updated = {
      ...profile,
      custom_snippets: [newSnippet, ...(profile.custom_snippets || [])]
    };
    setProfile(updated);
    saveImmediately(updated);
    setNewFieldTitle('');
    setNewFieldContent('');
    setShowAddFieldModal(false);
  };

  // Iniciar edição de campo
  const handleStartEdit = (snippet: CustomSnippet) => {
    setEditingSnippetId(snippet.id);
    setEditingTitle(snippet.title);
    setEditingContent(snippet.content);
    setEditingCategory(snippet.category || 'Geral');
  };

  // Salvar edição de campo
  const handleSaveEdit = (snippetId: string) => {
    const updatedSnippets = (profile.custom_snippets || []).map(s => {
      if (s.id === snippetId) {
        return {
          ...s,
          title: editingTitle.trim() || s.title,
          content: editingContent,
          category: editingCategory.trim() || 'Geral'
        };
      }
      return s;
    });
    const updated = {
      ...profile,
      custom_snippets: updatedSnippets
    };
    setProfile(updated);
    saveImmediately(updated);
    setEditingSnippetId(null);
  };

  // Cancelar edição
  const handleCancelEdit = () => {
    setEditingSnippetId(null);
  };

  // Exclusão de campo
  const handleDeleteField = (snippetId: string) => {
    const updated = {
      ...profile,
      custom_snippets: (profile.custom_snippets || []).filter(s => s.id !== snippetId)
    };
    setProfile(updated);
    saveImmediately(updated);
  };

  // Exportar / Importar JSON
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
        saveImmediately(merged);
      } catch (err) {
        alert('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Renderizador de campo fixo de templates
  const renderTemplateField = (
    label: string, 
    value: string, 
    fieldKey: keyof CandidateProfileData, 
    placeholder: string, 
    helperText?: string
  ) => {
    const isCopied = copiedKey === fieldKey;

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
          <label className="text-xs font-semibold text-slate-300">
            {label}
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

        <textarea
          value={value}
          onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed resize-y"
        />
      </div>
    );
  };

  // Lista de campos filtrados
  const filteredSnippets = (profile.custom_snippets || []).filter(snippet => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return snippet.title.toLowerCase().includes(term) ||
      snippet.content.toLowerCase().includes(term) ||
      (snippet.category && snippet.category.toLowerCase().includes(term));
  });

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
                Crie seus próprios campos e copie com 1 clique para preencher vagas. Salva automaticamente no Supabase.
              </p>
            </div>
          </div>
        </div>

        {/* Status de Sincronização Automática (Sem botão manual) */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Badge de Sincronização Automática com Supabase */}
          <div className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 font-mono shadow-sm ${
            saveStatus.type === 'saved'
              ? saveStatus.source === 'supabase'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                : 'bg-blue-950/80 border-blue-800 text-blue-300'
              : saveStatus.type === 'saving'
              ? 'bg-amber-950/80 border-amber-800 text-amber-300 animate-pulse'
              : 'bg-rose-950/80 border-rose-800 text-rose-300'
          }`}>
            <Database className="w-3.5 h-3.5" />
            <span className="truncate max-w-[260px]">{saveStatus.message}</span>
          </div>

          {/* Backup JSON */}
          <button
            onClick={handleExportJson}
            className="p-2 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors"
            title="Exportar backup em arquivo JSON"
          >
            <Download className="w-4 h-4" />
          </button>

          <label 
            className="p-2 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors cursor-pointer"
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
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg"
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
            placeholder="🔍 Filtrar rapidamente qualquer campo ou texto..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
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

      {/* Abas Principais do Bloco de Notas */}
      <div className="px-4 sm:px-6 pt-3 border-b border-slate-800/80 bg-slate-950 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSubTab('fields')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'fields'
              ? 'text-blue-400 border-blue-500 bg-slate-900/60'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/30'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-400" />
          <span>Meus Campos & Informações ({profile.custom_snippets?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('templates')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'templates'
              ? 'text-emerald-400 border-emerald-500 bg-slate-900/60'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/30'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Textos Prontos & Pitches (PT / EN)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('free_notes')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'free_notes'
              ? 'text-amber-400 border-amber-500 bg-slate-900/60'
              : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/30'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-400" />
          <span>Bloco Livre / Rascunhos</span>
        </button>
      </div>

      {/* Conteúdo Principal */}
      <div className="p-4 sm:p-6 overflow-y-auto flex-1 max-h-[calc(100vh-220px)] space-y-6">

        {/* 1. MEUS CAMPOS & INFORMAÇÕES (Campos Criados pelo Usuário) */}
        {activeSubTab === 'fields' && (
          <div className="space-y-4">
            
            {/* Header da Seção de Campos com Botão de Criar Campo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Campos para Preenchimento de Vagas</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Crie seus próprios campos (ex: E-mail, Currículo, LinkedIn, Pretensão Salarial, etc.) e copie com 1 clique.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddFieldModal(!showAddFieldModal)}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>+ Criar Novo Campo</span>
              </button>
            </div>

            {/* Formulário de Criação de Novo Campo */}
            {showAddFieldModal && (
              <div className="bg-slate-900 border-2 border-blue-500/50 rounded-xl p-4 sm:p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-blue-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Plus className="w-4 h-4 text-blue-400" />
                    <span>Adicionar Informação / Campo</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddFieldModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Nome / Título do Campo:
                    </label>
                    <input
                      type="text"
                      value={newFieldTitle}
                      onChange={(e) => setNewFieldTitle(e.target.value)}
                      placeholder="Ex: Meu E-mail Principal, Link do LinkedIn, Link do Currículo, Pretensão..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Categoria (Opcional):
                    </label>
                    <input
                      type="text"
                      value={newFieldCategory}
                      onChange={(e) => setNewFieldCategory(e.target.value)}
                      placeholder="Ex: Contato, Links, Pagamento..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Conteúdo / Valor que será copiado em 1 clique:
                  </label>
                  <textarea
                    value={newFieldContent}
                    onChange={(e) => setNewFieldContent(e.target.value)}
                    placeholder="Digite o texto exato que você precisa colar nos formulários..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-y"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddFieldModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateField}
                    disabled={!newFieldTitle.trim()}
                    className="px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors disabled:opacity-50 font-bold"
                  >
                    Salvar Campo
                  </button>
                </div>
              </div>
            )}

            {/* Lista dos Campos Criados */}
            <div className="grid grid-cols-1 gap-3.5">
              {filteredSnippets.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl space-y-3">
                  <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-300">
                      Nenhum campo cadastrado ainda
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Clique no botão <strong>"+ Criar Novo Campo"</strong> acima para adicionar seus dados (como E-mail, LinkedIn, Links de Currículo, Pretensão Salarial ou respostas frequentes).
                    </p>
                  </div>
                </div>
              ) : (
                filteredSnippets.map((snippet) => {
                  const isCopied = copiedKey === snippet.id;
                  const isEditing = editingSnippetId === snippet.id;

                  if (isEditing) {
                    return (
                      <div key={snippet.id} className="bg-slate-900 border-2 border-blue-500/60 rounded-xl p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            placeholder="Nome do campo..."
                            className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                          />
                          <input
                            type="text"
                            value={editingCategory}
                            onChange={(e) => setEditingCategory(e.target.value)}
                            placeholder="Categoria..."
                            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                          />
                        </div>
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={3}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(snippet.id)}
                            className="px-3 py-1 text-xs font-semibold bg-emerald-500 text-slate-950 rounded"
                          >
                            Salvar Alterações
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={snippet.id} 
                      className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all flex flex-col gap-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-200">
                            {snippet.title}
                          </span>
                          {snippet.category && (
                            <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                              {snippet.category}
                            </span>
                          )}
                        </div>

                        {/* Ações: Copiar, Editar, Excluir */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(snippet.content, snippet.id)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                              isCopied
                                ? 'bg-emerald-500 text-slate-950 font-bold scale-105'
                                : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
                            }`}
                            title="Copiar para a área de transferência"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartEdit(snippet)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Editar este campo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteField(snippet.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Excluir este campo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed select-all">
                        {snippet.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* 2. TEXTOS PRONTOS & PITCHES (PT / EN) */}
        {activeSubTab === 'templates' && (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-xs text-emerald-300 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
              <div>
                <strong>Textos Longos e Modelos de Resposta:</strong> Personalize suas cartas de apresentação e declarações de experiência. Qualquer alteração feita aqui salva automaticamente no Supabase.
              </div>
            </div>

            <div className="space-y-4">
              {renderTemplateField(
                'Experiência em IA & Avaliação de Modelos (AI / LLM Experience - EN)', 
                profile.ai_experience_en, 
                'ai_experience_en', 
                'Descreva sua experiência em inglês...', 
                'Resposta para caixas de texto sobre familiaridade com inteligência artificial, RLHF e anotação.'
              )}

              {renderTemplateField(
                'Declaração de Nível de Inglês (English Proficiency Statement - EN)', 
                profile.english_level_statement, 
                'english_level_statement', 
                'Ex: Native Portuguese speaker with C1 advanced written comprehension...', 
                'Texto para colar quando perguntarem como você lida com diretrizes em inglês.'
              )}

              {renderTemplateField(
                'Especificações do Computador & Internet (Hardware & Connection Specs - EN)', 
                profile.hardware_specs, 
                'hardware_specs', 
                'Ex: OS, RAM, Internet speed...', 
                'Exigido em cadastros de QA, testes e anotação que demandam velocidade de internet.'
              )}

              {renderTemplateField(
                'Carta de Apresentação Base em Inglês (Cover Letter - EN)', 
                profile.cover_letter_en, 
                'cover_letter_en', 
                'Dear Hiring Team...', 
                'Texto completo para colar na caixa "Cover Letter" de plataformas internacionais.'
              )}

              {renderTemplateField(
                'Carta de Apresentação Base em Português (Cover Letter - PT)', 
                profile.cover_letter_pt, 
                'cover_letter_pt', 
                'Prezada equipe de recrutamento...', 
                'Versão para empresas com operação ou times locais no Brasil.'
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {renderTemplateField(
                  'Mini Bio / Resumo Curto em Inglês (Short Bio - EN)', 
                  profile.short_bio_en, 
                  'short_bio_en', 
                  '2-3 frases de apresentação em inglês...', 
                  'Ideal para campos curtos de perfil com limite de caracteres.'
                )}

                {renderTemplateField(
                  'Mini Bio / Resumo Curto em Português (Short Bio - PT)', 
                  profile.short_bio_pt, 
                  'short_bio_pt', 
                  '2-3 frases de apresentação em português...', 
                  'Ideal para campos curtos em português.'
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. BLOCO LIVRE / RASCUNHOS */}
        {activeSubTab === 'free_notes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Área de anotações livres, rascunhos de testes práticos, diretrizes temporárias e instruções de exames. Salvo automaticamente no Supabase.
              </span>
              <button
                type="button"
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
