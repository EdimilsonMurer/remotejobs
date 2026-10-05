import React from 'react';
import { BookOpen, CheckCircle2, ShieldCheck, DollarSign, ExternalLink, Sparkles, HelpCircle } from 'lucide-react';

export const GuidesModal: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Guia Prático: Como Ganhar em Moeda Forte sem Falar Inglês
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Passo a passo comprovado para passar nos testes e maximizar seus ganhos em Dólar e Euro no Brasil.
            </p>
          </div>
        </div>
      </div>

      {/* Guide Cards */}
      <div className="space-y-4">
        
        {/* Step 1 */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <span className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center text-xs font-mono">1</span>
            <h3>Por que empresas como Welocalize, Telus e Outlier não exigem entrevista falada?</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pl-8">
            Essas empresas treinam modelos de inteligência artificial e refinam resultados de busca para o <strong>mercado brasileiro</strong>. O que elas precisam não é que você fale inglês com um recrutador, mas sim que você entenda como um usuário nativo do Brasil busca informações, pesquisa produtos e avalia textos em Português.
          </p>
          <div className="pl-8 text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>O processo seletivo consiste em ler uma apostila de regras (Guidelines) e responder um teste prático online.</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Você pode usar ferramentas como o Google Tradutor ou DeepL para ler o material com calma antes da prova.</span>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <span className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center text-xs font-mono">2</span>
            <h3>O Segredo para Passar no Exame da Welocalize e TELUS (Guidelines Exam)</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pl-8">
            Ao se candidatar para <em>Search Quality Rater</em> ou <em>Ads Assessor</em>, você receberá um PDF de aproximadamente 150 a 170 páginas com exemplos reais:
          </p>
          <ul className="pl-8 space-y-1.5 text-xs text-slate-300 list-disc list-inside">
            <li><strong>Mantenha o PDF aberto com CTRL + F durante o teste:</strong> O exame é com consulta aberta! Você não precisa decorar, apenas saber pesquisar os critérios no documento.</li>
            <li><strong>Foco nos conceitos de Page Quality (PQ) e Needs Met (NM):</strong> A maioria das questões testa se você sabe classificar a qualidade de uma página e se o resultado atende à intenção do usuário.</li>
            <li><strong>Não tenha pressa:</strong> Eles dão até 7 dias para você completar as 3 partes do exame com tranquilidade.</li>
          </ul>
        </div>

        {/* Step 3 */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <span className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center text-xs font-mono">3</span>
            <h3>Como Receber em Dólar e Euro no Brasil (Menores Taxas)</h3>
          </div>
          <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
              <span className="font-bold text-white block mb-1">Payoneer</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Utilizado por OneForma, CrowdGen e Clickworker. Permite transferir diretamente para qualquer conta bancária brasileira (Nubank, Inter, Itaú) via PIX.
              </p>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
              <span className="font-bold text-white block mb-1">PayPal & AirTM</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Utilizado por Outlier, TesterWork e Prolific. Pagamentos rápidos semanais que caem direto na sua carteira.
              </p>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <span className="w-6 h-6 rounded-full bg-rose-950 border border-rose-800 flex items-center justify-center text-xs font-mono text-rose-400">4</span>
            <h3>Por que colocamos a Micro1 e similares na Lista Negra?</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pl-8">
            Plataformas como a <strong>Micro1, Turing e BairesDev</strong> são voltadas para contratação de engenheiros de software com entrevistas técnicas ao vivo em inglês fluente com clientes dos EUA. Como o seu objetivo é trabalhar sem essa barreira, o nosso sistema bloqueia essas plataformas para que você foque 100% nas plataformas com testes assíncronos e sem entrevista falada.
          </p>
        </div>

        {/* Step 5 - Terminal & Virtual Env Cheat Sheet */}
        <div className="bg-slate-900/90 border border-emerald-900/60 p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <span className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center text-xs font-mono text-emerald-300">5</span>
            <h3>Anotações Técnicas: Comandos para Ativar o Ambiente Virtual (venv)</h3>
          </div>

          <div className="pl-8 space-y-3 text-xs">
            <p className="text-slate-300">
              Guarde estes comandos para ativar o seu ambiente Python e rodar o robô caçador de vagas:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* CMD */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <span className="font-bold text-white text-xs block">Prompt de Comando (CMD Windows):</span>
                <div className="bg-slate-900 p-2 rounded font-mono text-emerald-400 text-[11px] select-all">
                  cd C:\robo_vagas<br />
                  venv\Scripts\activate
                </div>
                <span className="text-[10px] text-slate-400 block">Dica: No CMD não precisa digitar o .bat, apenas activate.</span>
              </div>

              {/* PowerShell */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <span className="font-bold text-white text-xs block">Windows PowerShell:</span>
                <div className="bg-slate-900 p-2 rounded font-mono text-emerald-400 text-[11px] select-all">
                  cd C:\robo_vagas<br />
                  .\venv\Scripts\Activate.ps1
                </div>
                <span className="text-[10px] text-slate-400 block">Se der erro de script: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass</span>
              </div>

              {/* Linux/Mac/Git Bash */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <span className="font-bold text-white text-xs block">Linux / macOS / Git Bash:</span>
                <div className="bg-slate-900 p-2 rounded font-mono text-emerald-400 text-[11px] select-all">
                  source venv/bin/activate
                </div>
                <span className="text-[10px] text-slate-400 block">Para desativar o ambiente a qualquer momento: digite deactivate</span>
              </div>

              {/* Install and Run */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <span className="font-bold text-white text-xs block">Comandos de Instalação e Execução:</span>
                <div className="bg-slate-900 p-2 rounded font-mono text-emerald-300 text-[11px] select-all">
                  pip install "crewai[google-genai]"<br />
                  python job.py
                </div>
                <span className="text-[10px] text-emerald-400 block">✔ Você saberá que está ativo quando aparecer (venv) no início da linha!</span>
              </div>
            </div>

            {/* iniciar.bat shortcut */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1 text-slate-400 text-[11px]">
              <strong className="text-white">💡 Atalho automático de 2 cliques:</strong>
              <p>
                Você pode criar um arquivo chamado <code className="text-emerald-400 font-mono">iniciar.bat</code> na pasta <code className="text-slate-200 font-mono">C:\robo_vagas</code> contendo:
              </p>
              <pre className="p-2 bg-slate-900 rounded font-mono text-slate-200 text-[10px] overflow-x-auto">
{`@echo off
cd /d "C:\\robo_vagas"
call venv\\Scripts\\activate.bat
python job.py
pause`}
              </pre>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
