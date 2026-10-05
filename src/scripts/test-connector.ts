import { ConnectorRegistry } from '../connectors/registry';

async function runTest() {
  console.log('====================================================');
  console.log('  TESTE DO PIPELINE DE COLETORES - REMOTEJOBS PT   ');
  console.log('====================================================\n');

  const registry = ConnectorRegistry.getInstance();
  const connectors = registry.getAllConnectors();

  console.log(`📡 Conectores registrados: ${connectors.length}\n`);

  for (const connector of connectors) {
    console.log(`----------------------------------------------------`);
    console.log(`🔍 Testando Conector: [${connector.name}] (${connector.slug})`);
    console.log(`🌐 URL da Fonte: ${connector.jobsUrl}`);

    const startTime = Date.now();
    try {
      const status = await connector.getSourceStatus();
      console.log(`🩺 Status: ${status.status} | ${status.message}`);

      console.log(`📥 Coletando e normalizando vagas...`);
      const jobs = await connector.collect();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`✅ Coleta concluída em ${elapsed}s:`);
      console.log(`   - Vagas coletadas e válidas: ${jobs.length}`);

      // Amostra de vagas relevantes para PT/BR
      const ptBrJobs = jobs.filter(j => 
        j.title.toLowerCase().includes('portuguese') ||
        j.title.toLowerCase().includes('brazil') ||
        j.location.toLowerCase().includes('brazil') ||
        j.country === 'Brasil' ||
        j.description.toLowerCase().includes('portuguese')
      );

      console.log(`   - Vagas com sinais de Português / Brasil: ${ptBrJobs.length}`);

      if (ptBrJobs.length > 0) {
        console.log(`\n📄 Exemplo de Vaga Coletada (PT/BR):`);
        const sample = ptBrJobs[0];
        console.log(`   ID Externo: ${sample.external_id}`);
        console.log(`   Título:     ${sample.title}`);
        console.log(`   Empresa:    ${sample.company}`);
        console.log(`   Local:      ${sample.location} (País: ${sample.country})`);
        console.log(`   Remoto:     ${sample.remote ? 'Sim' : 'Não'}`);
        console.log(`   URL Oficial:${sample.url}`);
        console.log(`   Descrição:  ${sample.description.substring(0, 160)}...`);
      } else if (jobs.length > 0) {
        console.log(`\n📄 Exemplo de Vaga Geral:`);
        const sample = jobs[0];
        console.log(`   Título: ${sample.title} (${sample.location})`);
      }
    } catch (err: any) {
      console.error(`❌ Erro no conector ${connector.slug}:`, err.message);
    }
  }

  console.log('\n====================================================');
  console.log('  TESTE DE CONECTORES FINALIZADO COM SUCESSO        ');
  console.log('====================================================');
}

runTest();
