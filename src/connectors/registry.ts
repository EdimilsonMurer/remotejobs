import { SourceConnector } from './base/source-connector';
import { WelocalizeConnector } from './welocalize';
import { TuringConnector } from './turing';
import { OutlierConnector } from './outlier';
import { GenericDynamicConnector } from './generic';
import { INITIAL_PLATFORMS } from '../data/initialPlatforms';

export class ConnectorRegistry {
  private static instance: ConnectorRegistry;
  private connectors: Map<string, SourceConnector> = new Map();

  private constructor() {
    // 1. Registra conectores especializados
    this.register(new WelocalizeConnector());
    this.register(new TuringConnector());
    this.register(new OutlierConnector());

    // 2. Registra dinamicamente conectores genéricos/específicos para TODAS as plataformas cadastradas (incluindo Mercor, Alignerr, Clickworker, etc.)
    this.loadAndRegisterAllPlatforms();
  }

  private loadAndRegisterAllPlatforms() {
    let list = INITIAL_PLATFORMS;
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('remotehunter_platforms_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
          }
        }
      }
    } catch {}

    for (const p of list) {
      const slug = p.id.toLowerCase().replace(/[^a-z0-9]/g, '-');
      // Se ainda não tiver conector dedicado, cria um conector dinâmico
      if (!this.connectors.has(slug)) {
        this.register(new GenericDynamicConnector({
          name: p.name,
          slug: slug,
          websiteUrl: p.websiteUrl,
          jobsUrl: p.careersUrl || p.websiteUrl,
          category: p.category,
          currency: p.currency,
          averagePayRate: p.averagePayRate
        }));
      }
    }
  }

  public static getInstance(): ConnectorRegistry {
    if (!ConnectorRegistry.instance) {
      ConnectorRegistry.instance = new ConnectorRegistry();
    } else {
      // Atualiza dinamicamente caso novas plataformas tenham sido adicionadas
      ConnectorRegistry.instance.loadAndRegisterAllPlatforms();
    }
    return ConnectorRegistry.instance;
  }

  public register(connector: SourceConnector): void {
    this.connectors.set(connector.slug, connector);
  }

  public getConnector(slug: string): SourceConnector | undefined {
    return this.connectors.get(slug);
  }

  public getAllConnectors(): SourceConnector[] {
    this.loadAndRegisterAllPlatforms();
    return Array.from(this.connectors.values());
  }
}
