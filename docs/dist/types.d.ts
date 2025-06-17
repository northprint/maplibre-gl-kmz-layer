import type { FeatureCollection, Geometry } from 'geojson';
export interface KMLStyle {
    id?: string;
    color?: string;
    width?: number;
    fill?: boolean;
    fillColor?: string;
    opacity?: number;
    icon?: string;
    scale?: number;
}
export interface KMLPlacemark {
    name?: string;
    description?: string;
    styleUrl?: string;
    geometry?: Geometry;
    properties?: Record<string, any>;
}
export interface KMZParseResult {
    features: FeatureCollection;
    styles: Record<string, KMLStyle>;
    metadata?: {
        name?: string;
        description?: string;
        author?: string;
    };
}
export interface KMLNetworkLink {
    name?: string;
    description?: string;
    href: string;
    refreshMode?: 'onChange' | 'onInterval' | 'onExpire';
    refreshInterval?: number;
    viewRefreshMode?: 'never' | 'onStop' | 'onRequest' | 'onRegion';
    viewRefreshTime?: number;
}
export interface KMZLayerOptions {
    id: string;
    url?: string;
    data?: ArrayBuffer | Blob;
    visible?: boolean;
    minzoom?: number;
    maxzoom?: number;
    onLoad?: (data: KMZParseResult) => void;
    onError?: (error: Error) => void;
    followNetworkLinks?: boolean;
    networkLinkOptions?: {
        maxDepth?: number;
        refreshInterval?: number;
    };
    optimization?: {
        enabled?: boolean;
        maxFeatures?: number;
        simplifyTolerance?: number;
        clusterPoints?: boolean;
        clusterRadius?: number;
        enableLOD?: boolean;
    };
}
//# sourceMappingURL=types.d.ts.map