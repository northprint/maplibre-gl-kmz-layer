# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

maplibre-gl-kmz-layerは、MapLibre GL JS用のKMZ/KMLファイルサポートを提供するライブラリです（プロジェクト初期段階）。

## プロジェクト初期化時の推奨構成

### 基本構造
```
maplibre-gl-kmz-layer/
├── src/               # ソースコード
│   ├── index.ts       # メインエントリーポイント
│   ├── kmz-parser.ts  # KMZ/KMLパーサー
│   └── layer.ts       # MapLibre GLレイヤー実装
├── dist/              # ビルド成果物
├── examples/          # 使用例
├── test/              # テストコード
└── docs/              # ドキュメント
```

### 推奨される開発コマンド

プロジェクト初期化後、以下のようなコマンドを設定することを推奨：

```json
{
  "scripts": {
    "build": "rollup -c",
    "dev": "rollup -c -w",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "docs": "typedoc src/index.ts"
  }
}
```

### 技術スタックの推奨

1. **TypeScript** - 型安全性とMapLibre GL JSとの互換性
2. **Rollup** - ライブラリのバンドリング（UMD/ESM形式）
3. **Jest** - テストフレームワーク
4. **JSZip** - KMZファイルの解凍処理
5. **@xmldom/xmldom** - KMLのXMLパース

### アーキテクチャの考慮事項

1. **KMZパーサー**
   - KMZファイルの解凍（JSZip使用）
   - KML XMLのパース
   - スタイル情報の抽出

2. **レイヤー実装**
   - MapLibre GLのカスタムレイヤーAPI準拠
   - GeoJSON形式への変換
   - スタイルの適用

3. **非同期処理**
   - ファイルの読み込みは非同期で実装
   - プログレスイベントのサポート

### 開発時の注意点

- MapLibre GL JSのバージョン互換性に注意
- 大きなKMZファイルのパフォーマンス最適化を考慮
- エラーハンドリングを適切に実装（無効なKMZ/KMLファイルへの対応）
- 座標系の変換処理（KMLはWGS84を使用）