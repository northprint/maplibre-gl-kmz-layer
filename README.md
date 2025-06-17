# maplibre-gl-kmz-layer

A KMZ/KML layer plugin for MapLibre GL JS

[日本語版](./README.ja.md)

## Features

- Load KMZ files (compressed KML) directly
- Support for KML files
- Support for Point, LineString, Polygon, and MultiGeometry
- Automatic application of KML styles (LineStyle, PolyStyle, IconStyle)
- NetworkLink support with automatic refresh
- Large dataset optimization (performance optimization, clustering, LOD)
- Full icon support (automatic icon extraction from KMZ)
- TypeScript support
- Lightweight and fast

## Installation

```bash
npm install maplibre-gl-kmz-layer
```

Or install directly from GitHub:
```bash
npm install github:northprint/maplibre-gl-kmz-layer
```

## Usage

```javascript
import { KMZLayer } from 'maplibre-gl-kmz-layer';

// Initialize MapLibre GL map
const map = new maplibregl.Map({
  container: 'map',
  style: 'your-style-url',
  center: [139.7670, 35.6814],
  zoom: 10
});

// Create KMZ layer
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

// Add to map
await kmzLayer.addTo(map);
```

### Loading from Local File

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

### Optimizing Large Datasets

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

### Using NetworkLinks

```javascript
const kmzLayer = new KMZLayer({
  id: 'dynamic-kmz',
  url: 'path/to/network-linked.kmz',
  followNetworkLinks: true,
  networkLinkOptions: {
    maxDepth: 3,
    refreshInterval: 60000 // Refresh every minute
  }
});
```

## API

### Constructor Options

```typescript
interface KMZLayerOptions {
  id: string;                    // Unique layer ID
  url?: string;                  // KMZ file URL
  data?: ArrayBuffer | Blob;     // KMZ file binary data
  visible?: boolean;             // Initial visibility (default: true)
  minzoom?: number;              // Minimum zoom level
  maxzoom?: number;              // Maximum zoom level
  onLoad?: (data: KMZParseResult) => void;   // Load complete callback
  onError?: (error: Error) => void;          // Error callback
  
  // NetworkLink options
  followNetworkLinks?: boolean;  // Automatically load NetworkLinks
  networkLinkOptions?: {
    maxDepth?: number;           // Maximum NetworkLink depth
    refreshInterval?: number;    // Refresh interval (milliseconds)
  };
  
  // Performance optimization options
  optimization?: {
    enabled?: boolean;           // Enable optimization
    maxFeatures?: number;        // Maximum number of features
    simplifyTolerance?: number;  // Simplification tolerance
    clusterPoints?: boolean;     // Cluster points
    clusterRadius?: number;      // Clustering radius
    enableLOD?: boolean;         // Enable Level of Detail
  };
}
```

### Methods

#### `addTo(map: MaplibreMap): Promise<void>`

Add the layer to a map.

#### `show(): void`

Show the layer.

#### `hide(): void`

Hide the layer.

#### `toggle(): void`

Toggle layer visibility.

#### `remove(): void`

Remove the layer from the map.

#### `getData(): KMZParseResult | null`

Get the parsed KMZ data.

#### `zoomToFeature(featureId: number): void`

Zoom to a specific feature.

## Parse Result Structure

```typescript
interface KMZParseResult {
  features: FeatureCollection;  // GeoJSON FeatureCollection
  styles: Record<string, KMLStyle>;  // Style information
  metadata?: {                  // Metadata
    name?: string;
    description?: string;
    author?: string;
  };
}
```

## Supported KML Elements

- **Geometry**: Point, LineString, Polygon, MultiGeometry
- **Styles**: LineStyle, PolyStyle, IconStyle (with automatic icon extraction)
- **Data**: name, description, ExtendedData
- **Dynamic Elements**: NetworkLink (with auto-refresh)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev

# Run tests
npm run test
```

## License

MIT License

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
