# maplibre-gl-kmz-layer

MapLibre GL JS用のKMZ/KMLファイルレイヤープラグイン

## 特徴

- KMZファイル（圧縮されたKML）の読み込みをサポート
- KMLファイルの直接読み込みもサポート
- Point、LineString、Polygon、MultiGeometryに対応
- KMLスタイル情報の自動適用（LineStyle、PolyStyle、IconStyle）
- NetworkLinkサポート（自動更新機能付き）
- 大規模データ対応（パフォーマンス最適化、クラスタリング、LOD）
- アイコンの完全サポート（KMZ内のアイコン自動抽出）
- TypeScriptサポート
- 軽量で高速

## インストール

```bash
npm install maplibre-gl-kmz-layer
```

## 使用方法

```javascript
import { KMZLayer } from 'maplibre-gl-kmz-layer';

// MapLibre GLマップを初期化
const map = new maplibregl.Map({
  container: 'map',
  style: 'your-style-url',
  center: [139.7670, 35.6814],
  zoom: 10
});

// KMZレイヤーを作成
const kmzLayer = new KMZLayer({
  id: 'my-kmz-layer',
  url: 'path/to/your/file.kmz',
  onLoad: (data) => {
    console.log('KMZ loaded:', data);
  },
  onError: (error) => {
    console.error('Error loading KMZ:', error);
  }
});

// マップに追加
await kmzLayer.addTo(map);
```

### ローカルファイルから読み込む場合

```javascript
const fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();
  
  reader.onload = async (event) => {
    const kmzLayer = new KMZLayer({
      id: 'local-kmz',
      data: event.target.result,
      onLoad: (data) => {
        console.log('Local KMZ loaded:', data);
      }
    });
    
    await kmzLayer.addTo(map);
  };
  
  reader.readAsArrayBuffer(file);
});
```

### 大規模データの最適化

```javascript
const kmzLayer = new KMZLayer({
  id: 'large-dataset',
  url: 'path/to/large-file.kmz',
  optimization: {
    enabled: true,
    maxFeatures: 10000,
    clusterPoints: true,
    clusterRadius: 50,
    simplifyTolerance: 0.0001,
    enableLOD: true
  }
});
```

### NetworkLinkの使用

```javascript
const kmzLayer = new KMZLayer({
  id: 'dynamic-kmz',
  url: 'path/to/network-linked.kmz',
  followNetworkLinks: true,
  networkLinkOptions: {
    maxDepth: 3,
    refreshInterval: 60000 // 1分ごとに更新
  }
});
```

## API

### コンストラクタオプション

```typescript
interface KMZLayerOptions {
  id: string;                    // レイヤーの一意なID
  url?: string;                  // KMZファイルのURL
  data?: ArrayBuffer | Blob;     // KMZファイルのバイナリデータ
  visible?: boolean;             // 初期表示状態（デフォルト: true）
  minzoom?: number;              // 最小ズームレベル
  maxzoom?: number;              // 最大ズームレベル
  onLoad?: (data: KMZParseResult) => void;   // 読み込み完了時のコールバック
  onError?: (error: Error) => void;          // エラー時のコールバック
  
  // NetworkLinkオプション
  followNetworkLinks?: boolean;  // NetworkLinkを自動的に読み込む
  networkLinkOptions?: {
    maxDepth?: number;           // NetworkLinkの最大深度
    refreshInterval?: number;    // 更新間隔（ミリ秒）
  };
  
  // パフォーマンス最適化オプション
  optimization?: {
    enabled?: boolean;           // 最適化を有効化
    maxFeatures?: number;        // 最大フィーチャー数
    simplifyTolerance?: number;  // 簡略化の許容誤差
    clusterPoints?: boolean;     // ポイントのクラスタリング
    clusterRadius?: number;      // クラスタリング半径
    enableLOD?: boolean;         // Level of Detail
  };
}
```

### メソッド

#### `addTo(map: MaplibreMap): Promise<void>`
レイヤーをマップに追加します。

#### `show(): void`
レイヤーを表示します。

#### `hide(): void`
レイヤーを非表示にします。

#### `toggle(): void`
レイヤーの表示/非表示を切り替えます。

#### `remove(): void`
レイヤーをマップから削除します。

#### `getData(): KMZParseResult | null`
パースされたKMZデータを取得します。

#### `zoomToFeature(featureId: number): void`
指定したフィーチャーにズームします。

## パース結果の構造

```typescript
interface KMZParseResult {
  features: FeatureCollection;  // GeoJSON FeatureCollection
  styles: Record<string, KMLStyle>;  // スタイル情報
  metadata?: {                  // メタデータ
    name?: string;
    description?: string;
    author?: string;
  };
}
```

## サポートされているKML要素

- **ジオメトリ**: Point, LineString, Polygon, MultiGeometry
- **スタイル**: LineStyle, PolyStyle, IconStyle（アイコン画像の自動抽出）
- **データ**: name, description, ExtendedData
- **動的要素**: NetworkLink（自動更新対応）

## ブラウザサポート

- Chrome (最新版)
- Firefox (最新版)
- Safari (最新版)
- Edge (最新版)

## 開発

```bash
# 依存関係をインストール
npm install

# ビルド
npm run build

# 開発モード
npm run dev

# テスト
npm run test
```

## ライセンス

MIT License

## 貢献

プルリクエストを歓迎します。大きな変更を行う場合は、まずissueを作成して変更内容について議論してください。