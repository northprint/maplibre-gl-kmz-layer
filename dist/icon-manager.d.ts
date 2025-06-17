import type { Map as MaplibreMap } from 'maplibre-gl';
import JSZip from 'jszip';
export declare class IconManager {
    private map;
    private loadedIcons;
    private iconCache;
    constructor(map: MaplibreMap);
    extractIconsFromKMZ(zip: JSZip, iconUrls: string[]): Promise<Map<string, string>>;
    loadExternalIcon(url: string): Promise<string | null>;
    addIconToMap(iconId: string, iconUrl: string, scale?: number): Promise<boolean>;
    private blobToDataURL;
    private loadImage;
    private scaleImage;
    hasIcon(iconId: string): boolean;
    clear(): void;
}
//# sourceMappingURL=icon-manager.d.ts.map