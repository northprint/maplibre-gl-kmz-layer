import { PerformanceOptimizer } from '../src/performance-optimizer';
import { featureCollection, point, lineString, polygon } from '@turf/helpers';

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer();
  });

  describe('optimizeFeatures', () => {
    it('should limit feature count when exceeding maxFeatures', () => {
      const features = [];
      for (let i = 0; i < 100; i++) {
        features.push(point([139.7 + i * 0.001, 35.6 + i * 0.001], { name: `Point ${i}` }));
      }
      const fc = featureCollection(features as any);

      const optimizerWithLimit = new PerformanceOptimizer({ maxFeatures: 50 });
      const result = optimizerWithLimit.optimizeFeatures(fc);

      expect(result.features).toHaveLength(50);
    });

    it('should prioritize features by importance', () => {
      const features = [
        point([139.7, 35.6], { name: 'Small point' }),
        polygon([[[139.7, 35.6], [139.8, 35.6], [139.8, 35.7], [139.7, 35.7], [139.7, 35.6]]], { name: 'Large polygon' }),
        lineString([[139.7, 35.6], [139.8, 35.7]], { name: 'Medium line' }),
        point([139.75, 35.65]), // No name
      ];
      const fc = featureCollection(features as any);

      const optimizerWithLimit = new PerformanceOptimizer({ maxFeatures: 2 });
      const result = optimizerWithLimit.optimizeFeatures(fc);

      // ポリゴンとラインが優先されるはず
      expect(result.features).toHaveLength(2);
      expect(result.features[0].geometry.type).toBe('Polygon');
      expect(result.features[1].geometry.type).toBe('LineString');
    });

    it('should simplify geometries when tolerance is set', () => {
      const line = lineString([
        [139.7, 35.6],
        [139.70001, 35.60001], // Very close point
        [139.701, 35.601],
        [139.702, 35.602],
        [139.703, 35.603]
      ]);
      const fc = featureCollection([line]);

      const optimizerWithSimplify = new PerformanceOptimizer({ simplifyTolerance: 0.001 });
      const result = optimizerWithSimplify.optimizeFeatures(fc);

      // 簡略化により座標数が減るはず
      const feature = result.features[0];
      if ('coordinates' in feature.geometry) {
        expect((feature.geometry as any).coordinates.length).toBeLessThan(5);
      }
    });
  });

  describe('generateClusteringConfig', () => {
    it('should generate clustering config when enabled', () => {
      const optimizerWithClustering = new PerformanceOptimizer({ clusterPoints: true });
      const config = optimizerWithClustering.generateClusteringConfig();

      expect(config).toEqual({
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
        clusterProperties: {
          count: ['+', 1]
        }
      });
    });

    it('should return null when clustering is disabled', () => {
      const optimizerNoClustering = new PerformanceOptimizer({ clusterPoints: false });
      const config = optimizerNoClustering.generateClusteringConfig();

      expect(config).toBeNull();
    });
  });

  describe('generateLODConfig', () => {
    it('should generate LOD config for points', () => {
      const config = optimizer.generateLODConfig('point');

      expect(config).toHaveProperty('circle-radius');
      expect(config['circle-radius']).toContain('interpolate');
    });

    it('should generate LOD config for lines', () => {
      const config = optimizer.generateLODConfig('line');

      expect(config).toHaveProperty('line-width');
      expect(config['line-width']).toContain('interpolate');
    });

    it('should generate LOD config for polygons', () => {
      const config = optimizer.generateLODConfig('polygon');

      expect(config).toHaveProperty('fill-opacity');
      expect(config['fill-opacity']).toContain('interpolate');
    });

    it('should return empty object when LOD is disabled', () => {
      const optimizerNoLOD = new PerformanceOptimizer({ enableLOD: false });
      const config = optimizerNoLOD.generateLODConfig('point');

      expect(config).toEqual({});
    });
  });

  describe('estimateMemoryUsage', () => {
    it('should estimate memory usage of features', () => {
      const features = [
        point([139.7, 35.6], { name: 'Tokyo', population: 14000000 }),
        lineString([[139.7, 35.6], [139.8, 35.7]], { road: 'Highway 1' })
      ];
      const fc = featureCollection(features as any);

      const bytes = optimizer.estimateMemoryUsage(fc);

      expect(bytes).toBeGreaterThan(0);
      expect(typeof bytes).toBe('number');
    });
  });

  describe('generateRecommendedOptions', () => {
    it('should recommend aggressive optimization for very large datasets', () => {
      const options = PerformanceOptimizer.generateRecommendedOptions(100000);

      expect(options.maxFeatures).toBeLessThanOrEqual(20000);
      expect(options.simplifyTolerance).toBeGreaterThan(0.0005);
      expect(options.clusterPoints).toBe(true);
      expect(options.enableLOD).toBe(true);
    });

    it('should recommend moderate optimization for medium datasets', () => {
      const options = PerformanceOptimizer.generateRecommendedOptions(7000);

      expect(options.clusterPoints).toBe(true);
      expect(options.simplifyTolerance).toBeDefined();
    });

    it('should recommend minimal optimization for small datasets', () => {
      const options = PerformanceOptimizer.generateRecommendedOptions(1000);

      expect(Object.keys(options)).toHaveLength(0);
    });
  });
});