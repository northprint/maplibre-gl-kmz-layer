import type { Map as MaplibreMap } from 'maplibre-gl';
import JSZip from 'jszip';

// アイコンを管理するクラス
export class IconManager {
  private map: MaplibreMap;
  private loadedIcons: Set<string> = new Set();
  private iconCache: Map<string, string> = new Map(); // URLからdata URLへのキャッシュ
  
  constructor(map: MaplibreMap) {
    this.map = map;
  }
  
  // KMZファイル内のアイコンを抽出
  async extractIconsFromKMZ(zip: JSZip, iconUrls: string[]): Promise<Map<string, string>> {
    const icons = new Map<string, string>();
    
    // ZIP内のすべてのファイルをリスト（デバッグ用）
    const allFiles = Object.keys(zip.files);
    
    // 画像ファイルのみフィルタリング
    const imageFiles = allFiles.filter(file => 
      /\.(png|jpg|jpeg|gif|bmp|svg)$/i.test(file)
    );
    
    // imagesフォルダ内のファイルを確認
    
    for (const iconUrl of iconUrls) {
      
      // パスを正規化
      const normalizedUrl = iconUrl.replace(/^\.\//, '').replace(/^\//, '');
      
      // 様々なパスパターンを試す（重複を排除）
      const pathVariants = new Set([
        normalizedUrl,
        // 既にimages/で始まっている場合はそのまま、そうでない場合はimages/を追加
        normalizedUrl.startsWith('images/') ? normalizedUrl : `images/${normalizedUrl}`,
        // ファイル名のみ（パス部分を除去）
        normalizedUrl.split('/').pop() || normalizedUrl,
        // images/を付けたファイル名のみ
        `images/${normalizedUrl.split('/').pop() || normalizedUrl}`,
        // 元のURL
        iconUrl
      ]);
      
      let found = false;
      for (const variant of pathVariants) {
        const iconFile = zip.file(variant);
        if (iconFile) {
          try {
            const blob = await iconFile.async('blob');
            
            // 拡張子からMIMEタイプを判定
            const ext = variant.toLowerCase().split('.').pop();
            let mimeType = 'image/png';
            if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
            else if (ext === 'gif') mimeType = 'image/gif';
            else if (ext === 'svg') mimeType = 'image/svg+xml';
            else if (ext === 'bmp') mimeType = 'image/bmp';
            
            // 正しいMIMEタイプでBlobを再作成
            const typedBlob = new Blob([blob], { type: mimeType });
            const dataUrl = await this.blobToDataURL(typedBlob);
            icons.set(iconUrl, dataUrl);
            this.iconCache.set(iconUrl, dataUrl);
            found = true;
            break;
          } catch (error) {
            console.warn(`アイコンの読み込みに失敗: ${variant}`, error);
          }
        }
      }
      
      if (!found) {
        // ファイル名のみで検索
        const fileName = iconUrl.split('/').pop();
        if (fileName) {
          const matchingFile = imageFiles.find(f => f.endsWith(fileName));
          if (matchingFile) {
            const iconFile = zip.file(matchingFile);
            if (iconFile) {
              try {
                const blob = await iconFile.async('blob');
                
                // 拡張子からMIMEタイプを判定
                const ext = matchingFile.toLowerCase().split('.').pop();
                let mimeType = 'image/png';
                if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                else if (ext === 'gif') mimeType = 'image/gif';
                else if (ext === 'svg') mimeType = 'image/svg+xml';
                else if (ext === 'bmp') mimeType = 'image/bmp';
                
                // 正しいMIMEタイプでBlobを再作成
                const typedBlob = new Blob([blob], { type: mimeType });
                const dataUrl = await this.blobToDataURL(typedBlob);
                icons.set(iconUrl, dataUrl);
                this.iconCache.set(iconUrl, dataUrl);
                found = true;
              } catch (error) {
                console.warn(`アイコンの読み込みに失敗: ${matchingFile}`, error);
              }
            }
          }
        }
      }
      
      if (!found) {
        console.warn(`アイコンが見つかりません: ${iconUrl}`);
      }
    }
    
    return icons;
  }
  
  // 外部URLからアイコンを読み込み
  async loadExternalIcon(url: string): Promise<string | null> {
    // キャッシュを確認
    if (this.iconCache.has(url)) {
      return this.iconCache.get(url)!;
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const dataUrl = await this.blobToDataURL(blob);
      this.iconCache.set(url, dataUrl);
      return dataUrl;
    } catch (error) {
      console.warn(`外部アイコンの読み込みに失敗: ${url}`, error);
      return null;
    }
  }
  
  // MapLibre GLにアイコンを追加
  async addIconToMap(iconId: string, iconUrl: string, scale: number = 1): Promise<boolean> {
    
    // 既に読み込み済みの場合はスキップ
    if (this.loadedIcons.has(iconId)) {
      return true;
    }
    
    try {
      let imageUrl = iconUrl;
      
      // data URLでない場合は読み込む
      if (!iconUrl.startsWith('data:')) {
        const cachedUrl = this.iconCache.get(iconUrl);
        if (cachedUrl) {
          imageUrl = cachedUrl;
        } else {
          const loadedUrl = await this.loadExternalIcon(iconUrl);
          if (!loadedUrl) return false;
          imageUrl = loadedUrl;
        }
      }
      
      
      // 画像を読み込み
      const img = await this.loadImage(imageUrl);
      
      // スケールを適用
      if (scale !== 1) {
        const scaledImg = this.scaleImage(img, scale);
        this.map.addImage(iconId, scaledImg);
      } else {
        this.map.addImage(iconId, img);
      }
      
      this.loadedIcons.add(iconId);
      return true;
    } catch (error) {
      console.warn(`アイコンの追加に失敗: ${iconId}`, error);
      return false;
    }
  }
  
  // BlobをData URLに変換
  private blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      // MIMEタイプが設定されていない場合は、拡張子から推測
      let finalBlob = blob;
      if (!blob.type || blob.type === 'application/octet-stream') {
        // ファイル名から拡張子を取得（呼び出し元で設定する必要がある）
        const type = 'image/png'; // デフォルトでPNGとして扱う
        finalBlob = new Blob([blob], { type });
      }
      
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(finalBlob);
    });
  }
  
  // 画像を読み込み
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }
  
  // 画像をスケール
  private scaleImage(img: HTMLImageElement, scale: number): ImageData {
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context取得失敗');
    }
    
    ctx.drawImage(img, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  }
  
  // アイコンが読み込み済みか確認
  hasIcon(iconId: string): boolean {
    return this.loadedIcons.has(iconId);
  }
  
  // 全てのアイコンをクリア
  clear(): void {
    // MapLibre GLからアイコンを削除
    this.loadedIcons.forEach(iconId => {
      if (this.map.hasImage(iconId)) {
        this.map.removeImage(iconId);
      }
    });
    
    this.loadedIcons.clear();
    this.iconCache.clear();
  }
}