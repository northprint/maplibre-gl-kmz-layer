// 色変換ユーティリティ
export function kmlColorToRgba(kmlColor: string): string {
  // KML色形式: aabbggrr (16進数)
  if (!kmlColor || kmlColor.length < 6) {
    return 'rgba(0, 0, 0, 1)';
  }
  
  // 先頭の#を除去
  const color = kmlColor.replace('#', '');
  
  let a = 255;
  let b, g, r;
  
  if (color.length === 8) {
    // aabbggrr形式
    a = parseInt(color.substring(0, 2), 16);
    b = parseInt(color.substring(2, 4), 16);
    g = parseInt(color.substring(4, 6), 16);
    r = parseInt(color.substring(6, 8), 16);
  } else if (color.length === 6) {
    // bbggrr形式（アルファなし）
    b = parseInt(color.substring(0, 2), 16);
    g = parseInt(color.substring(2, 4), 16);
    r = parseInt(color.substring(4, 6), 16);
  } else {
    return 'rgba(0, 0, 0, 1)';
  }
  
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`;
}

// 座標配列をパース
export function parseCoordinates(coordString: string): number[][] {
  if (!coordString) return [];
  
  // 空白文字、改行、タブで分割してフィルタリング
  const coords = coordString.trim().split(/\s+/).filter(c => c.length > 0);
  
  return coords.map(coord => {
    const parts = coord.split(',').map(p => parseFloat(p));
    // [経度, 緯度, 高度] の形式
    return [parts[0], parts[1], parts[2] || 0];
  }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
}