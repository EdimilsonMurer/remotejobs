import { WelocalizeConnector } from '../connectors/welocalize';
import { GeminiClassifier } from '../pipeline/gemini-classifier';
import { runPreFilter } from '../pipeline/pre-filter';

async function testGeminiLive() {
  console.log('================================================================');
  console.log('  TESTE DO CLASSIFICADOR GEMINI COM VAGAS REAIS EM TEMPO REAL  ');
  console.log('================================================================\n');

  const welocalize = new WelocalizeConnector();
  console.log('1. Coletando vagas oficiais da Welocalize...');
  const jobs = await welocalize.collect();
  console.log(`   Coletadas: ${jobs.length} vagas.\n`);

  // Filtra vagas com pré-filtro
  const highPriorityJobs = jobs.filter(j => runPreFilter(j).priority === 'HIGH');
  console.log(`2. Vagas identificadas como ALTA PRIORIDADE para brasileiros: ${highPriorityJobs.length}`);

  // Selecionamos 2 vagas brasileiras prioritárias e 1 vaga em outro idioma para contraste
  const testSample = [
    highPriorityJobs.find(j => j.title.includes('Portuguese (Brazil)') || j.title.includes('Portuguese (BR)')),
    highPriorityJobs.find(j => j.title.includes('Generative AI Analyst') || j.title.includes('Quality Coordinator')),
    jobs.find(j => j.title.includes('German') || j.title.includes('French'))
  ].filter(Boolean);

  console.log(`3. Enviando ${testSample.length} vagas reais para classificação pelo Gemini 3.8 Flash...\n`);
  const classifier = new GeminiClassifier();

  for (let i = 0; i < testSample.length; i++) {
    const job = testSample[i]!;
    console.log(`----------------------------------------------------------------`);
    console.log(`🔍 [Vaga ${i + 1}/${testSample.length}] "${job.title}"`);
    console.log(`   Empresa: ${job.company} | Local: ${job.location}`);

    const startTime = Date.now();
    const analysis = await classifier.classifyJob(job);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n🤖 RESULTADO DA IA GEMINI (${elapsed}s):`);
    console.log(`   🟢 Status do Inglês:       ${analysis.english_status}`);
    console.log(`   🇧🇷 Português Requerido:    ${analysis.portuguese_required ? 'SIM' : 'NÃO'} (Nível: ${analysis.portuguese_level})`);
    console.log(`   🌍 Aceita Brasileiros:     ${analysis.brazil_eligible ? 'SIM' : 'NÃO'}`);
    console.log(`   🏠 100% Remoto:            ${analysis.remote_eligible ? 'SIM' : 'NÃO'}`);
    console.log(`   🏷️  Categoria:              ${analysis.job_category}`);
    console.log(`   📊 Score de Compatibilidade: ${analysis.compatibility_score}/100 (Confiança: ${analysis.confidence}%)`);
    console.log(`   💬 Justificativa:          "${analysis.reason}"`);
  }

  console.log('\n================================================================');
  console.log('  TESTE DO GEMINI CLASSIFIER CONCLUÍDO COM SUCESSO!            ');
  console.log('================================================================');
}

testGeminiLive();
