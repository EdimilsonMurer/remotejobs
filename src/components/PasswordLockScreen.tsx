import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ShieldCheck, ArrowRight, Sparkles, Globe, AlertCircle, CheckCircle2 } from 'lucide-react';
import { verifyAppPassword } from '../lib/supabase/security';
import { isSupabaseConfigured } from '../lib/supabase/client';

interface PasswordLockScreenProps {
  onAuthenticated: () => void;
}

export const PasswordLockScreen: React.FC<PasswordLockScreenProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const isSupabaseLive = isSupabaseConfigured();

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setErrorMessage('Por favor, informe a senha de acesso.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await verifyAppPassword(password);
      if (res.success) {
        setIsSuccess(true);
        setTimeout(() => {
          onAuthenticated();
        }, 500);
      } else {
        setErrorMessage(res.message || 'Senha incorreta. Tente novamente.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao verificar senha.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseDefault = () => {
    setPassword('remote2026');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Lock Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 transition-all">
        
        {/* App Logo & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-emerald-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3.5 shadow-inner">
            <Lock className="w-7 h-7 text-cyan-300 animate-pulse" />
          </div>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xl font-bold tracking-tight text-white">RemoteJobs</span>
            <span className="text-blue-400 font-mono text-xs font-bold bg-blue-950/90 px-1.5 py-0.5 rounded border border-blue-800/60">
              PT
            </span>
          </div>

          <h1 className="text-lg font-semibold text-slate-100">
            Painel Restrito & Protegido
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Digite a senha master para acessar as oportunidades internacionais em moeda forte.
          </p>
        </div>

        {/* Lock Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Senha de Acesso</span>
              <span className="text-[11px] text-cyan-400/90 font-mono">Solicitada só na 1ª vez</span>
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4" />
              </div>

              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Digite a senha master..."
                autoFocus
                className={`w-full pl-10 pr-11 py-2.5 bg-slate-950/80 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                  errorMessage
                    ? 'border-rose-500/80 focus:ring-rose-500/40'
                    : isSuccess
                    ? 'border-emerald-500/80 focus:ring-emerald-500/40'
                    : 'border-slate-800 focus:border-cyan-500/80 focus:ring-cyan-500/30'
                }`}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Feedback */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Feedback */}
          {isSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Acesso autorizado! Carregando painel...</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <span>Verificando...</span>
            ) : isSuccess ? (
              <>
                <span>Desbloqueado</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Helper Button: Default password */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleUseDefault}
            className="text-[11px] text-slate-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Preencher senha padrão: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 font-mono">remote2026</code></span>
          </button>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed mt-1">
            🔒 Uma vez inserida, sua autenticação fica salva com segurança neste navegador. Você poderá alterar a senha nas <strong>Configurações</strong>.
          </p>
        </div>

        {/* Supabase status indicator */}
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isSupabaseLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{isSupabaseLive ? 'Supabase Conectado' : 'Modo Standalone'}</span>
          </div>
          <span className="text-slate-500">Versão 2.6 Pro</span>
        </div>

      </div>
    </div>
  );
};
