import { kmlColorToRgba, parseCoordinates } from '../src/utils';

describe('Utils', () => {
  describe('kmlColorToRgba', () => {
    it('should convert KML color format to RGBA', () => {
      // KML形式: aabbggrr
      expect(kmlColorToRgba('#ff0000ff')).toBe('rgba(255, 0, 0, 1.00)');
      expect(kmlColorToRgba('#80ff0000')).toBe('rgba(0, 0, 255, 0.50)');
      expect(kmlColorToRgba('#ff00ff00')).toBe('rgba(0, 255, 0, 1.00)');
    });

    it('should handle colors without alpha', () => {
      // bbggrr形式
      expect(kmlColorToRgba('#0000ff')).toBe('rgba(255, 0, 0, 1.00)');
      expect(kmlColorToRgba('#00ff00')).toBe('rgba(0, 255, 0, 1.00)');
      expect(kmlColorToRgba('#ff0000')).toBe('rgba(0, 0, 255, 1.00)');
    });

    it('should handle invalid colors', () => {
      expect(kmlColorToRgba('')).toBe('rgba(0, 0, 0, 1)');
      expect(kmlColorToRgba('#')).toBe('rgba(0, 0, 0, 1)');
      expect(kmlColorToRgba('#ff')).toBe('rgba(0, 0, 0, 1)');
    });

    it('should remove # prefix if present', () => {
      expect(kmlColorToRgba('ff0000ff')).toBe('rgba(255, 0, 0, 1.00)');
    });
  });

  describe('parseCoordinates', () => {
    it('should parse coordinate string correctly', () => {
      const coordString = '139.7670,35.6814,0 139.7680,35.6824,10';
      const result = parseCoordinates(coordString);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([139.7670, 35.6814, 0]);
      expect(result[1]).toEqual([139.7680, 35.6824, 10]);
    });

    it('should handle coordinates without altitude', () => {
      const coordString = '139.7670,35.6814 139.7680,35.6824';
      const result = parseCoordinates(coordString);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([139.7670, 35.6814, 0]);
      expect(result[1]).toEqual([139.7680, 35.6824, 0]);
    });

    it('should handle newlines and tabs', () => {
      const coordString = `
        139.7670,35.6814,0
        139.7680,35.6824,10
        139.7690,35.6834,20
      `;
      const result = parseCoordinates(coordString);
      
      expect(result).toHaveLength(3);
    });

    it('should filter out invalid coordinates', () => {
      const coordString = '139.7670,35.6814,0 invalid,data 139.7680,35.6824,10';
      const result = parseCoordinates(coordString);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([139.7670, 35.6814, 0]);
      expect(result[1]).toEqual([139.7680, 35.6824, 10]);
    });

    it('should return empty array for empty input', () => {
      expect(parseCoordinates('')).toEqual([]);
      expect(parseCoordinates('   ')).toEqual([]);
    });
  });
});