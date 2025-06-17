// デフォルトアイコンのマッピング
// KMLのアイコン名から一般的なMapLibre/Mapboxのアイコン名へのマッピング

export const defaultIconMapping: Record<string, string> = {
  // 交通関連
  'parking': 'parking',
  'parking_11': 'parking-11',
  'parking_lot': 'parking',
  'bus': 'bus',
  'bus_stop': 'bus',
  'train': 'rail',
  'train_station': 'rail',
  'subway': 'rail-metro',
  'airport': 'airport',
  'ferry': 'ferry',
  'taxi': 'car',
  'gas_station': 'fuel',
  
  // 食事・飲み物
  'restaurant': 'restaurant',
  'cafe': 'cafe',
  'coffee': 'cafe',
  'bar': 'bar',
  'beer': 'beer',
  'fast_food': 'fast-food',
  'pizza': 'restaurant-pizza',
  'bakery': 'bakery',
  
  // 宿泊
  'hotel': 'lodging',
  'lodging': 'lodging',
  'camping': 'campsite',
  'hostel': 'lodging',
  
  // ショッピング
  'shopping': 'shop',
  'shop': 'shop',
  'grocery': 'grocery',
  'supermarket': 'grocery',
  'convenience': 'shop',
  'mall': 'commercial',
  
  // 観光・レジャー
  'museum': 'museum',
  'art_gallery': 'art-gallery',
  'theater': 'theatre',
  'cinema': 'cinema',
  'park': 'park',
  'garden': 'garden',
  'zoo': 'zoo',
  'aquarium': 'aquarium',
  'stadium': 'stadium',
  'playground': 'playground',
  'beach': 'beach',
  'swimming': 'swimming',
  
  // 医療・緊急
  'hospital': 'hospital',
  'pharmacy': 'pharmacy',
  'doctor': 'doctor',
  'dentist': 'dentist',
  'police': 'police',
  'fire_station': 'fire-station',
  
  // 教育
  'school': 'school',
  'college': 'college',
  'university': 'college',
  'library': 'library',
  
  // 金融
  'bank': 'bank',
  'atm': 'bank',
  
  // その他の施設
  'post_office': 'post',
  'town_hall': 'town-hall',
  'embassy': 'embassy',
  'place_of_worship': 'place-of-worship',
  'church': 'religious-christian',
  'mosque': 'religious-muslim',
  'synagogue': 'religious-jewish',
  'temple': 'place-of-worship',
  'cemetery': 'cemetery',
  
  // 自然・地形
  'mountain': 'mountain',
  'volcano': 'volcano',
  'waterfall': 'waterfall',
  'forest': 'park',
  'lake': 'water',
  
  // 一般的なマーカー
  'pin': 'marker',
  'marker': 'marker',
  'flag': 'embassy',
  'star': 'star',
  'heart': 'heart',
  'home': 'home',
  'building': 'building',
  'monument': 'monument',
  'information': 'information',
  'viewpoint': 'viewpoint',
  'camera': 'attraction',
  'photo': 'attraction'
};

// アイコン名から類似のアイコンを検索
export function findSimilarIcon(iconName: string): string | null {
  if (!iconName) return null;
  
  // 正規化：小文字に変換し、拡張子を除去
  const normalized = iconName.toLowerCase()
    .replace(/\.[^/.]+$/, '') // 拡張子を除去
    .replace(/[\s_-]+/g, '_'); // スペース、ハイフン、アンダースコアを統一
  
  // 完全一致
  if (defaultIconMapping[normalized]) {
    return defaultIconMapping[normalized];
  }
  
  // 部分一致を試みる
  const keywords = normalized.split('_');
  for (const keyword of keywords) {
    for (const [key, value] of Object.entries(defaultIconMapping)) {
      if (key.includes(keyword) || keyword.includes(key)) {
        return value;
      }
    }
  }
  
  // カテゴリーベースのフォールバック
  if (normalized.includes('food') || normalized.includes('eat')) return 'restaurant';
  if (normalized.includes('drink')) return 'bar';
  if (normalized.includes('shop') || normalized.includes('store')) return 'shop';
  if (normalized.includes('hotel') || normalized.includes('motel')) return 'lodging';
  if (normalized.includes('station')) return 'rail';
  if (normalized.includes('church') || normalized.includes('temple')) return 'place-of-worship';
  if (normalized.includes('park') || normalized.includes('green')) return 'park';
  if (normalized.includes('water') || normalized.includes('sea')) return 'water';
  
  // デフォルトのマーカー
  return 'marker';
}

// Maki iconsのサイズ対応表
export const iconSizes = [11, 15]; // Makiアイコンで利用可能なサイズ

// アイコンサイズを最も近い利用可能なサイズに変換
export function getNearestIconSize(requestedSize: number): number {
  if (requestedSize <= 13) return 11;
  return 15;
}