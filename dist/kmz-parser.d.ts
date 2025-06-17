import { KMZParseResult } from './types';
export declare class KMZParser {
    private domParser;
    private doc;
    constructor();
    getLastDocument(): any | null;
    parseKMZ(data: ArrayBuffer | Blob): Promise<KMZParseResult>;
    parseKML(kmlContent: string): KMZParseResult;
    private extractStyles;
    private extractPlacemarks;
    private extractGeometry;
    private extractSingleGeometry;
    private extractExtendedData;
    private placemarkToFeature;
    private extractMetadata;
}
//# sourceMappingURL=kmz-parser.d.ts.map