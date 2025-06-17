import { KMLNetworkLink, KMZParseResult } from './types';
import { KMZParser } from './kmz-parser';
export declare class NetworkLinkManager {
    private parser;
    private activeLinks;
    constructor(parser: KMZParser);
    extractNetworkLinks(doc: any): KMLNetworkLink[];
    private parseNetworkLink;
    loadNetworkLink(link: KMLNetworkLink, baseUrl?: string): Promise<KMZParseResult>;
    startAutoRefresh(link: KMLNetworkLink, baseUrl?: string, onUpdate?: (data: KMZParseResult) => void): void;
    stopAutoRefresh(linkId: string): void;
    stopAllAutoRefresh(): void;
    loadWithNetworkLinks(initialData: KMZParseResult, doc: any, baseUrl?: string, maxDepth?: number, currentDepth?: number): Promise<KMZParseResult>;
}
//# sourceMappingURL=network-link-manager.d.ts.map