import React, { useState, useEffect, useRef } from 'react';
import { X, Globe, DollarSign, ShieldAlert, Sparkles, Loader2, CheckCircle2, ArrowRight, AlertCircle, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { Platform, CurrencyType, EnglishRequirement, ProcessType, PlatformStatus, UserAccountStatus } from '../types/job';
import { autofillPlatformFromUrl } from '../services/platformAutofill';

interface PlatformModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (platform: Platform) => void;
  editingPlatform?: Platform | null;
  initialUrl?: string;
}

export const PlatformModal: React.FC<PlatformModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingPlatform,
  initialUrl
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [autofillStep, setAutofillStep] = useState<string>('');
  const [autofillSuccess, setAutofillSuccess] = useState<string | null>(null);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [hasAutofilled, setHasAutofilled] = useState(false);

  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [careersUrl, setCareersUrl] = useState('');
  const [category, setCategory] = useState('Treinamento de IA & Avaliação');
  const [currency, setCurrency] = useState<CurrencyType>('USD');
  const [englishRequirement, setEnglishRequirement] = useState<EnglishRequirement>('READING_ONLY');
  const [processType, setProcessType] = useState<ProcessType>('ONLINE_EXAM');
  const [status, setStatus] = useState<PlatformStatus>('FAVORITE');
  const [blacklistReason, setBlacklistReason] = useState('');
  const [paymentMethods, setPaymentMethods] = useState('Payoneer, PayPal');
  const [averagePayRate, setAveragePayRate] = useState('$5.00 - $15.00 / hora');
  const [notes, setNotes] = useState('');
  const [userStatus, setUserStatus] = useState<UserAccountStatus>('NOT_REGISTERED');

  const urlInputRef = useRef<HTMLInputElement>(null);

  // Executa o autofill inteligente
  const handleTriggerAutofill = async (targetUrl?: string) => {
    const raw = (targetUrl || urlInput || websiteUrl).trim();
    if (!raw || raw === 'https://') {
      setAutofillError('Insira uma URL válida para preenchimento automático.');
      urlInputRef.current?.focus();
      return;
    }

    setIsAutofilling(true);
    setAutofillError(null);
    setAutofillSuccess(null);
    setAutofillStep('Analisando domínio e estrutura...');

    try {
      const data = await autofillPlatformFromUrl(raw, (_step, message) => {
        setAutofillStep(message);
      });

      setName(data.name);
      setWebsiteUrl(data.websiteUrl);
      setCareersUrl(data.careersUrl || data.websiteUrl);
      setCategory(data.category);
      setCurrency(data.currency);
      setEnglishRequirement(data.englishRequirement);
      setProcessType(data.processType);
      setStatus(data.status);
      setBlacklistReason(data.blacklistReason || '');
      setPaymentMethods(data.paymentMethods.join(', '));
      setAveragePayRate(data.averagePayRate || '$5.00 - $18.00 / hora');
      setNotes(data.notes || '');

      setHasAutofilled(true);
      setAutofillSuccess(`Dados de "${data.name}" preenchidos com sucesso!`);
      setTimeout(() => setAutofillSuccess(null), 6000);
    } catch (err: any) {
      setAutofillError(err.message || 'Erro ao analisar a URL. Verifique o endereço e tente novamente.');
    } finally {
      setIsAutofilling(false);
      setAutofillStep('');
    }
  };

  useEffect(() => {
    if (editingPlatform) {
      setUrlInput(editingPlatform.websiteUrl || '');
      setName(editingPlatform.name);
      setWebsiteUrl(editingPlatform.websiteUrl);
      setCareersUrl(editingPlatform.careersUrl);
      setCategory(editingPlatform.category);
      setCurrency(editingPlatform.currency);
      setEnglishRequirement(editingPlatform.englishRequirement);
      setProcessType(editingPlatform.processType);
      setStatus(editingPlatform.status);
      setBlacklistReason(editingPlatform.blacklistReason || '');
      setPaymentMethods(editingPlatform.paymentMethods.join(', '));
      setAveragePayRate(editingPlatform.averagePayRate || '');
      setNotes(editingPlatform.notes);
      setUserStatus(editingPlatform.userStatus);
      setHasAutofilled(false);
      setAutofillSuccess(null);
      setAutofillError(null);
    } else {
      const defaultUrl = initialUrl || '';
      setUrlInput(defaultUrl);
      setName('');
      setWebsiteUrl(defaultUrl || 'https://');
      setCareersUrl(defaultUrl || 'https://');
      setCategory('Treinamento de IA & Avaliação');
      setCurrency('USD');
      setEnglishRequirement('READING_ONLY');
      setProcessType('ONLINE_EXAM');
      setStatus('FAVORITE');
      setBlacklistReason('');
      setPaymentMethods('Payoneer, PayPal');
      setAveragePayRate('$5.00 - $15.00 / hora');
      setNotes('');
      setUserStatus('NOT_REGISTERED');
      setHasAutofilled(false);
      setAutofillSuccess(null);
      setAutofillError(null);

      // Se veio com URL inicial, dispara o preenchimento automático de imediato
      if (defaultUrl && defaultUrl !== 'https://') {
        setTimeout(() => {
          handleTriggerAutofill(defaultUrl);
        }, 150);
      }
    }
  }, [editingPlatform, isOpen, initialUrl]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setAutofillError('Por favor, informe o nome da plataforma.');
      return;
    }

    const cleanSlug = editingPlatform 
      ? editingPlatform.id 
      : name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `platform-${Date.now()}`;

    const newPlatform: Platform = {
      id: cleanSlug,
      name: name.trim(),
      websiteUrl: websiteUrl.trim() || 'https://',
      careersUrl: careersUrl.trim() || websiteUrl.trim() || 'https://',
      category: category.trim() || 'Treinamento de IA & Avaliação',
      currency,
      englishRequirement,
      processType,
      status,
      blacklistReason: status === 'BLACKLIST' ? (blacklistReason.trim() || 'Adicionada à lista negra') : undefined,
      paymentMethods: paymentMethods.split(',').map(s => s.trim()).filter(Boolean),
      averagePayRate: averagePayRate.trim() || undefined,
      notes: notes.trim(),
      userStatus,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    onSave(newPlatform);
    onClose();
  };

  const handleQuickUrlFill = (exampleUrl: string) => {
    setUrlInput(exampleUrl);
    handleTriggerAutofill(exampleUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-inner ${status === 'BLACKLIST' ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'}`}>
              {status === 'BLACKLIST' ? <ShieldAlert className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{editingPlatform ? `Editar Plataforma: ${editingPlatform.name}` : 'Cadastrar Nova Plataforma'}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Basta colar a URL para preenchimento automático inteligente com IA.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PROMINENT AUTO-FILL SECTION */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 border border-emerald-500/40 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-white tracking-wide uppercase">
                Preenchimento Automático por URL
              </span>
            </div>
            <span className="text-[11px] font-medium text-emerald-400/90 hidden sm:inline-flex items-center gap-1">
              <span>IA + Base de Plataformas</span>
            </span>
          </div>

          <p className="text-xs text-slate-300 mb-3 leading-relaxed">
            Cole apenas o link da plataforma (site ou carreira). O sistema descobre o nome, moeda, exigência de inglês, tipo de teste e valores para você:
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <LinkIcon className="w-4 h-4 text-emerald-400/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={urlInputRef}
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTriggerAutofill();
                  }
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted && (pasted.startsWith('http') || pasted.includes('.'))) {
                    setTimeout(() => handleTriggerAutofill(pasted), 80);
                  }
                }}
                placeholder="Cole a URL aqui: ex. https://alignerr.com ou https://outlier.ai"
                className="w-full bg-slate-950/90 border border-emerald-500/40 focus:border-emerald-400 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner font-mono"
              />
            </div>

            <button
              type="button"
              disabled={isAutofilling}
              onClick={() => handleTriggerAutofill()}
              className="px-4 py-2.5 bg-emerald-400 hover:bg-emerald-300 disabled:bg-emerald-600/50 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:cursor-wait hover:scale-[1.01] active:scale-[0.99]"
            >
              {isAutofilling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analisando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>Preencher Automático</span>
                </>
              )}
            </button>
          </div>

          {/* Progress / Step Feedback */}
          {isAutofilling && (
            <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-200 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
              <span>{autofillStep || 'Consultando metadados e parâmetros da plataforma...'}</span>
            </div>
          )}

          {/* Success Banner */}
          {autofillSuccess && !isAutofilling && (
            <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-400/50 flex items-center justify-between gap-2 text-xs text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{autofillSuccess}</span>
              </div>
              <span className="text-[11px] text-emerald-300/80 font-mono">Pronto para salvar</span>
            </div>
          )}

          {/* Error Banner */}
          {autofillError && !isAutofilling && (
            <div className="mt-3 p-2.5 rounded-lg bg-rose-950/70 border border-rose-700/60 flex items-center gap-2 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{autofillError}</span>
            </div>
          )}

          {/* Quick Example Chips */}
          {!editingPlatform && !hasAutofilled && (
            <div className="mt-3 flex items-center flex-wrap gap-1.5 text-[11px] text-slate-400">
              <span className="text-slate-500">Exemplos rápidos:</span>
              <button
                type="button"
                onClick={() => handleQuickUrlFill('https://www.alignerr.com/')}
                className="px-2 py-0.5 rounded-md bg-slate-950/70 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-800 hover:border-emerald-700 transition-colors cursor-pointer"
              >
                Alignerr
              </button>
              <button
                type="button"
                onClick={() => handleQuickUrlFill('https://mindrift.ai/')}
                className="px-2 py-0.5 rounded-md bg-slate-950/70 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-800 hover:border-emerald-700 transition-colors cursor-pointer"
              >
                Mindrift
              </button>
              <button
                type="button"
                onClick={() => handleQuickUrlFill('https://invisible.co/')}
                className="px-2 py-0.5 rounded-md bg-slate-950/70 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-800 hover:border-emerald-700 transition-colors cursor-pointer"
              >
                Invisible Tech
              </button>
              <button
                type="button"
                onClick={() => handleQuickUrlFill('https://testerwork.com/')}
                className="px-2 py-0.5 rounded-md bg-slate-950/70 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-800 hover:border-emerald-700 transition-colors cursor-pointer"
              >
                TesterWork
              </button>
              <button
                type="button"
                onClick={() => handleQuickUrlFill('https://www.prolific.com/')}
                className="px-2 py-0.5 rounded-md bg-slate-950/70 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-800 hover:border-emerald-700 transition-colors cursor-pointer"
              >
                Prolific (£ GBP)
              </button>
            </div>
          )}
        </div>

        {/* Main Form Fields */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Nome da Plataforma *</span>
                {hasAutofilled && (
                  <span className="text-[10px] text-emerald-400 font-normal">Preenchido com IA</span>
                )}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Welocalize, OneForma, Outlier..."
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                  hasAutofilled ? 'border-emerald-500/50 bg-emerald-950/10' : 'border-slate-700 focus:border-emerald-400'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Moeda de Pagamento
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyType)}
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors ${
                  hasAutofilled ? 'border-emerald-500/50' : 'border-slate-700 focus:border-emerald-400'
                }`}
              >
                <option value="USD">Dólar Americano ($ USD) - Moeda Forte</option>
                <option value="EUR">Euro (€ EUR) - Moeda Forte</option>
                <option value="GBP">Libra Esterlina (£ GBP) - Moeda Forte</option>
                <option value="BRL">Real Brasileiro (R$ BRL) - Nacional</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Link do Site Oficial</span>
                {websiteUrl && websiteUrl !== 'https://' && websiteUrl !== urlInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput(websiteUrl);
                      handleTriggerAutofill(websiteUrl);
                    }}
                    className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Auto-preencher
                  </button>
                )}
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://exemplo.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Link de Vagas / Portal de Cadastro
              </label>
              <input
                type="url"
                value={careersUrl}
                onChange={(e) => setCareersUrl(e.target.value)}
                placeholder="https://exemplo.com/careers"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Exigência de Inglês
              </label>
              <select
                value={englishRequirement}
                onChange={(e) => {
                  const req = e.target.value as EnglishRequirement;
                  setEnglishRequirement(req);
                  if (req === 'FLUENT_INTERVIEW' && status !== 'BLACKLIST') {
                    setStatus('BLACKLIST');
                    setBlacklistReason('Exige entrevista técnica oral em inglês.');
                  }
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400 transition-colors"
              >
                <option value="NONE">Nenhum (100% em Português)</option>
                <option value="READING_ONLY">Apenas Leitura / Instruções (com tradutor)</option>
                <option value="BASIC">Inglês Básico</option>
                <option value="INTERMEDIATE">Inglês Intermediário</option>
                <option value="FLUENT_INTERVIEW">⚠️ Exige Entrevista Oral em Inglês (Lista Negra)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tipo de Processo Seletivo
              </label>
              <select
                value={processType}
                onChange={(e) => setProcessType(e.target.value as ProcessType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400 transition-colors"
              >
                <option value="NO_INTERVIEW">Sem Entrevista (Cadastro direto / início rápido)</option>
                <option value="ONLINE_EXAM">Teste Prático Online (Guidelines / Certificação)</option>
                <option value="AI_TEST">Teste Assíncrono Gravado / IA</option>
                <option value="LIVE_INTERVIEW">Entrevista com Recrutador Humano ao Vivo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Status no Sistema
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PlatformStatus)}
                className={`w-full border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none transition-colors ${
                  status === 'BLACKLIST' 
                    ? 'bg-rose-950 border-rose-700 text-rose-200' 
                    : status === 'FAVORITE' 
                    ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
                    : 'bg-slate-950 border-slate-700 text-white'
                }`}
              >
                <option value="FAVORITE">⭐ Favorita (Prioritária - Moeda Forte)</option>
                <option value="ACTIVE">🟢 Ativa (Monitorada)</option>
                <option value="PAUSED">⏸️ Pausada (Não monitorar no momento)</option>
                <option value="BLACKLIST">🚫 Lista Negra (Bloquear e descartar vagas)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Status da Minha Conta / Inscrição
              </label>
              <select
                value={userStatus}
                onChange={(e) => setUserStatus(e.target.value as UserAccountStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
              >
                <option value="NOT_REGISTERED">⚪ Ainda não tenho conta</option>
                <option value="REGISTERED">🟣 Cadastro realizado</option>
                <option value="EXAM_PENDING">🟡 Prova de qualificação pendente</option>
                <option value="UNDER_REVIEW">🔵 Perfil em análise</option>
                <option value="APPROVED_ACTIVE">🟢 Aprovado & Ativo em projetos</option>
                <option value="INACTIVE">⚫ Inativo / Pausado</option>
              </select>
            </div>
          </div>

          {status === 'BLACKLIST' && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg">
              <label className="block text-xs font-semibold text-rose-300 mb-1 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                Motivo do Bloqueio na Lista Negra *
              </label>
              <input
                type="text"
                required
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                placeholder="Ex: Exige entrevista técnica em inglês fluente (como Micro1)"
                className="w-full bg-slate-950 border border-rose-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-rose-300/40 focus:outline-none focus:border-rose-400"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Formas de Pagamento
              </label>
              <input
                type="text"
                value={paymentMethods}
                onChange={(e) => setPaymentMethods(e.target.value)}
                placeholder="Payoneer, PayPal, Transferência..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Remuneração Estimada
              </label>
              <input
                type="text"
                value={averagePayRate}
                onChange={(e) => setAveragePayRate(e.target.value)}
                placeholder="Ex: $5 - $15 / hora"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Notas, Dicas & Instruções da Plataforma
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dicas de como passar no teste, projetos em português, horários, etc."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <span className="text-[11px] text-slate-500">
              {hasAutofilled ? '✨ Campos carregados pela IA' : 'Dica: Cole a URL no topo para preencher tudo'}
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                {editingPlatform ? 'Salvar Alterações' : 'Cadastrar Plataforma'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
