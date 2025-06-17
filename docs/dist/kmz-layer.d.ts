import type { Map as MaplibreMap } from 'maplibre-gl';
import { KMZLayerOptions, KMZParseResult } from './types';
export declare class KMZLayer {
    private map;
    private parser;
    private networkLinkManager;
    private iconManager;
    private performanceOptimizer;
    private options;
    private sourceId;
    private layerIds;
    private parseResult;
    private imageMissingHandler;
    constructor(options: KMZLayerOptions);
    addTo(map: MaplibreMap): Promise<void>;
    private processIcons;
    private createDefaultMarker;
    private createLayers;
    show(): void;
    hide(): void;
    toggle(): void;
    private setupImageMissingHandler;
    remove(): void;
    private updateData;
    getData(): KMZParseResult | null;
    zoomToFeature(featureId: number): void;
}
//# sourceMappingURL=kmz-layer.d.ts.map