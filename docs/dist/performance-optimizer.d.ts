import { FeatureCollection } from 'geojson';
export interface OptimizationOptions {
    maxFeatures?: number;
    simplifyTolerance?: number;
    clusterPoints?: boolean;
    clusterMaxZoom?: number;
    clusterRadius?: number;
    enableLOD?: boolean;
    lodZoomLevels?: number[];
}
export declare class PerformanceOptimizer {
    private options;
    constructor(options?: OptimizationOptions);
    optimizeFeatures(features: FeatureCollection): FeatureCollection;
    private prioritizeFeatures;
    private calculatePolygonArea;
    private calculateLineLength;
    private simplifyGeometry;
    private simplifyCoordinates;
    private pointDistance;
    generateClusteringConfig(): any;
    generateLODConfig(layerType: 'point' | 'line' | 'polygon'): any;
    estimateMemoryUsage(features: FeatureCollection): number;
    static generateRecommendedOptions(featureCount: number): OptimizationOptions;
}
//# sourceMappingURL=performance-optimizer.d.ts.map