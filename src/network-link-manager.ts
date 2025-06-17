import { KMLNetworkLink, KMZParseResult } from './types';
import { KMZParser } from './kmz-parser';
import { featureCollection } from '@turf/helpers';

// NetworkLinkを管理するクラス
export class NetworkLinkManager {
  private parser: KMZParser;
  private activeLinks: Map<string, {
    link: KMLNetworkLink;
    intervalId?: number;
    lastFetch?: number;
  }> = new Map();
  
  constructor(parser: KMZParser) {
    this.parser = parser;
  }
  
  // NetworkLinkを抽出
  extractNetworkLinks(doc: any): KMLNetworkLink[] {
    const networkLinks: KMLNetworkLink[] = [];
    const linkElements = doc.getElementsByTagName('NetworkLink');
    
    for (let i = 0; i < linkElements.length; i++) {
      const linkEl = linkElements[i];
      const link = this.parseNetworkLink(linkEl);
      if (link) {
        networkLinks.push(link);
      }
    }
    
    return networkLinks;
  }
  
  // NetworkLink要素をパース
  private parseNetworkLink(element: Element): KMLNetworkLink | null {
    const linkEl = element.getElementsByTagName('Link')[0];
    if (!linkEl) return null;
    
    const href = linkEl.getElementsByTagName('href')[0]?.textContent;
    if (!href) return null;
    
    const link: KMLNetworkLink = { href };
    
    // 基本情報
    link.name = element.getElementsByTagName('name')[0]?.textContent || undefined;
    link.description = element.getElementsByTagName('description')[0]?.textContent || undefined;
    
    // リフレッシュモード
    const refreshMode = linkEl.getElementsByTagName('refreshMode')[0]?.textContent;
    if (refreshMode && ['onChange', 'onInterval', 'onExpire'].includes(refreshMode)) {
      link.refreshMode = refreshMode as KMLNetworkLink['refreshMode'];
    }
    
    const refreshInterval = linkEl.getElementsByTagName('refreshInterval')[0]?.textContent;
    if (refreshInterval) {
      link.refreshInterval = parseFloat(refreshInterval) * 1000; // 秒からミリ秒に変換
    }
    
    // ビューリフレッシュモード
    const viewRefreshMode = linkEl.getElementsByTagName('viewRefreshMode')[0]?.textContent;
    if (viewRefreshMode && ['never', 'onStop', 'onRequest', 'onRegion'].includes(viewRefreshMode)) {
      link.viewRefreshMode = viewRefreshMode as KMLNetworkLink['viewRefreshMode'];
    }
    
    const viewRefreshTime = linkEl.getElementsByTagName('viewRefreshTime')[0]?.textContent;
    if (viewRefreshTime) {
      link.viewRefreshTime = parseFloat(viewRefreshTime) * 1000; // 秒からミリ秒に変換
    }
    
    return link;
  }
  
  // NetworkLinkを読み込み
  async loadNetworkLink(link: KMLNetworkLink, baseUrl?: string): Promise<KMZParseResult> {
    try {
      // 相対URLの場合は基準URLと結合
      let url = link.href;
      if (baseUrl && !url.startsWith('http://') && !url.startsWith('https://')) {
        const base = new URL(baseUrl);
        url = new URL(link.href, base).href;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`NetworkLink読み込みエラー: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type') || '';
      let result: KMZParseResult;
      
      if (contentType.includes('application/vnd.google-earth.kmz') || url.endsWith('.kmz')) {
        // KMZファイル
        const data = await response.arrayBuffer();
        result = await this.parser.parseKMZ(data);
      } else {
        // KMLファイル
        const text = await response.text();
        result = this.parser.parseKML(text);
      }
      
      return result;
    } catch (error) {
      throw new Error(`NetworkLink読み込みエラー: ${error}`);
    }
  }
  
  // NetworkLinkの自動更新を開始
  startAutoRefresh(link: KMLNetworkLink, baseUrl?: string, onUpdate?: (data: KMZParseResult) => void): void {
    const linkId = link.href;
    
    // 既存の更新を停止
    this.stopAutoRefresh(linkId);
    
    if (link.refreshMode === 'onInterval' && link.refreshInterval) {
      const intervalId = window.setInterval(async () => {
        try {
          const data = await this.loadNetworkLink(link, baseUrl);
          if (onUpdate) {
            onUpdate(data);
          }
        } catch (error) {
          console.error('NetworkLink更新エラー:', error);
        }
      }, link.refreshInterval);
      
      this.activeLinks.set(linkId, {
        link,
        intervalId,
        lastFetch: Date.now()
      });
    }
  }
  
  // NetworkLinkの自動更新を停止
  stopAutoRefresh(linkId: string): void {
    const active = this.activeLinks.get(linkId);
    if (active && active.intervalId) {
      window.clearInterval(active.intervalId);
      this.activeLinks.delete(linkId);
    }
  }
  
  // 全ての自動更新を停止
  stopAllAutoRefresh(): void {
    for (const [linkId] of this.activeLinks) {
      this.stopAutoRefresh(linkId);
    }
  }
  
  // NetworkLinkを含むKMZをマージ
  async loadWithNetworkLinks(
    initialData: KMZParseResult,
    doc: any,
    baseUrl?: string,
    maxDepth: number = 3,
    currentDepth: number = 0
  ): Promise<KMZParseResult> {
    if (currentDepth >= maxDepth) {
      return initialData;
    }
    
    const networkLinks = this.extractNetworkLinks(doc);
    if (networkLinks.length === 0) {
      return initialData;
    }
    
    // 全てのNetworkLinkを並列で読み込み
    const linkResults = await Promise.allSettled(
      networkLinks.map(link => this.loadNetworkLink(link, baseUrl))
    );
    
    // 成功した結果をマージ
    const mergedFeatures = [...initialData.features.features];
    const mergedStyles = { ...initialData.styles };
    
    for (const result of linkResults) {
      if (result.status === 'fulfilled') {
        mergedFeatures.push(...result.value.features.features);
        Object.assign(mergedStyles, result.value.styles);
      }
    }
    
    return {
      features: featureCollection(mergedFeatures),
      styles: mergedStyles,
      metadata: initialData.metadata
    };
  }
}