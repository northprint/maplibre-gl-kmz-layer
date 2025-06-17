import { FeatureCollection } from 'geojson';
import { featureCollection } from '@turf/helpers';

// パフォーマンス最適化のオプション
export interface OptimizationOptions {
  maxFeatures?: number;              // 最大フィーチャー数
  simplifyTolerance?: number;        // 簡略化の許容誤差
  clusterPoints?: boolean;           // ポイントのクラスタリング
  clusterMaxZoom?: number;           // クラスタリングの最大ズーム
  clusterRadius?: number;            // クラスタリングの半径
  enableLOD?: boolean;               // Level of Detail有効化
  lodZoomLevels?: number[];          // LODのズームレベル
}

// パフォーマンス最適化クラス
export class PerformanceOptimizer {
  private options: OptimizationOptions;
  
  constructor(options: OptimizationOptions = {}) {
    this.options = {
      maxFeatures: 10000,
      simplifyTolerance: 0.0001,
      clusterPoints: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
      enableLOD: true,
      lodZoomLevels: [0, 7, 12, 16],
      ...options
    };
  }
  
  // フィーチャーコレクションを最適化
  optimizeFeatures(features: FeatureCollection): FeatureCollection {
    let optimizedFeatures = features.features;
    
    // フィーチャー数の制限
    if (this.options.maxFeatures && optimizedFeatures.length > this.options.maxFeatures) {
      console.warn(`フィーチャー数が制限値を超えています: ${optimizedFeatures.length} > ${this.options.maxFeatures}`);
      optimizedFeatures = this.prioritizeFeatures(optimizedFeatures, this.options.maxFeatures);
    }
    
    // ジオメトリの簡略化
    if (this.options.simplifyTolerance) {
      optimizedFeatures = optimizedFeatures.map(feature => {
        if (feature.geometry.type === 'LineString' || feature.geometry.type === 'Polygon') {
          return this.simplifyGeometry(feature, this.options.simplifyTolerance!);
        }
        return feature;
      });
    }
    
    // 元のプロパティを保持したままfeatureCollectionを作成
    const result = featureCollection(optimizedFeatures);
    // 元のメタデータがあれば保持
    if ((features as any).metadata) {
      (result as any).metadata = (features as any).metadata;
    }
    return result;
  }
  
  // 重要度に基づいてフィーチャーを優先順位付け
  private prioritizeFeatures(features: any[], maxCount: number): any[] {
    // 優先順位の計算（面積、長さ、プロパティなどに基づく）
    const scored = features.map(feature => {
      let score = 0;
      
      // ジオメトリタイプによるスコア
      if (feature.geometry.type === 'Polygon') {
        score += 3;
        // 簡易的な面積計算
        const coords = feature.geometry.coordinates[0];
        const area = this.calculatePolygonArea(coords);
        score += Math.log(area + 1);
      } else if (feature.geometry.type === 'LineString') {
        score += 2;
        // 簡易的な長さ計算
        const length = this.calculateLineLength(feature.geometry.coordinates);
        score += Math.log(length + 1);
      } else if (feature.geometry.type === 'Point') {
        score += 1;
      }
      
      // 名前があるフィーチャーを優先
      if (feature.properties?.name) {
        score += 2;
      }
      
      return { feature, score };
    });
    
    // スコアでソートして上位を選択
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxCount).map(item => item.feature);
  }
  
  // ポリゴンの面積を計算（簡易版）
  private calculatePolygonArea(coords: number[][]): number {
    let area = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const [x1, y1] = coords[i];
      const [x2, y2] = coords[i + 1];
      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area / 2);
  }
  
  // ラインの長さを計算（簡易版）
  private calculateLineLength(coords: number[][]): number {
    let length = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const [x1, y1] = coords[i];
      const [x2, y2] = coords[i + 1];
      length += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
    return length;
  }
  
  // ジオメトリを簡略化（Douglas-Peucker アルゴリズムの簡易版）
  private simplifyGeometry(feature: any, tolerance: number): any {
    // プロパティを含めてディープコピー
    const simplified = {
      type: feature.type,
      properties: { ...feature.properties }, // プロパティの完全なコピー
      geometry: { ...feature.geometry }
    };
    
    if (feature.geometry.type === 'LineString') {
      simplified.geometry = {
        ...feature.geometry,
        coordinates: this.simplifyCoordinates(feature.geometry.coordinates, tolerance)
      };
    } else if (feature.geometry.type === 'Polygon') {
      simplified.geometry = {
        ...feature.geometry,
        coordinates: feature.geometry.coordinates.map((ring: number[][]) =>
          this.simplifyCoordinates(ring, tolerance)
        )
      };
    }
    
    return simplified;
  }
  
  // 座標配列を簡略化
  private simplifyCoordinates(coords: number[][], tolerance: number): number[][] {
    if (coords.length <= 2) return coords;
    
    // 最初と最後の点は保持
    const simplified = [coords[0]];
    let prevPoint = coords[0];
    
    for (let i = 1; i < coords.length - 1; i++) {
      const currentPoint = coords[i];
      const distance = this.pointDistance(prevPoint, currentPoint);
      
      // 許容誤差より大きい場合のみ追加
      if (distance > tolerance) {
        simplified.push(currentPoint);
        prevPoint = currentPoint;
      }
    }
    
    // 最後の点を追加
    simplified.push(coords[coords.length - 1]);
    
    return simplified;
  }
  
  // 2点間の距離を計算
  private pointDistance(p1: number[], p2: number[]): number {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  // クラスタリング設定を生成
  generateClusteringConfig(): any {
    if (!this.options.clusterPoints) return null;
    
    return {
      cluster: true,
      clusterMaxZoom: this.options.clusterMaxZoom,
      clusterRadius: this.options.clusterRadius,
      clusterProperties: {
        count: ['+', 1]
      }
    };
  }
  
  // LOD設定を生成
  generateLODConfig(layerType: 'point' | 'line' | 'polygon'): any {
    if (!this.options.enableLOD || !this.options.lodZoomLevels) return {};
    
    const [minZoom, lowZoom, midZoom, highZoom] = this.options.lodZoomLevels;
    
    if (layerType === 'point') {
      return {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          minZoom, 3,
          lowZoom, 4,
          midZoom, 6,
          highZoom, 8
        ]
      };
    } else if (layerType === 'line') {
      return {
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          minZoom, 0.5,
          lowZoom, 1,
          midZoom, 2,
          highZoom, 3
        ]
      };
    } else if (layerType === 'polygon') {
      return {
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          minZoom, 0.3,
          lowZoom, 0.4,
          midZoom, 0.5,
          highZoom, 0.6
        ]
      };
    }
    
    return {};
  }
  
  // メモリ使用量を推定
  estimateMemoryUsage(features: FeatureCollection): number {
    let bytes = 0;
    
    features.features.forEach(feature => {
      // ジオメトリのサイズを推定
      const geomString = JSON.stringify(feature.geometry);
      bytes += geomString.length * 2; // 文字列は約2バイト/文字
      
      // プロパティのサイズを推定
      const propsString = JSON.stringify(feature.properties || {});
      bytes += propsString.length * 2;
      
      // オーバーヘッド
      bytes += 100;
    });
    
    return bytes;
  }
  
  // 推奨設定を生成
  static generateRecommendedOptions(featureCount: number): OptimizationOptions {
    const options: OptimizationOptions = {};
    
    if (featureCount > 50000) {
      // 非常に大規模
      options.maxFeatures = 20000;
      options.simplifyTolerance = 0.001;
      options.clusterPoints = true;
      options.clusterRadius = 80;
      options.enableLOD = true;
    } else if (featureCount > 10000) {
      // 大規模
      options.maxFeatures = 30000;
      options.simplifyTolerance = 0.0005;
      options.clusterPoints = true;
      options.clusterRadius = 60;
      options.enableLOD = true;
    } else if (featureCount > 5000) {
      // 中規模
      options.simplifyTolerance = 0.0001;
      options.clusterPoints = true;
      options.clusterRadius = 40;
    }
    
    return options;
  }
}