import { WelocalizeConnector } from '../connectors/welocalize';
import { TuringConnector } from '../connectors/turing';
import { OutlierConnector } from '../connectors/outlier';
import { GeminiClassifier } from '../pipeline/gemini-classifier';
import { runPreFilter } from '../pipeline/pre-filter';
import * as fs from 'fs';
import * as path from 'path';

async function seedLiveCache() {
  console.log('--- COLETANDO VAGAS REAIS PARA O SNAPSHOT DE DADOS DO FRONTEND ---');
  
  const welocalize = new WelocalizeConnector();
  const turing = new TuringConnector();
  const outlier = new OutlierConnector();

  const [wJobs, tJobs, oJobs] = await Promise.all([
    welocalize.collect(),
    turing.collect(),
    outlier.collect()
  ]);

  console.log(`Coletadas: Welocalize (${wJobs.length}), Turing (${tJobs.length}), Outlier (${oJobs.length})`);

  // Filtra vagas prioritárias para o Brasil
  const ptJobs = [
    ...wJobs.filter(j => runPreFilter(j).priority === 'HIGH'),
    ...tJobs.filter(j => runPreFilter(j).hasPortugueseSignal || j.location.includes('Brazil') || j.location.includes('São Paulo')),
    ...oJobs
  ];

  console.log(`Total de vagas com relevância para o público brasileiro: ${ptJobs.length}`);

  const classifier = new GeminiClassifier();
  const curatedResults: any[] = [];

  // Analisa as primeiras 8 vagas mais relevantes com o Gemini
  const targetSample = ptJobs.slice(0, 10);
  console.log(`Enviando ${targetSample.length} vagas selecionadas para classificação pela IA...`);

  for (let i = 0; i < targetSample.length; i++) {
    const job = targetSample[i];
    console.log(`[${i + 1}/${targetSample.length}] Analisando: ${job.title}...`);
    try {
      const analysis = await classifier.classifyJob(job);
      curatedResults.push({
        ...job,
        analysis
      });
      // Pequena pausa
      await new Promise(r => setTimeout(r, 800));
    } catch (err: any) {
      console.warn(`Erro na análise: ${err.message}`);
    }
  }

  const dataDir = path.resolve(process.cwd(), 'src/data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filePath = path.join(dataDir, 'liveCuratedJobs.json');
  fs.writeFileSync(filePath, JSON.stringify(curatedResults, null, 2), 'utf-8');
  console.log(`✅ ${curatedResults.length} vagas reais com classificação completa salvas em ${filePath}!`);
}

seedLiveCache();
