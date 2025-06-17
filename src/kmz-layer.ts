import type { Map as MaplibreMap } from 'maplibre-gl';
import { KMZParser } from './kmz-parser';
import { NetworkLinkManager } from './network-link-manager';
import { IconManager } from './icon-manager';
import { PerformanceOptimizer } from './performance-optimizer';
import { KMZLayerOptions, KMZParseResult } from './types';
import { featureCollection } from '@turf/helpers';
import { findSimilarIcon, getNearestIconSize } from './default-icon-mapping';
import { selectIconByColorAndId, abgrToHex } from './color-based-icon-selector';

export class KMZLayer {
  private map: MaplibreMap | null = null;
  private parser: KMZParser;
  private networkLinkManager: NetworkLinkManager;
  private iconManager: IconManager | null = null;
  private performanceOptimizer: PerformanceOptimizer | null = null;
  private options: KMZLayerOptions;
  private sourceId: string;
  private layerIds: string[] = [];
  private parseResult: KMZParseResult | null = null;
  private imageMissingHandler: ((e: any) => void) | null = null;
  
  constructor(options: KMZLayerOptions) {
    this.options = options;
    this.sourceId = `${options.id}-source`;
    this.parser = new KMZParser();
    this.networkLinkManager = new NetworkLinkManager(this.parser);
  }
  
  // レイヤーをマップに追加
  async addTo(map: MaplibreMap): Promise<void> {
    this.map = map;
    this.iconManager = new IconManager(map);
    
    // 画像が見つからない場合のイベントハンドラを設定
    this.setupImageMissingHandler();
    
    try {
      // データを読み込み
      let data: ArrayBuffer | Blob;
      
      if (this.options.url) {
        const response = await fetch(this.options.url);
        if (!response.ok) {
          throw new Error(`ファイルの読み込みに失敗しました: ${response.statusText}`);
        }
        data = await response.arrayBuffer();
      } else if (this.options.data) {
        data = this.options.data;
      } else {
        throw new Error('URLまたはdataオプションが必要です');
      }
      
      // KMZをパース
      this.parseResult = await this.parser.parseKMZ(data);
      
      // デバッグ：パース結果を確認
      console.log('KMZ parse result:', {
        featureCount: this.parseResult.features.features.length,
        styles: Object.keys(this.parseResult.styles),
        features: this.parseResult.features.features.map(f => ({
          type: f.geometry.type,
          name: f.properties?.name,
          hasStyle: !!f.properties?._style,
          styleId: f.properties?._style?.id,
          hasIcon: !!f.properties?._style?.icon,
          coordinates: (f.geometry as any).coordinates
        }))
      });
      
      // NetworkLinkの処理
      if (this.options.followNetworkLinks) {
        const doc = this.parser.getLastDocument();
        if (doc) {
          const maxDepth = this.options.networkLinkOptions?.maxDepth || 3;
          this.parseResult = await this.networkLinkManager.loadWithNetworkLinks(
            this.parseResult,
            doc,
            this.options.url,
            maxDepth
          );
          
          // 自動更新を設定
          const networkLinks = this.networkLinkManager.extractNetworkLinks(doc);
          networkLinks.forEach(link => {
            if (link.refreshMode === 'onInterval') {
              this.networkLinkManager.startAutoRefresh(link, this.options.url, (newData) => {
                this.updateData(newData);
              });
            }
          });
        }
      }
      
      // パース結果のデバッグ
      console.log('Parse result features count:', this.parseResult.features.features.length);
      const sampleFeatures = this.parseResult.features.features.slice(0, 3);
      console.log('Sample features before optimization:', sampleFeatures.map(f => ({
        name: f.properties?.name,
        _style: f.properties?._style,
        hasStyle: f.properties && '_style' in f.properties
      })));
      
      // パフォーマンス最適化
      if (this.options.optimization?.enabled || this.options.optimization?.clusterPoints) {
        // 推奨設定を使用するか、カスタム設定を使用
        const featureCount = this.parseResult.features.features.length;
        const optimizationOptions = this.options.optimization || 
          PerformanceOptimizer.generateRecommendedOptions(featureCount);
        
        this.performanceOptimizer = new PerformanceOptimizer(optimizationOptions);
        
        // フィーチャーを最適化（enabledの場合のみ）
        if (this.options.optimization?.enabled) {
          this.parseResult.features = this.performanceOptimizer.optimizeFeatures(this.parseResult.features);
          
          // メモリ使用量をログ出力
          const memoryUsage = this.performanceOptimizer.estimateMemoryUsage(this.parseResult.features);
          console.log(`推定メモリ使用量: ${(memoryUsage / 1024 / 1024).toFixed(2)} MB`);
        }
      }
      
      // アイコンを処理
      await this.processIcons();
      
      // ソースを追加（クラスタリング設定を含む）
      const sourceConfig: any = {
        type: 'geojson',
        data: this.parseResult.features
      };
      
      // クラスタリング設定を追加
      if (this.performanceOptimizer) {
        const clusterConfig = this.performanceOptimizer.generateClusteringConfig();
        if (clusterConfig) {
          Object.assign(sourceConfig, clusterConfig);
          console.log('Clustering config applied:', clusterConfig);
        }
      }
      
      console.log('Source config:', sourceConfig);
      this.map.addSource(this.sourceId, sourceConfig);
      
      // レイヤーを作成
      this.createLayers();
      
      // コールバックを実行
      if (this.options.onLoad) {
        this.options.onLoad(this.parseResult);
      }
    } catch (error) {
      if (this.options.onError) {
        this.options.onError(error as Error);
      } else {
        throw error;
      }
    }
  }
  
  // アイコンを処理
  private async processIcons(): Promise<void> {
    if (!this.parseResult || !this.iconManager) return;
    
    // デフォルトマーカーを事前に作成
    const defaultMarkerId = `${this.options.id}-default-marker`;
    await this.createDefaultMarker(defaultMarkerId);
    
    // スタイルからアイコンURLを収集
    const iconUrls = new Set<string>();
    Object.values(this.parseResult.styles).forEach(style => {
      if (style.icon) {
        iconUrls.add(style.icon);
      }
    });
    
    // KMZ内のアイコンを抽出（zipが存在する場合）
    const zip = (this.parseResult as any)._zip;
    if (zip) {
      console.log('KMZからアイコンを抽出中...');
      console.log('要求されたアイコンURL:', Array.from(iconUrls));
      const icons = await this.iconManager.extractIconsFromKMZ(zip, Array.from(iconUrls));
      console.log(`抽出されたアイコン: ${icons.size}個`);
      
      // 抽出されたアイコンの詳細を表示
      icons.forEach((dataUrl, iconUrl) => {
        console.log(`✅ 抽出成功: ${iconUrl} (データサイズ: ${dataUrl.length}文字)`);
      });
      
      // アイコンをマップに追加
      for (const [styleId, style] of Object.entries(this.parseResult.styles)) {
        console.log(`Processing style ${styleId}:`, style);
        if (style.icon) {
          const iconId = `${this.options.id}-icon-${styleId.replace('#', '')}`;
          const scale = style.scale || 1;
          
          if (icons.has(style.icon)) {
            // KMZ内のアイコンを使用
            console.log(`Found icon in KMZ for style ${styleId}: ${style.icon}`);
            await this.iconManager.addIconToMap(iconId, icons.get(style.icon)!, scale);
            (style as any)._iconId = iconId;
          } else {
            // 外部URLのアイコンを試す
            try {
              console.log(`Trying external icon for style ${styleId}: ${style.icon}`);
              const dataUrl = await this.iconManager.loadExternalIcon(style.icon);
              if (dataUrl) {
                await this.iconManager.addIconToMap(iconId, dataUrl, scale);
                (style as any)._iconId = iconId;
              } else {
                // アイコンが見つからない場合は、スタイルIDとカラーから適切なアイコンを選択
                console.log(`Icon not found for style ${styleId}, selecting by color and ID`);
                
                // カラーコードを取得（KMLのABGR形式をHEXに変換）
                const colorHex = style.color ? abgrToHex(style.color) : undefined;
                const selectedIcon = selectIconByColorAndId(styleId, colorHex);
                
                // 選択されたアイコンを試す
                const iconSize = getNearestIconSize(24 * (scale || 1));
                const makiIconId = `${selectedIcon}-${iconSize}`;
                
                if (this.map && this.map.hasImage(makiIconId)) {
                  (style as any)._iconId = makiIconId;
                  console.log(`カラーベースでアイコンを選択: ${styleId} (${colorHex}) → ${makiIconId}`);
                } else if (this.map && this.map.hasImage(selectedIcon)) {
                  (style as any)._iconId = selectedIcon;
                  console.log(`カラーベースでアイコンを選択: ${styleId} (${colorHex}) → ${selectedIcon}`);
                } else {
                  // それでも見つからない場合は汎用的なアイコンを試す
                  const genericIcons = ['marker', 'circle', 'marker-15', 'circle-15'];
                  let foundIcon = false;
                  
                  for (const icon of genericIcons) {
                    if (this.map && this.map.hasImage(icon)) {
                      (style as any)._iconId = icon;
                      console.log(`汎用アイコンを使用: ${styleId} → ${icon}`);
                      foundIcon = true;
                      break;
                    }
                  }
                  
                  if (!foundIcon) {
                    // 最終的にデフォルトマーカーを使用
                    console.log(`No suitable icon found for ${styleId}, using default marker`);
                    (style as any)._iconId = defaultMarkerId;
                  }
                }
              }
            } catch (error) {
              console.warn(`アイコンの読み込みに失敗: ${style.icon}`, error);
              // カラーベースでアイコンを選択
              const colorHex = style.color ? abgrToHex(style.color) : undefined;
              const selectedIcon = selectIconByColorAndId(styleId, colorHex);
              
              if (this.map && (this.map.hasImage(selectedIcon) || this.map.hasImage(`${selectedIcon}-15`))) {
                (style as any)._iconId = this.map.hasImage(`${selectedIcon}-15`) ? `${selectedIcon}-15` : selectedIcon;
                console.log(`エラー時にカラーベースでアイコンを選択: ${styleId} → ${(style as any)._iconId}`);
              } else {
                (style as any)._iconId = defaultMarkerId;
              }
            }
          }
        } else {
          console.log(`Style ${styleId} has no icon`);
        }
      }
    }
  }
  
  // デフォルトマーカーを作成
  private async createDefaultMarker(markerId: string): Promise<void> {
    if (!this.map) return;
    
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // グラデーション付きの円形マーカーを描画
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, '#FF6B6B');
      gradient.addColorStop(0.8, '#FF5252');
      gradient.addColorStop(1, '#E53935');
      
      ctx.fillStyle = gradient;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
      
      // 円を描画
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // 中央に小さな白い円
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // 画像として追加
      const imageData = ctx.getImageData(0, 0, size, size);
      this.map.addImage(markerId, imageData);
    }
  }
  
  // レイヤーを作成
  private createLayers(): void {
    if (!this.map || !this.parseResult) return;
    
    // クラスタリングレイヤー（有効な場合）
    if (this.options.optimization?.clusterPoints) {
      const clusterLayerId = `${this.options.id}-clusters`;
      this.map.addLayer({
        id: clusterLayerId,
        type: 'circle',
        source: this.sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#51bbd6',
            10, '#f1f075',
            50, '#f28cb1'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            15,
            10, 20,
            50, 25
          ]
        },
        ...(this.options.minzoom !== undefined ? { minzoom: this.options.minzoom } : {}),
        ...(this.options.maxzoom !== undefined ? { maxzoom: this.options.maxzoom } : {})
      });
      this.layerIds.push(clusterLayerId);
      
      // クラスターカウントラベル
      const clusterCountLayerId = `${this.options.id}-cluster-count`;
      this.map.addLayer({
        id: clusterCountLayerId,
        type: 'symbol',
        source: this.sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        ...(this.options.minzoom !== undefined ? { minzoom: this.options.minzoom } : {}),
        ...(this.options.maxzoom !== undefined ? { maxzoom: this.options.maxzoom } : {})
      });
      this.layerIds.push(clusterCountLayerId);
    }
    
    // アイコンポイントレイヤー
    const iconPointLayerId = `${this.options.id}-icon-points`;
    
    // デバッグ：フィーチャーのプロパティを確認
    const sampleFeatures = this.parseResult.features.features.slice(0, 3);
    console.log('Sample feature properties:', sampleFeatures.map(f => ({
      name: f.properties?.name,
      style: f.properties?._style,
      styleId: f.properties?._style?.id,
      iconId: f.properties?._style?._iconId,
      geometry: f.geometry?.type
    })));
    
    // 最初のポイントフィーチャーを詳しく見る
    const firstPoint = this.parseResult.features.features.find(f => f.geometry?.type === 'Point');
    if (firstPoint) {
      console.log('First point feature:', firstPoint);
      console.log('First point properties:', firstPoint.properties);
      console.log('First point style:', firstPoint.properties?._style);
    }
    
    this.map.addLayer({
      id: iconPointLayerId,
      type: 'symbol',
      source: this.sourceId,
      filter: ['all',
        ['==', ['geometry-type'], 'Point'],
        ['!=', ['typeof', ['get', '_style']], 'null'],
        ['has', '_iconId', ['get', '_style']],
        ...(this.options.optimization?.clusterPoints ? [['!', ['has', 'point_count']]] : [])
      ] as any,
      layout: {
        'icon-image': ['get', '_iconId', ['get', '_style']],
        'icon-size': ['*', 0.5, ['coalesce', ['get', 'scale', ['get', '_style']], 1]],  // デフォルト0.5倍、KMLのscaleも考慮
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': 'center'
      },
      ...(this.options.minzoom !== undefined ? { minzoom: this.options.minzoom } : {}),
      ...(this.options.maxzoom !== undefined ? { maxzoom: this.options.maxzoom } : {})
    });
    this.layerIds.push(iconPointLayerId);
    
    // 通常のポイントレイヤー（アイコンがない場合のみ表示）
    // 現在はすべてのポイントにアイコンがあるため、このレイヤーは基本的に非表示
    const pointLayerId = `${this.options.id}-points`;
    this.map.addLayer({
      id: pointLayerId,
      type: 'circle',
      source: this.sourceId,
      filter: ['all',
        ['==', ['geometry-type'], 'Point'],
        ['any',
          ['==', ['typeof', ['get', '_style']], 'null'],
          ['!', ['has', '_iconId', ['get', '_style']]]
        ],
        ...(this.options.optimization?.clusterPoints ? [['!', ['has', 'point_count']]] : [])
      ] as any,
      paint: Object.assign({
        'circle-radius': 0,  // サイズを0にして非表示
        'circle-opacity': 0,  // 透明度を0にして非表示
        'circle-stroke-opacity': 0
      }, this.performanceOptimizer?.generateLODConfig('point') || {}),
      ...(this.options.minzoom !== undefined ? { minzoom: this.options.minzoom } : {}),
      ...(this.options.maxzoom !== undefined ? { maxzoom: this.options.maxzoom } : {})
    });
    this.layerIds.push(pointLayerId);
    
    // ラインレイヤー
    const lineLayerId = `${this.options.id}-lines`;
    this.map.addLayer({
      id: lineLayerId,
      type: 'line',
      source: this.sourceId,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: Object.assign({
        'line-color': ['case',
          ['!=', ['typeof', ['get', '_style']], 'null'],
          ['coalesce', ['get', 'color', ['get', '_style']], '#0000FF'],
          '#0000FF'
        ],
        'line-width': ['case',
          ['!=', ['typeof', ['get', '_style']], 'null'],
          ['coalesce', ['get', 'width', ['get', '_style']], 2],
          2
        ]
      }, this.performanceOptimizer?.generateLODConfig('line') || {}),
      ...(this.options.minzoom !== undefined ? { minzoom: this.options.minzoom } : {}),
      ...(this.options.maxzoom !== undefined ? { maxzoom: this.options.maxzoom } : {})
    });
    this.layerIds.push(lineLayerId);
    
    // ポリゴン塗りつぶしレイヤー
    const fillLayerId = `${this.options.id}-fills`;
    this.map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: this.sourceId,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: Object.assign({
        'fill-color': ['case',
          ['!=', ['typeof', ['get', '_style']], 'null'],
          ['coalesce', ['get', 'fillColor', ['get', '_style']], '#00FF00'],
          '#00FF00'
        ],
        'fill-opacity': 0.5
      }, this.performanceOptimizer?.generateLODConfig('polygon') || {}),
      ...(this.options.minzoom !== undefined ? { minzoom: this.options.minzoom } : {}),
      ...(this.options.maxzoom !== undefined ? { maxzoom: this.options.maxzoom } : {})
    });
    this.layerIds.push(fillLayerId);
    
    // ポリゴン輪郭レイヤー
    const outlineLayerId = `${this.options.id}-outlines`;
    this.map.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: this.sourceId,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'line-color': ['case',
          ['!=', ['typeof', ['get', '_style']], 'null'],
          ['coalesce', ['get', 'color', ['get', '_style']], '#000000'],
          '#000000'
        ] as any,
        'line-width': ['case',
          ['!=', ['typeof', ['get', '_style']], 'null'],
          ['coalesce', ['get', 'width', ['get', '_style']], 1],
          1
        ] as any
      },
      ...(this.options.minzoom !== undefined ? { minzoom: this.options.minzoom } : {}),
      ...(this.options.maxzoom !== undefined ? { maxzoom: this.options.maxzoom } : {})
    });
    this.layerIds.push(outlineLayerId);
    
    // デバッグ：作成されたレイヤーを確認
    console.log('Created layers:', this.layerIds);
    
    // 各レイヤーのフィーチャー数を確認（少し遅延させて実行）
    setTimeout(() => {
      // アイコンの存在を確認
      const iconIds = Object.values(this.parseResult!.styles)
        .filter(style => (style as any)._iconId)
        .map(style => (style as any)._iconId);
      
      console.log('登録されたアイコンID:', iconIds);
      
      // 各アイコンが実際に存在するか確認
      iconIds.forEach(iconId => {
        if (this.map!.hasImage(iconId)) {
          console.log(`✅ アイコン存在: ${iconId}`);
        } else {
          console.log(`❌ アイコン不在: ${iconId}`);
        }
      });
      
      this.layerIds.forEach(layerId => {
        const features = this.map!.queryRenderedFeatures(undefined, {
          layers: [layerId]
        });
        console.log(`Layer ${layerId}: ${features.length} rendered features`);
        if (features.length > 0 && layerId.includes('point')) {
          console.log(`Sample feature from ${layerId}:`, features[0].properties);
        }
      });
      
      // ソースのフィーチャーを直接確認
      const source = this.map!.getSource(this.sourceId) as any;
      if (source && source._data) {
        const pointFeatures = source._data.features.filter((f: any) => f.geometry.type === 'Point');
        console.log(`Source has ${pointFeatures.length} point features`);
        if (pointFeatures.length > 0) {
          console.log('First point from source:', pointFeatures[0]);
        }
      }
    }, 1000);
    
    // 初期表示設定
    if (this.options.visible === false) {
      this.hide();
    }
  }
  
  // レイヤーを表示
  show(): void {
    if (!this.map) return;
    
    this.layerIds.forEach(layerId => {
      this.map!.setLayoutProperty(layerId, 'visibility', 'visible');
    });
  }
  
  // レイヤーを非表示
  hide(): void {
    if (!this.map) return;
    
    this.layerIds.forEach(layerId => {
      this.map!.setLayoutProperty(layerId, 'visibility', 'none');
    });
  }
  
  // レイヤーの表示/非表示を切り替え
  toggle(): void {
    if (!this.map || this.layerIds.length === 0) return;
    
    const visibility = this.map.getLayoutProperty(this.layerIds[0], 'visibility');
    if (visibility === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }
  
  // 画像が見つからない場合のハンドラを設定
  private setupImageMissingHandler(): void {
    if (!this.map) return;
    
    // 既存のハンドラがあれば削除
    if (this.imageMissingHandler) {
      this.map.off('styleimagemissing', this.imageMissingHandler);
    }
    
    // 新しいハンドラを設定
    this.imageMissingHandler = async (e: any) => {
      const id = e.id;
      
      // デフォルトアイコンまたは代替アイコンを提供
      if (!this.map || !this.iconManager) return;
      
      // 既に処理中かチェック
      if (this.iconManager.hasIcon(id)) return;
      
      // まず類似のアイコンを探す
      const similarIcon = findSimilarIcon(id);
      if (similarIcon) {
        // 類似アイコンが存在するか確認
        const iconSize = getNearestIconSize(24);
        const makiIconId = `${similarIcon}-${iconSize}`;
        
        if (this.map.hasImage(makiIconId)) {
          // エイリアスとして登録
          console.log(`Missing icon ${id} → alias to ${makiIconId}`);
          return; // MapLibreが自動的に処理
        } else if (this.map.hasImage(similarIcon)) {
          console.log(`Missing icon ${id} → alias to ${similarIcon}`);
          return; // MapLibreが自動的に処理
        }
      }
      
      try {
        // デフォルトのマーカーアイコンを作成
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // 透明なマーカーを作成（実質的に非表示）
          ctx.globalAlpha = 0;
          ctx.fillStyle = 'transparent';
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, 1, 0, Math.PI * 2);
          ctx.fill();
          
          // 画像として追加
          const imageData = ctx.getImageData(0, 0, size, size);
          this.map.addImage(id, imageData);
        }
      } catch (error) {
        console.warn(`デフォルトアイコンの作成に失敗: ${id}`, error);
      }
    };
    
    this.map.on('styleimagemissing', this.imageMissingHandler);
  }
  
  // レイヤーを削除
  remove(): void {
    if (!this.map) return;
    
    // イベントハンドラを削除
    if (this.imageMissingHandler) {
      this.map.off('styleimagemissing', this.imageMissingHandler);
      this.imageMissingHandler = null;
    }
    
    // NetworkLinkの自動更新を停止
    this.networkLinkManager.stopAllAutoRefresh();
    
    // アイコンをクリア
    if (this.iconManager) {
      this.iconManager.clear();
    }
    
    // レイヤーを削除
    this.layerIds.forEach(layerId => {
      if (this.map!.getLayer(layerId)) {
        this.map!.removeLayer(layerId);
      }
    });
    
    // ソースを削除
    if (this.map.getSource(this.sourceId)) {
      this.map.removeSource(this.sourceId);
    }
    
    this.layerIds = [];
    this.map = null;
    this.iconManager = null;
  }
  
  // データを更新
  private updateData(newData: KMZParseResult): void {
    if (!this.map || !this.map.getSource(this.sourceId)) return;
    
    // 既存のデータとマージ
    const mergedFeatures = [...(this.parseResult?.features.features || [])];
    const existingIds = new Set(mergedFeatures.map(f => f.properties?.id || f.id));
    
    // 新しいフィーチャーを追加（重複を避ける）
    newData.features.features.forEach(feature => {
      const featureId = feature.properties?.id || feature.id;
      if (!featureId || !existingIds.has(featureId)) {
        mergedFeatures.push(feature);
      }
    });
    
    // スタイルをマージ
    if (this.parseResult) {
      Object.assign(this.parseResult.styles, newData.styles);
      this.parseResult.features = featureCollection(mergedFeatures);
    }
    
    // ソースを更新
    const source = this.map.getSource(this.sourceId) as any;
    source.setData(this.parseResult!.features);
  }
  
  // データを取得
  getData(): KMZParseResult | null {
    return this.parseResult;
  }
  
  // 特定のフィーチャーにズーム
  zoomToFeature(featureId: number): void {
    if (!this.map || !this.parseResult) return;
    
    const feature = this.parseResult.features.features[featureId];
    if (!feature) return;
    
    // @ts-ignore
    const bounds = this.map.getBounds();
    
    if (feature.geometry.type === 'Point') {
      this.map.flyTo({
        center: feature.geometry.coordinates as [number, number],
        zoom: 15
      });
    } else {
      // ライン・ポリゴンの場合は境界を計算
      // 簡易実装（実際にはturf.jsのbbox関数を使用することを推奨）
      const coords: number[][] = [];
      
      if (feature.geometry.type === 'LineString') {
        coords.push(...feature.geometry.coordinates);
      } else if (feature.geometry.type === 'Polygon') {
        coords.push(...feature.geometry.coordinates[0]);
      }
      
      if (coords.length > 0) {
        const lngs = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        
        this.map.fitBounds([
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        ], { padding: 50 });
      }
    }
  }
}