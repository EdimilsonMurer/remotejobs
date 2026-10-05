import React, { useState, useEffect } from 'react';
import { X, Globe, DollarSign, ShieldAlert, Sparkles } from 'lucide-react';
import { Platform, CurrencyType, EnglishRequirement, ProcessType, PlatformStatus, UserAccountStatus } from '../types/job';

interface PlatformModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (platform: Platform) => void;
  editingPlatform?: Platform | null;
}

export const PlatformModal: React.FC<PlatformModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingPlatform
}) => {
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

  useEffect(() => {
    if (editingPlatform) {
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
    } else {
      setName('');
      setWebsiteUrl('https://');
      setCareersUrl('https://');
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
    }
  }, [editingPlatform, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newPlatform: Platform = {
      id: editingPlatform ? editingPlatform.id : `platform-${Date.now()}`,
      name: name.trim(),
      websiteUrl: websiteUrl.trim() || 'https://',
      careersUrl: careersUrl.trim() || websiteUrl.trim() || 'https://',
      category: category.trim(),
      currency,
      englishRequirement,
      processType,
      status,
      blacklistReason: status === 'BLACKLIST' ? blacklistReason.trim() : undefined,
      paymentMethods: paymentMethods.split(',').map(s => s.trim()).filter(Boolean),
      averagePayRate: averagePayRate.trim() || undefined,
      notes: notes.trim(),
      userStatus,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    onSave(newPlatform);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl relative my-8">
        
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status === 'BLACKLIST' ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'}`}>
              {status === 'BLACKLIST' ? <ShieldAlert className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {editingPlatform ? `Editar Plataforma: ${editingPlatform.name}` : 'Cadastrar Nova Plataforma'}
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie plataformas de trabalho remoto, moedas e critérios de entrevista.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome da Plataforma *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Welocalize, OneForma, Outlier..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Moeda de Pagamento
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400 transition-colors"
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Link do Site Oficial
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
                    setBlacklistReason('Exige entrevista técnica ao vivo em inglês.');
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
                <option value="NOT_REGISTERED">Ainda não tenho cadastro</option>
                <option value="REGISTERED">Cadastro realizado</option>
                <option value="EXAM_PENDING">Prova de qualificação pendente</option>
                <option value="UNDER_REVIEW">Perfil em análise</option>
                <option value="APPROVED_ACTIVE">✅ Aprovado / Ativo em projetos</option>
                <option value="INACTIVE">Inativo</option>
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

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm"
            >
              {editingPlatform ? 'Salvar Alterações' : 'Cadastrar Plataforma'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
