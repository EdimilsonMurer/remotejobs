import { SourceConnector } from './base/source-connector';
import { WelocalizeConnector } from './welocalize';
import { TuringConnector } from './turing';
import { OutlierConnector } from './outlier';

export class ConnectorRegistry {
  private static instance: ConnectorRegistry;
  private connectors: Map<string, SourceConnector> = new Map();

  private constructor() {
    this.register(new WelocalizeConnector());
    this.register(new TuringConnector());
    this.register(new OutlierConnector());
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

  public getAllConnectors(): SourceConnector[] {
    return Array.from(this.connectors.values());
  }
}
