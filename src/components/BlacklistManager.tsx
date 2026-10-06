import React, { useState } from 'react';
import { ShieldAlert, Plus, Trash2, Ban, AlertOctagon, CheckCircle2, Lock } from 'lucide-react';
import { Platform, BlacklistRule } from '../types/job';

interface BlacklistManagerProps {
  platforms: Platform[];
  blacklistRules: BlacklistRule[];
  onAddRule: (rule: BlacklistRule) => void;
  onRemoveRule: (id: string) => void;
  onUpdatePlatform: (platform: Platform) => void;
}

export const BlacklistManager: React.FC<BlacklistManagerProps> = ({
  platforms,
  blacklistRules,
  onAddRule,
  onRemoveRule,
  onUpdatePlatform
}) => {
  const [newTargetName, setNewTargetName] = useState('');
  const [newReason, setNewReason] = useState('Exige entrevista falada em inglês fluente');
  const [newType, setNewType] = useState<'PLATFORM' | 'COMPANY' | 'KEYWORD'>('PLATFORM');

  const blacklistedPlatforms = [...platforms.filter(p => p.status === 'BLACKLIST')].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
  );

  const handleAddCustomRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTargetName.trim()) return;

    const newRule: BlacklistRule = {
      id: `rule-${Date.now()}`,
      name: newTargetName.trim(),
      type: newType,
      reason: newReason.trim() || 'Bloqueada por solicitação do usuário',
      addedAt: new Date().toISOString().split('T')[0]
    };

    onAddRule(newRule);

    // If matches any platform, mark platform as BLACKLIST too
    const matched = platforms.find(p => p.name.toLowerCase() === newTargetName.trim().toLowerCase());
    if (matched) {
      onUpdatePlatform({
        ...matched,
        status: 'BLACKLIST',
        blacklistReason: newReason.trim()
      });
    }

    setNewTargetName('');
    setNewReason('Exige entrevista falada em inglês fluente');
  };

  const handleUnblockPlatform = (platform: Platform) => {
    onUpdatePlatform({
      ...platform,
      status: 'ACTIVE',
      blacklistReason: undefined
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-rose-950/30 border border-rose-900/60 p-5 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Lista Negra de Plataformas & Empresas (Blacklist)</span>
            </h1>
            <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
              O sistema <strong>descarta e oculta automaticamente</strong> qualquer vaga ou oportunidade de plataformas e empresas listadas aqui (como a <span className="font-semibold text-white">Micro1</span>, que exige entrevista técnica em inglês fluente).
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Blacklisted Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-400" />
              <span>Plataformas e Empresas Bloqueadas ({blacklistedPlatforms.length + blacklistRules.length})</span>
            </h2>
          </div>

          <div className="space-y-3">
            {blacklistedPlatforms.map((p) => (
              <div
                key={p.id}
                className="bg-slate-900/80 border border-rose-900/50 p-4 rounded-xl flex items-start justify-between gap-4 hover:border-rose-700/60 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{p.name}</span>
                    <span className="text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.5 rounded">
                      PLATAFORMA BLOQUEADA
                    </span>
                  </div>
                  <p className="text-xs text-rose-300/90 leading-relaxed">
                    <strong>Motivo:</strong> {p.blacklistReason || 'Exige entrevista em inglês / Descartada'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Nenhuma vaga desta plataforma aparecerá no seu Radar de Vagas.
                  </p>
                </div>

                <button
                  onClick={() => handleUnblockPlatform(p)}
                  className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg whitespace-nowrap transition-colors"
                >
                  Desbloquear
                </button>
              </div>
            ))}

            {blacklistRules.map((rule) => {
              // Only render if not already rendered as platform
              const isPlatformDup = blacklistedPlatforms.some(p => p.name.toLowerCase() === rule.name.toLowerCase());
              if (isPlatformDup) return null;

              return (
                <div
                  key={rule.id}
                  className="bg-slate-900/80 border border-rose-900/50 p-4 rounded-xl flex items-start justify-between gap-4 hover:border-rose-700/60 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{rule.name}</span>
                      <span className="text-[10px] font-mono bg-slate-800 text-rose-300 border border-slate-700 px-1.5 py-0.5 rounded">
                        {rule.type === 'COMPANY' ? 'EMPRESA' : rule.type === 'KEYWORD' ? 'PALAVRA-CHAVE' : 'PLATAFORMA'}
                      </span>
                    </div>
                    <p className="text-xs text-rose-300/90">
                      <strong>Motivo:</strong> {rule.reason}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Adicionada em {rule.addedAt}
                    </p>
                  </div>

                  <button
                    onClick={() => onRemoveRule(rule.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Remover regra"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Add to Blacklist Form */}
        <div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl sticky top-20">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Bloquear Nova Empresa ou Plataforma</span>
            </h2>

            <form onSubmit={handleAddCustomRule} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome da Empresa / Plataforma *
                </label>
                <input
                  type="text"
                  required
                  value={newTargetName}
                  onChange={(e) => setNewTargetName(e.target.value)}
                  placeholder="Ex: Micro1, Turing, Empresa X..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tipo de Bloqueio
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
                >
                  <option value="PLATFORM">Plataforma de Vagas</option>
                  <option value="COMPANY">Empresa Contratante</option>
                  <option value="KEYWORD">Palavra-Chave / Termo Indesejado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motivo do Bloqueio *
                </label>
                <textarea
                  rows={3}
                  required
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Ex: Exige entrevista oral em inglês, testes abusivos..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Adicionar à Lista Negra</span>
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              💡 <strong>Como funciona:</strong> Ao adicionar um nome aqui, o buscador irá filtrar qualquer vaga associada em tempo real, economizando seu tempo e energia.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
