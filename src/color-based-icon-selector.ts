// カラーコードベースのアイコン選択
// KMLのスタイルカラーから適切なカテゴリーを推測

interface ColorCategory {
  colors: string[];
  icons: string[];
  category: string;
}

const colorCategories: ColorCategory[] = [
  // 赤系 - 重要・緊急・飲食
  {
    colors: ['#FF0000', '#FF5252', '#F44336', '#E53935', '#D32F2F', '#C62828', '#B71C1C'],
    icons: ['restaurant', 'cafe', 'bar', 'hospital', 'fire-station', 'marker'],
    category: '飲食・緊急'
  },
  // 青系 - 情報・サービス・水
  {
    colors: ['#0000FF', '#2196F3', '#1976D2', '#1565C0', '#0D47A1', '#42A5F5', '#64B5F6'],
    icons: ['information', 'water', 'swimming', 'ferry', 'harbor', 'marker'],
    category: '情報・水'
  },
  // 緑系 - 自然・公園・環境
  {
    colors: ['#00FF00', '#4CAF50', '#388E3C', '#2E7D32', '#1B5E20', '#66BB6A', '#81C784'],
    icons: ['park', 'garden', 'campsite', 'mountain', 'forest', 'marker'],
    category: '自然・公園'
  },
  // 黄色系 - 注意・交通
  {
    colors: ['#FFFF00', '#FFD600', '#FFC107', '#FFB300', '#FFA000', '#FF8F00', '#FF6F00'],
    icons: ['parking', 'fuel', 'car', 'bus', 'marker'],
    category: '交通'
  },
  // 紫系 - 文化・宗教
  {
    colors: ['#9C27B0', '#7B1FA2', '#6A1B9A', '#4A148C', '#8E24AA', '#AB47BC'],
    icons: ['place-of-worship', 'museum', 'art-gallery', 'theatre', 'marker'],
    category: '文化・宗教'
  },
  // オレンジ系 - ショッピング・商業
  {
    colors: ['#FF9800', '#F57C00', '#EF6C00', '#E65100', '#FFB74D', '#FFA726'],
    icons: ['shop', 'grocery', 'commercial', 'bank', 'marker'],
    category: 'ショッピング'
  },
  // 茶色系 - 歴史・観光
  {
    colors: ['#795548', '#6D4C41', '#5D4037', '#4E342E', '#8D6E63', '#A1887F'],
    icons: ['monument', 'viewpoint', 'attraction', 'castle', 'marker'],
    category: '観光'
  },
  // グレー系 - 施設・建物
  {
    colors: ['#9E9E9E', '#757575', '#616161', '#424242', '#BDBDBD', '#E0E0E0'],
    icons: ['building', 'lodging', 'hospital', 'school', 'marker'],
    category: '施設'
  }
];

// 色の類似度を計算（RGB距離）
function colorDistance(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return Infinity;
  
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

// HEXカラーをRGBに変換
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // #を除去
  hex = hex.replace('#', '');
  
  // 3桁の場合は6桁に展開
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  
  if (hex.length !== 6) return null;
  
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// スタイルIDから数値を抽出
function extractNumberFromId(styleId: string): number {
  const match = styleId.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}

// カラーコードとスタイルIDから適切なアイコンを選択
export function selectIconByColorAndId(styleId: string, colorCode?: string): string {
  // カラーコードがある場合は、最も近い色のカテゴリーを探す
  if (colorCode) {
    let minDistance = Infinity;
    let selectedCategory: ColorCategory | null = null;
    
    for (const category of colorCategories) {
      for (const color of category.colors) {
        const distance = colorDistance(colorCode, color);
        if (distance < minDistance) {
          minDistance = distance;
          selectedCategory = category;
        }
      }
    }
    
    if (selectedCategory && minDistance < 100) { // 色が十分近い場合
      // スタイルIDの数値を使ってアイコンを選択
      const idNumber = extractNumberFromId(styleId);
      const iconIndex = idNumber % (selectedCategory.icons.length - 1); // markerを除く
      return selectedCategory.icons[iconIndex];
    }
  }
  
  // スタイルIDからカテゴリーを推測
  const idLower = styleId.toLowerCase();
  
  // キーワードマッチング
  if (idLower.includes('parking')) return 'parking';
  if (idLower.includes('restaurant') || idLower.includes('food')) return 'restaurant';
  if (idLower.includes('hotel') || idLower.includes('lodging')) return 'lodging';
  if (idLower.includes('shop') || idLower.includes('store')) return 'shop';
  if (idLower.includes('hospital') || idLower.includes('medical')) return 'hospital';
  if (idLower.includes('school') || idLower.includes('education')) return 'school';
  if (idLower.includes('park') || idLower.includes('garden')) return 'park';
  if (idLower.includes('museum') || idLower.includes('gallery')) return 'museum';
  if (idLower.includes('church') || idLower.includes('temple')) return 'place-of-worship';
  
  // デフォルト：番号に基づいて基本的なアイコンを選択
  const basicIcons = ['marker', 'circle', 'star', 'square', 'triangle'];
  const idNumber = extractNumberFromId(styleId);
  return basicIcons[idNumber % basicIcons.length];
}

// ABGRカラーコードをRGBに変換（KMLフォーマット）
export function abgrToHex(abgr: string): string {
  // ABGRフォーマット: AABBGGRR
  if (abgr.length === 8) {
    const r = abgr.substr(6, 2);
    const g = abgr.substr(4, 2);
    const b = abgr.substr(2, 2);
    return `#${r}${g}${b}`;
  }
  return '#000000';
}