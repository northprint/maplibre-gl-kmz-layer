import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { point, lineString, polygon, featureCollection } from '@turf/helpers';
import { KMLStyle, KMLPlacemark, KMZParseResult } from './types';
import { kmlColorToRgba, parseCoordinates } from './utils';

export class KMZParser {
  private domParser: DOMParser;
  private doc: any | null = null; // 最後にパースしたドキュメント
  
  constructor() {
    this.domParser = new DOMParser();
  }
  
  // 最後にパースしたドキュメントを取得
  getLastDocument(): any | null {
    return this.doc;
  }
  
  // KMZファイルをパース
  async parseKMZ(data: ArrayBuffer | Blob): Promise<KMZParseResult> {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(data);
      
      // KMLファイルを探す
      let kmlContent: string | null = null;
      
      for (const filename of Object.keys(contents.files)) {
        if (filename.endsWith('.kml')) {
          kmlContent = await contents.files[filename].async('string');
          break;
        }
      }
      
      if (!kmlContent) {
        throw new Error('KMLファイルが見つかりません');
      }
      
      const result = this.parseKML(kmlContent);
      
      // zipオブジェクトを結果に含める（アイコン抽出用）
      (result as any)._zip = contents;
      
      return result;
    } catch (error) {
      throw new Error(`KMZファイルのパースに失敗しました: ${error}`);
    }
  }
  
  // KMLコンテンツをパース
  parseKML(kmlContent: string): KMZParseResult {
    const doc = this.domParser.parseFromString(kmlContent, 'text/xml');
    this.doc = doc; // ドキュメントを保存
    
    // スタイルを抽出
    const styles = this.extractStyles(doc);
    
    // Placemarkを抽出
    const placemarks = this.extractPlacemarks(doc);
    
    // GeoJSON Featuresに変換
    const features = placemarks
      .map(placemark => this.placemarkToFeature(placemark, styles))
      .filter(feature => feature !== null);
    
    // メタデータを抽出
    const metadata = this.extractMetadata(doc);
    
    return {
      features: featureCollection(features),
      styles,
      metadata
    };
  }
  
  // スタイル情報を抽出
  private extractStyles(doc: any): Record<string, KMLStyle> {
    const styles: Record<string, KMLStyle> = {};
    
    // Style要素を処理
    const styleElements = doc.getElementsByTagName('Style');
    for (let i = 0; i < styleElements.length; i++) {
      const styleEl = styleElements[i];
      const id = styleEl.getAttribute('id');
      if (!id) continue;
      
      const style: KMLStyle = { id };
      
      // LineStyle
      const lineStyle = styleEl.getElementsByTagName('LineStyle')[0];
      if (lineStyle) {
        const color = lineStyle.getElementsByTagName('color')[0]?.textContent;
        const width = lineStyle.getElementsByTagName('width')[0]?.textContent;
        
        if (color) style.color = kmlColorToRgba(color);
        if (width) style.width = parseFloat(width);
      }
      
      // PolyStyle
      const polyStyle = styleEl.getElementsByTagName('PolyStyle')[0];
      if (polyStyle) {
        const color = polyStyle.getElementsByTagName('color')[0]?.textContent;
        const fill = polyStyle.getElementsByTagName('fill')[0]?.textContent;
        
        if (color) style.fillColor = kmlColorToRgba(color);
        if (fill) style.fill = fill === '1';
      }
      
      // IconStyle
      const iconStyle = styleEl.getElementsByTagName('IconStyle')[0];
      if (iconStyle) {
        const scale = iconStyle.getElementsByTagName('scale')[0]?.textContent;
        const icon = iconStyle.getElementsByTagName('Icon')[0];
        const href = icon?.getElementsByTagName('href')[0]?.textContent;
        
        if (scale) style.scale = parseFloat(scale);
        if (href) {
          style.icon = href;
        }
      }
      
      // styleUrlが#で始まることを想定
      styles[`#${id}`] = style;
      // #なしのバージョンも保存（互換性のため）
      styles[id] = style;
    }
    
    return styles;
  }
  
  // Placemark要素を抽出
  private extractPlacemarks(doc: any): KMLPlacemark[] {
    const placemarks: KMLPlacemark[] = [];
    const placemarkElements = doc.getElementsByTagName('Placemark');
    
    for (let i = 0; i < placemarkElements.length; i++) {
      const placemarkEl = placemarkElements[i];
      const placemark: KMLPlacemark = {};
      
      // 基本情報
      placemark.name = placemarkEl.getElementsByTagName('name')[0]?.textContent || undefined;
      placemark.description = placemarkEl.getElementsByTagName('description')[0]?.textContent || undefined;
      placemark.styleUrl = placemarkEl.getElementsByTagName('styleUrl')[0]?.textContent || undefined;
      
      // ジオメトリを抽出
      placemark.geometry = this.extractGeometry(placemarkEl);
      
      // ExtendedDataを抽出
      const extendedData = placemarkEl.getElementsByTagName('ExtendedData')[0];
      if (extendedData) {
        placemark.properties = this.extractExtendedData(extendedData);
      }
      
      placemarks.push(placemark);
    }
    
    return placemarks;
  }
  
  // ジオメトリを抽出
  private extractGeometry(element: Element): any {
    // MultiGeometry
    const multiGeomEl = element.getElementsByTagName('MultiGeometry')[0];
    if (multiGeomEl) {
      const geometries: any[] = [];
      
      // MultiGeometry内の全ての子ジオメトリを処理
      const childNodes = multiGeomEl.childNodes;
      for (let i = 0; i < childNodes.length; i++) {
        const node = childNodes[i];
        if (node.nodeType === 1) { // ELEMENT_NODE
          const geom = this.extractSingleGeometry(node as Element);
          if (geom) {
            geometries.push(geom);
          }
        }
      }
      
      if (geometries.length > 0) {
        // GeometryCollectionとして返す
        return {
          type: 'GeometryCollection',
          geometries: geometries
        };
      }
    }
    
    // 単一ジオメトリの処理
    return this.extractSingleGeometry(element);
  }
  
  // 単一ジオメトリを抽出
  private extractSingleGeometry(element: Element): any {
    // elementがPoint、LineString、Polygonタグ自体の場合
    if (element.tagName === 'Point') {
      const coords = element.getElementsByTagName('coordinates')[0]?.textContent;
      if (coords) {
        const parsed = parseCoordinates(coords);
        if (parsed.length > 0) {
          const [lng, lat] = parsed[0];
          
          // 座標の妥当性を検証
          if (isNaN(lng) || isNaN(lat)) {
            console.warn('無効な座標（NaN）:', coords);
            return null;
          }
          
          // (0,0)の座標は通常無効なデータのため除外
          if (lng === 0 && lat === 0) {
            console.warn('(0,0)の座標を検出:', coords);
            return null;
          }
          
          // 緯度経度の範囲チェック
          if (Math.abs(lng) > 180 || Math.abs(lat) > 90) {
            console.warn('範囲外の座標:', [lng, lat]);
            return null;
          }
          
          return point(parsed[0]).geometry;
        }
      }
      return null;
    }
    
    if (element.tagName === 'LineString') {
      const coords = element.getElementsByTagName('coordinates')[0]?.textContent;
      if (coords) {
        const parsed = parseCoordinates(coords);
        if (parsed.length >= 2) {
          return lineString(parsed.map(c => [c[0], c[1]])).geometry;
        }
      }
      return null;
    }
    
    if (element.tagName === 'Polygon') {
      const outerBoundary = element.getElementsByTagName('outerBoundaryIs')[0];
      const linearRing = outerBoundary?.getElementsByTagName('LinearRing')[0];
      const coords = linearRing?.getElementsByTagName('coordinates')[0]?.textContent;
      
      if (coords) {
        const parsed = parseCoordinates(coords);
        if (parsed.length >= 3) {
          const ring = parsed.map(c => [c[0], c[1]]);
          if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
            ring.push([ring[0][0], ring[0][1]]);
          }
          
          const innerBoundaries = element.getElementsByTagName('innerBoundaryIs');
          const holes: number[][][] = [];
          
          for (let i = 0; i < innerBoundaries.length; i++) {
            const innerRing = innerBoundaries[i].getElementsByTagName('LinearRing')[0];
            const innerCoords = innerRing?.getElementsByTagName('coordinates')[0]?.textContent;
            
            if (innerCoords) {
              const innerParsed = parseCoordinates(innerCoords);
              if (innerParsed.length >= 3) {
                const hole = innerParsed.map(c => [c[0], c[1]]);
                if (hole[0][0] !== hole[hole.length - 1][0] || hole[0][1] !== hole[hole.length - 1][1]) {
                  hole.push([hole[0][0], hole[0][1]]);
                }
                holes.push(hole);
              }
            }
          }
          
          const rings = [ring, ...holes];
          return polygon(rings).geometry;
        }
      }
      return null;
    }
    
    // 子要素として含まれている場合
    // Point
    const pointEl = element.getElementsByTagName('Point')[0];
    if (pointEl) {
      const coords = pointEl.getElementsByTagName('coordinates')[0]?.textContent;
      if (coords) {
        const parsed = parseCoordinates(coords);
        if (parsed.length > 0) {
          return point(parsed[0]).geometry;
        }
      }
    }
    
    // LineString
    const lineStringEl = element.getElementsByTagName('LineString')[0];
    if (lineStringEl) {
      const coords = lineStringEl.getElementsByTagName('coordinates')[0]?.textContent;
      if (coords) {
        const parsed = parseCoordinates(coords);
        if (parsed.length >= 2) {
          return lineString(parsed.map(c => [c[0], c[1]])).geometry;
        }
      }
    }
    
    // Polygon
    const polygonEl = element.getElementsByTagName('Polygon')[0];
    if (polygonEl) {
      const outerBoundary = polygonEl.getElementsByTagName('outerBoundaryIs')[0];
      const linearRing = outerBoundary?.getElementsByTagName('LinearRing')[0];
      const coords = linearRing?.getElementsByTagName('coordinates')[0]?.textContent;
      
      if (coords) {
        const parsed = parseCoordinates(coords);
        if (parsed.length >= 3) {
          // ポリゴンは閉じている必要がある
          const ring = parsed.map(c => [c[0], c[1]]);
          if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
            ring.push([ring[0][0], ring[0][1]]);
          }
          
          // 内部リング（穴）の処理
          const innerBoundaries = polygonEl.getElementsByTagName('innerBoundaryIs');
          const holes: number[][][] = [];
          
          for (let i = 0; i < innerBoundaries.length; i++) {
            const innerRing = innerBoundaries[i].getElementsByTagName('LinearRing')[0];
            const innerCoords = innerRing?.getElementsByTagName('coordinates')[0]?.textContent;
            
            if (innerCoords) {
              const innerParsed = parseCoordinates(innerCoords);
              if (innerParsed.length >= 3) {
                const hole = innerParsed.map(c => [c[0], c[1]]);
                if (hole[0][0] !== hole[hole.length - 1][0] || hole[0][1] !== hole[hole.length - 1][1]) {
                  hole.push([hole[0][0], hole[0][1]]);
                }
                holes.push(hole);
              }
            }
          }
          
          const rings = [ring, ...holes];
          return polygon(rings).geometry;
        }
      }
    }
    
    return null;
  }
  
  // ExtendedDataを抽出
  private extractExtendedData(extendedData: Element): Record<string, any> {
    const properties: Record<string, any> = {};
    const dataElements = extendedData.getElementsByTagName('Data');
    
    for (let i = 0; i < dataElements.length; i++) {
      const dataEl = dataElements[i];
      const name = dataEl.getAttribute('name');
      const value = dataEl.getElementsByTagName('value')[0]?.textContent;
      
      if (name && value) {
        properties[name] = value;
      }
    }
    
    return properties;
  }
  
  // PlacemarkをGeoJSON Featureに変換
  private placemarkToFeature(placemark: KMLPlacemark, styles: Record<string, KMLStyle>): any {
    if (!placemark.geometry) {
      console.warn('Placemark without geometry:', placemark);
      return null;
    }
    
    // 座標の検証（デバッグ用）
    if (placemark.geometry.type === 'Point') {
      const coords = placemark.geometry.coordinates;
      if (!coords || coords.length < 2 || isNaN(coords[0]) || isNaN(coords[1])) {
        console.error('Invalid point coordinates:', coords, 'in placemark:', placemark);
        return null;
      }
      // 座標が(0,0)の場合はスキップ（無効な座標の可能性が高い）
      if (coords[0] === 0 && coords[1] === 0) {
        console.warn('Point at (0,0) found, skipping:', placemark);
        return null;
      }
      // 座標が極端に大きい/小さい場合もチェック
      if (Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90) {
        console.error('Invalid coordinates (out of bounds):', coords, 'in placemark:', placemark);
        return null;
      }
    }
    
    const properties: Record<string, any> = {
      ...placemark.properties
    };
    
    if (placemark.name) properties.name = placemark.name;
    if (placemark.description) properties.description = placemark.description;
    
    // スタイルをマッチング
    if (placemark.styleUrl) {
      // スタイルを検索（複数のパターンを試す）
      let style = styles[placemark.styleUrl];
      
      // 完全一致しない場合、-normalサフィックスを試す
      if (!style) {
        style = styles[`${placemark.styleUrl}-normal`];
      }
      
      // #ありとなしの両方を試す
      if (!style && placemark.styleUrl.startsWith('#')) {
        // #を除いたバージョンも試す
        const withoutHash = placemark.styleUrl.substring(1);
        style = styles[withoutHash] || styles[`${withoutHash}-normal`];
      } else if (!style && !placemark.styleUrl.startsWith('#')) {
        // #を追加したバージョンも試す
        style = styles[`#${placemark.styleUrl}`] || styles[`#${placemark.styleUrl}-normal`];
      }
      
      if (style) {
        properties._style = style;
      }
    }
    
    return {
      type: 'Feature',
      geometry: placemark.geometry,
      properties
    };
  }
  
  // メタデータを抽出
  private extractMetadata(doc: any): Record<string, any> {
    const metadata: Record<string, any> = {};
    const documentEl = doc.getElementsByTagName('Document')[0];
    
    if (documentEl) {
      metadata.name = documentEl.getElementsByTagName('name')[0]?.textContent || undefined;
      metadata.description = documentEl.getElementsByTagName('description')[0]?.textContent || undefined;
    }
    
    return metadata;
  }
}