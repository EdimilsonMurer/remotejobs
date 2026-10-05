import React, { useState } from 'react';
import { Calculator, DollarSign, ArrowRight, TrendingUp, Sparkles, HelpCircle } from 'lucide-react';

export const EarningsCalculator: React.FC = () => {
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(20);
  const [hourlyRateUsd, setHourlyRateUsd] = useState<number>(9.5);
  const [usdToBrlRate, setUsdToBrlRate] = useState<number>(5.75);
  const [eurToBrlRate, setEurToBrlRate] = useState<number>(6.20);

  const weeklyIncomeUsd = hoursPerWeek * hourlyRateUsd;
  const monthlyIncomeUsd = weeklyIncomeUsd * 4.33;
  const monthlyIncomeBrl = monthlyIncomeUsd * usdToBrlRate;
  const annualIncomeBrl = monthlyIncomeBrl * 12;

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Simulador de Ganhos em Moeda Forte
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Calcule quanto você pode faturar em Reais trabalhando remotamente para plataformas internacionais de IA e avaliação.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Controls & Parameters */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 p-6 rounded-xl space-y-6">
          
          <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3">
            Parâmetros de Trabalho
          </h2>

          {/* Slider 1: Hours per Week */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Horas de Dedicação por Semana
              </label>
              <span className="font-mono text-emerald-400 font-bold text-sm tabular-nums">
                {hoursPerWeek} horas / semana
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={1}
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(Number(e.target.value))}
              className="w-full accent-emerald-400 bg-slate-950 cursor-pointer h-2 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>5h (Renda Extra)</span>
              <span>20h (Meio Período)</span>
              <span>40h (Tempo Integral)</span>
            </div>
          </div>

          {/* Slider 2: Hourly Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Valor da Hora em Dólar ($ USD)
              </label>
              <span className="font-mono text-emerald-400 font-bold text-sm tabular-nums">
                ${hourlyRateUsd.toFixed(2)} / hora
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={30}
              step={0.5}
              value={hourlyRateUsd}
              onChange={(e) => setHourlyRateUsd(Number(e.target.value))}
              className="w-full accent-emerald-400 bg-slate-950 cursor-pointer h-2 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>$5/h (Anotação / Microtarefas)</span>
              <span>$10/h (Rater / IA)</span>
              <span>$20+/h (Especialista / Outlier)</span>
            </div>
          </div>

          {/* Exchange Rate Adjustment */}
          <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cotação Dólar ($ USD para R$ BRL)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">R$</span>
                <input
                  type="number"
                  step={0.05}
                  value={usdToBrlRate}
                  onChange={(e) => setUsdToBrlRate(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cotação Euro (€ EUR para R$ BRL)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">R$</span>
                <input
                  type="number"
                  step={0.05}
                  value={eurToBrlRate}
                  onChange={(e) => setEurToBrlRate(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right 1 Col: Projections Results */}
        <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-xl space-y-5 flex flex-col justify-between">
          
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Projeção Estimada</span>
            </div>

            {/* Monthly Total in Reais */}
            <div className="mt-3">
              <span className="text-xs text-slate-400">Renda Mensal Estimada em Reais</span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tabular-nums">
                R$ {monthlyIncomeBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-xs font-mono text-slate-400 mt-1 block">
                ≈ ${monthlyIncomeUsd.toFixed(2)} USD / mês
              </span>
            </div>

            {/* Breakdown */}
            <div className="mt-6 space-y-2.5 pt-4 border-t border-slate-800 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Por Semana:</span>
                <span className="font-mono text-white font-semibold">
                  R$ {(weeklyIncomeUsd * usdToBrlRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  {' '}<span className="text-slate-500">(${weeklyIncomeUsd.toFixed(0)})</span>
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Por Hora em Reais:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  R$ {(hourlyRateUsd * usdToBrlRate).toFixed(2)} / h
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Projeção Anual:</span>
                <span className="font-mono text-white font-semibold">
                  R$ {annualIncomeBrl.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            💡 <strong>Ponto Chave:</strong> Receber $10/h trabalhando apenas 20 horas por semana equivale a mais de <strong>R$ 4.900/mês</strong> limpos, sem precisar de trânsito ou chefe presencial.
          </div>

        </div>

      </div>

    </div>
  );
};
