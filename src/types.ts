import type { FeatureCollection, Geometry } from 'geojson';

// KMLのスタイル定義
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

// KMLの要素
export interface KMLPlacemark {
  name?: string;
  description?: string;
  styleUrl?: string;
  geometry?: Geometry;
  properties?: Record<string, any>;
}

// パース結果
export interface KMZParseResult {
  features: FeatureCollection;
  styles: Record<string, KMLStyle>;
  metadata?: {
    name?: string;
    description?: string;
    author?: string;
  };
}

// NetworkLink情報
export interface KMLNetworkLink {
  name?: string;
  description?: string;
  href: string;
  refreshMode?: 'onChange' | 'onInterval' | 'onExpire';
  refreshInterval?: number;
  viewRefreshMode?: 'never' | 'onStop' | 'onRequest' | 'onRegion';
  viewRefreshTime?: number;
}

// レイヤーオプション
export interface KMZLayerOptions {
  id: string;
  url?: string;
  data?: ArrayBuffer | Blob;
  visible?: boolean;
  minzoom?: number;
  maxzoom?: number;
  onLoad?: (data: KMZParseResult) => void;
  onError?: (error: Error) => void;
  followNetworkLinks?: boolean; // NetworkLinkを自動的に読み込むか
  networkLinkOptions?: {
    maxDepth?: number; // NetworkLinkの最大深度
    refreshInterval?: number; // 更新間隔（ミリ秒）
  };
  optimization?: {
    enabled?: boolean; // 最適化を有効化
    maxFeatures?: number; // 最大フィーチャー数
    simplifyTolerance?: number; // 簡略化の許容誤差
    clusterPoints?: boolean; // ポイントのクラスタリング
    clusterRadius?: number; // クラスタリング半径
    enableLOD?: boolean; // Level of Detail
  };
}