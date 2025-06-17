// テスト環境のセットアップ

// MapLibre GLのモック
jest.mock('maplibre-gl', () => ({
  Map: jest.fn().mockImplementation(() => ({
    addSource: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    removeSource: jest.fn(),
    getSource: jest.fn(),
    getLayer: jest.fn(),
    setLayoutProperty: jest.fn(),
    getLayoutProperty: jest.fn(),
    hasImage: jest.fn(),
    addImage: jest.fn(),
    removeImage: jest.fn(),
    queryRenderedFeatures: jest.fn(),
    fitBounds: jest.fn(),
    flyTo: jest.fn(),
    getBounds: jest.fn(),
    getCanvas: jest.fn().mockReturnValue({
      style: {}
    })
  })),
  Popup: jest.fn().mockImplementation(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    setHTML: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis()
  }))
}));

// グローバルオブジェクトのモック
global.fetch = jest.fn();
(global as any).FileReader = jest.fn().mockImplementation(() => ({
  readAsArrayBuffer: jest.fn(),
  readAsDataURL: jest.fn(),
  result: null,
  EMPTY: 0,
  LOADING: 1,
  DONE: 2,
  readyState: 0
})) as any;

// Canvasのモック
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  drawImage: jest.fn(),
  getImageData: jest.fn().mockReturnValue({
    width: 100,
    height: 100,
    data: new Uint8ClampedArray(40000)
  })
});

// Imageのモック
(global as any).Image = jest.fn().mockImplementation(() => ({
  onload: null,
  onerror: null,
  src: '',
  width: 100,
  height: 100
})) as any;