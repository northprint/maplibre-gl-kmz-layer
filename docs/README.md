# MapLibre GL KMZ Layer

KMZ/KML layer support for MapLibre GL JS

## Demo

- [Live Demo](https://northprint.github.io/maplibre-gl-kmz-layer/)
- [View on GitHub](https://github.com/northprint/maplibre-gl-kmz-layer)

## Installation

```bash
npm install maplibre-gl-kmz-layer
```

## Features

- 🗺️ Full KMZ/KML file support
- 📍 Automatic icon extraction from KMZ files
- 🎨 Style preservation from KML
- 📊 Clustering support for better performance
- ⚡ Performance optimization for large files
- 🔧 TypeScript support

## Usage Example

```javascript
// Create KMZ layer
const kmzLayer = new MaplibreKmzLayer({
  url: 'path/to/file.kmz',
  id: 'my-kmz-layer',
  optimization: {
    enabled: true,
    clusterPoints: true
  }
});

// Add to map
await kmzLayer.addTo(map);
```