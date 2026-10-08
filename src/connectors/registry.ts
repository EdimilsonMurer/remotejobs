import { SourceConnector } from './base/source-connector';
import { WelocalizeConnector } from './welocalize';
import { TuringConnector } from './turing';
import { OutlierConnector } from './outlier';
import { MercorConnector } from './mercor';
import { GenericDynamicConnector } from './generic';
import { INITIAL_PLATFORMS } from '../data/initialPlatforms';

export class ConnectorRegistry {
  private static instance: ConnectorRegistry;
  private connectors: Map<string, SourceConnector> = new Map();

  private constructor() {
    // 1. Registra conectores especializados oficiais
    this.register(new WelocalizeConnector());
    this.register(new TuringConnector());
    this.register(new OutlierConnector());
    this.register(new MercorConnector());

    // 2. Registra dinamicamente conectores para a base inicial e local
    this.loadAndRegisterAllPlatforms();
  }

  public registerPlatform(p: { id: string; name: string; websiteUrl?: string; careersUrl?: string; category?: string; currency?: string; averagePayRate?: string }) {
    const slug = (p.id || p.name).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const url = (p.careersUrl || p.websiteUrl || '').toLowerCase();

    // Se for Mercor, assegura o conector dedicado da Mercor
    if (slug === 'mercor' || url.includes('mercor.com')) {
      if (!this.connectors.has('mercor')) {
        this.register(new MercorConnector());
      }
      this.connectors.set(slug, this.connectors.get('mercor')!);
      return;
    }

    if (!this.connectors.has(slug)) {
      this.register(new GenericDynamicConnector({
        name: p.name,
        slug: slug,
        websiteUrl: p.websiteUrl || 'https://',
        jobsUrl: p.careersUrl || p.websiteUrl || 'https://',
        category: p.category,
        currency: p.currency,
        averagePayRate: p.averagePayRate
      }));
    }
  }

  public registerPlatforms(platforms: any[]) {
    if (!Array.isArray(platforms)) return;
    for (const p of platforms) {
      if (p && (p.id || p.name)) {
        this.registerPlatform(p);
      }
    }
  }

  private loadAndRegisterAllPlatforms(extraPlatforms?: any[]) {
    let list: any[] = [...INITIAL_PLATFORMS];
    if (Array.isArray(extraPlatforms)) {
      list = [...list, ...extraPlatforms];
    }

    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('remotehunter_platforms_v1') || localStorage.getItem('remotehunter_platforms_v2');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = [...list, ...parsed];
          }
        }
      }
    } catch {}

    for (const p of list) {
      this.registerPlatform(p);
    }
  }

  public static getInstance(): ConnectorRegistry {
    if (!ConnectorRegistry.instance) {
      ConnectorRegistry.instance = new ConnectorRegistry();
    }
    return ConnectorRegistry.instance;
  }

  public register(connector: SourceConnector): void {
    this.connectors.set(connector.slug, connector);
  }

  public getConnector(slug: string): SourceConnector | undefined {
    return this.connectors.get(slug);
  }

  public getAllConnectors(extraPlatforms?: any[]): SourceConnector[] {
    if (extraPlatforms) {
      this.registerPlatforms(extraPlatforms);
    }
    return Array.from(this.connectors.values());
  }
}
