import { ConnectorRegistry } from '../connectors/registry';
import { DeduplicationEngine } from '../pipeline/deduplicator';
import { runPreFilter } from '../pipeline/pre-filter';
import { GeminiClassifier } from '../pipeline/gemini-classifier';
import { getSupabaseServerClient } from '../lib/supabase/server';
import * as fs from 'fs';
import * as path from 'path';

export async function runIngestionPipeline() {
  console.log('================================================================');
  console.log('   PIPELINE DE INGESTÃO AUTOMATIZADA - REMOTEJOBS PT           ');
  console.log(`   Horário de Início: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  const registry = ConnectorRegistry.getInstance();
  const connectors = registry.getAllConnectors();
  const deduplicator = new DeduplicationEngine();
  const classifier = new GeminiClassifier();

  // Verifica se há cliente Supabase ativo
  let supabaseClient: any = null;
  try {
    supabaseClient = getSupabaseServerClient();
    console.log('🔌 Conectado ao Supabase (Service Role ativo)');
  } catch {
    console.log('ℹ️  Supabase em modo offline/local: os resultados processados serão salvos em cache local.');
  }

  const processedJobsForCache: any[] = [];

  for (const connector of connectors) {
    const startedAt = new Date().toISOString();
    console.log(`\n▶️  Iniciando conector: [${connector.name}] (${connector.slug})`);

    let jobsFound = 0;
    let jobsNew = 0;
    let jobsUpdated = 0;
    let jobsRejected = 0;
    let errorMessage: string | null = null;

    try {
      const rawJobs = await connector.collect();
      jobsFound = rawJobs.length;
      console.log(`   Vagas brutas encontradas: ${jobsFound}`);

      // Executa deduplicação e pré-filtro
      for (const job of rawJobs) {
        const decision = deduplicator.evaluate(job);

        if (decision.action === 'UPDATE_LAST_SEEN') {
          jobsUpdated++;
          continue;
        }

        if (decision.action === 'DUPLICATE_CROSS_SOURCE') {
          jobsRejected++;
          continue;
        }

        // Vaga inédita ou com descrição alterada: avalia no pré-filtro
        const preFilter = runPreFilter(job);
        if (!preFilter.shouldSendToGemini) {
          jobsRejected++;
          continue;
        }

        jobsNew++;

        // Apenas vagas prioritárias são enviadas ao Gemini em lote
        if (preFilter.priority === 'HIGH' || preFilter.priority === 'MEDIUM') {
          console.log(`   🤖 Analisando com Gemini: "${job.title.substring(0, 45)}..."`);
          const analysis = await classifier.classifyJob(job);

          processedJobsForCache.push({
            ...job,
            analysis
          });

          // Se o Supabase estiver conectado, persiste no banco relacional
          if (supabaseClient) {
            try {
              // 1. Obtém platform_id
              const { data: platformData } = await supabaseClient
                .from('platforms')
                .select('id')
                .eq('slug', job.platform_slug)
                .single();

              if (platformData) {
                // 2. Insere vaga
                const { data: insertedJob } = await supabaseClient
                  .from('jobs')
                  .upsert({
                    platform_id: platformData.id,
                    external_id: job.external_id,
                    title: job.title,
                    company: job.company,
                    url: job.url,
                    canonical_url: job.canonical_url,
                    source_url: job.source_url,
                    description: job.description,
                    description_hash: decision.description_hash,
                    country: job.country,
                    location: job.location,
                    remote: job.remote,
                    employment_type: job.employment_type,
                    status: 'ACTIVE'
                  }, { onConflict: 'platform_id,external_id' })
                  .select()
                  .single();

                // 3. Insere análise
                if (insertedJob) {
                  await supabaseClient
                    .from('job_analysis')
                    .upsert({
                      job_id: insertedJob.id,
                      english_status: analysis.english_status,
                      portuguese_required: analysis.portuguese_required,
                      portuguese_level: analysis.portuguese_level,
                      brazil_eligible: analysis.brazil_eligible,
                      remote_eligible: analysis.remote_eligible,
                      job_category: analysis.job_category,
                      experience_level: analysis.experience_level,
                      salary_detected: analysis.salary_detected,
                      salary_min: analysis.salary_min,
                      salary_max: analysis.salary_max,
                      salary_currency: analysis.salary_currency,
                      compatibility_score: analysis.compatibility_score,
                      confidence: analysis.confidence,
                      reason: analysis.reason
                    }, { onConflict: 'job_id' });
                }
              }
            } catch (dbErr: any) {
              console.warn(`   ⚠️ Erro ao salvar vaga no Supabase: ${dbErr.message}`);
            }
          }
        }
      }

      console.log(`   ✅ Concluído: ${jobsNew} novas analisadas, ${jobsUpdated} atualizadas, ${jobsRejected} descartadas.`);
    } catch (err: any) {
      errorMessage = err.message;
      console.error(`   ❌ Falha na coleta de ${connector.slug}:`, errorMessage);
    }
  }

  // Se coletou vagas com análise, salva um snapshot estático para alimentar a interface
  if (processedJobsForCache.length > 0) {
    const dataDir = path.resolve(process.cwd(), 'src/data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const targetFile = path.join(dataDir, 'liveCuratedJobs.json');
    fs.writeFileSync(targetFile, JSON.stringify(processedJobsForCache, null, 2), 'utf-8');
    console.log(`\n💾 Snapshot de ${processedJobsForCache.length} vagas com análise Gemini salvo em: src/data/liveCuratedJobs.json`);
  }

  console.log('\n================================================================');
  console.log('   PIPELINE FINALIZADO COM SUCESSO!                             ');
  console.log('================================================================');
}

// Executa se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runIngestionPipeline();
}
