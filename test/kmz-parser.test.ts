import { KMZParser } from '../src/kmz-parser';
import JSZip from 'jszip';

describe('KMZParser', () => {
  let parser: KMZParser;

  beforeEach(() => {
    parser = new KMZParser();
  });

  describe('parseKML', () => {
    it('should parse simple KML with point', () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <name>Test KML</name>
            <Placemark>
              <name>Tokyo Tower</name>
              <description>Famous landmark</description>
              <Point>
                <coordinates>139.7454,35.6586,0</coordinates>
              </Point>
            </Placemark>
          </Document>
        </kml>`;

      const result = parser.parseKML(kml);

      expect(result.features.features).toHaveLength(1);
      expect(result.features.features[0].geometry.type).toBe('Point');
      const feature = result.features.features[0];
      expect(feature.geometry.type).toBe('Point');
      if (feature.geometry.type === 'Point') {
        expect(feature.geometry.coordinates).toEqual([139.7454, 35.6586, 0]);
      }
      expect(feature.properties?.name).toBe('Tokyo Tower');
      expect(feature.properties?.description).toBe('Famous landmark');
      expect(result.metadata?.name).toBe('Test KML');
    });

    it('should parse KML with LineString', () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Test Line</name>
              <LineString>
                <coordinates>
                  139.7454,35.6586,0
                  139.7464,35.6596,0
                  139.7474,35.6606,0
                </coordinates>
              </LineString>
            </Placemark>
          </Document>
        </kml>`;

      const result = parser.parseKML(kml);

      expect(result.features.features).toHaveLength(1);
      expect(result.features.features[0].geometry.type).toBe('LineString');
      const feature = result.features.features[0];
      if (feature.geometry.type === 'LineString') {
        expect(feature.geometry.coordinates).toHaveLength(3);
      }
    });

    it('should parse KML with Polygon', () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Test Polygon</name>
              <Polygon>
                <outerBoundaryIs>
                  <LinearRing>
                    <coordinates>
                      139.7454,35.6586,0
                      139.7464,35.6586,0
                      139.7464,35.6596,0
                      139.7454,35.6596,0
                      139.7454,35.6586,0
                    </coordinates>
                  </LinearRing>
                </outerBoundaryIs>
              </Polygon>
            </Placemark>
          </Document>
        </kml>`;

      const result = parser.parseKML(kml);

      expect(result.features.features).toHaveLength(1);
      expect(result.features.features[0].geometry.type).toBe('Polygon');
      const feature = result.features.features[0];
      if (feature.geometry.type === 'Polygon') {
        expect(feature.geometry.coordinates[0]).toHaveLength(5);
      }
    });

    it('should parse styles', () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Style id="redLine">
              <LineStyle>
                <color>ff0000ff</color>
                <width>3</width>
              </LineStyle>
            </Style>
            <Placemark>
              <styleUrl>#redLine</styleUrl>
              <LineString>
                <coordinates>139.7454,35.6586,0 139.7464,35.6596,0</coordinates>
              </LineString>
            </Placemark>
          </Document>
        </kml>`;

      const result = parser.parseKML(kml);

      expect(Object.keys(result.styles)).toHaveLength(1);
      expect(result.styles['#redLine']).toBeDefined();
      expect(result.styles['#redLine'].color).toBe('rgba(255, 0, 0, 1.00)');
      expect(result.styles['#redLine'].width).toBe(3);
    });

    it('should parse ExtendedData', () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Test Point</name>
              <ExtendedData>
                <Data name="population">
                  <value>1000000</value>
                </Data>
                <Data name="category">
                  <value>city</value>
                </Data>
              </ExtendedData>
              <Point>
                <coordinates>139.7454,35.6586,0</coordinates>
              </Point>
            </Placemark>
          </Document>
        </kml>`;

      const result = parser.parseKML(kml);

      const feature = result.features.features[0];
      expect(feature.properties?.population).toBe('1000000');
      expect(feature.properties?.category).toBe('city');
    });

    it('should handle MultiGeometry', () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Multi Feature</name>
              <MultiGeometry>
                <Point>
                  <coordinates>139.7454,35.6586,0</coordinates>
                </Point>
                <LineString>
                  <coordinates>139.7454,35.6586,0 139.7464,35.6596,0</coordinates>
                </LineString>
              </MultiGeometry>
            </Placemark>
          </Document>
        </kml>`;

      const result = parser.parseKML(kml);

      expect(result.features.features).toHaveLength(1);
      expect(result.features.features[0].geometry.type).toBe('GeometryCollection');
      const feature = result.features.features[0];
      if (feature.geometry.type === 'GeometryCollection') {
        expect(feature.geometry.geometries).toHaveLength(2);
      }
    });
  });

  describe('parseKMZ', () => {
    it('should extract and parse KML from KMZ', async () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <name>Test KMZ</name>
            <Placemark>
              <name>Test Point</name>
              <Point>
                <coordinates>139.7454,35.6586,0</coordinates>
              </Point>
            </Placemark>
          </Document>
        </kml>`;

      // KMZファイルを作成
      const zip = new JSZip();
      zip.file('doc.kml', kml);
      const kmzData = await zip.generateAsync({ type: 'arraybuffer' });

      const result = await parser.parseKMZ(kmzData);

      expect(result.features.features).toHaveLength(1);
      expect(result.metadata?.name).toBe('Test KMZ');
    });

    it('should throw error if no KML file found', async () => {
      const zip = new JSZip();
      zip.file('test.txt', 'Not a KML file');
      const kmzData = await zip.generateAsync({ type: 'arraybuffer' });

      await expect(parser.parseKMZ(kmzData)).rejects.toThrow('KMLファイルが見つかりません');
    });
  });
});