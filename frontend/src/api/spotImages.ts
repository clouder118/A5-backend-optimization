const spotImageBase = '/scenic/spots';
const spotPhotoBase = `${spotImageBase}/photos`;

export const spotImageMap: Record<string, string> = {
  spot_ls_001: `${spotPhotoBase}/LS-001_灵山大照壁/1.jpg`,
  spot_ls_002: `${spotPhotoBase}/LS-002_五明桥/2.jpg`,
  spot_ls_003: `${spotPhotoBase}/LS-003_佛足坛/1.jpg`,
  spot_ls_004: `${spotPhotoBase}/LS-004_五智门/1.jpg`,
  spot_ls_005: `${spotPhotoBase}/LS-005_菩提大道/1.jpg`,
  spot_nine_dragons: `${spotPhotoBase}/LS-006_九龙灌浴/1.jpg`,
  spot_ls_007: `${spotPhotoBase}/LS-007_降魔浮雕/2.jpg`,
  spot_ls_008: `${spotPhotoBase}/LS-008_阿育王柱/2.jpg`,
  spot_ls_009: `${spotPhotoBase}/LS-009_百子戏弥勒/1.jpg`,
  spot_xiangfu_temple: `${spotPhotoBase}/LS-010_祥符禅寺/1.jpg`,
  spot_ling_shan_buddha: `${spotPhotoBase}/LS-011_灵山大佛/1.jpg`,
  spot_ls_012: `${spotPhotoBase}/LS-012_佛教文化博览馆/1.jpg`,
  spot_brahma_palace: `${spotPhotoBase}/LS-013_灵山梵宫/2.jpg`,
  spot_five_mudra_mandala: `${spotPhotoBase}/LS-014_五印坛城/2.jpg`,
  spot_ls_015: `${spotPhotoBase}/LS-015_曼飞龙塔/1.jpg`,
  spot_ls_016: `${spotPhotoBase}/LS-016_无尽意斋/2.jpg`,
  spot_nh_001: `${spotPhotoBase}/NH-001_拈花广场/2.jpg`,
  spot_nh_002: `${spotPhotoBase}/NH-002_梵天花海/2.jpg`,
  spot_nh_003: `${spotPhotoBase}/NH-003_香月花街/2.jpg`,
  spot_nh_004: `${spotPhotoBase}/NH-004_拈花堂/2.jpg`,
  spot_nh_005: `${spotPhotoBase}/NH-005_五灯湖/2.jpg`,
  spot_nh_006: `${spotPhotoBase}/NH-006_鹿鸣谷/1.jpg`,
  'yuanxiang-hall': `${spotImageBase}/lake.svg`,
  'xiaofeihong-bridge': `${spotImageBase}/bridge-water.svg`,
  'lotus-wind-pavilion': `${spotImageBase}/garden-path.svg`,
  'bonsai-garden': `${spotImageBase}/flower-field.svg`,
  'visitor-service': `${spotImageBase}/service.svg`,
};

export const fallbackSpotImage = `${spotImageBase}/default.svg`;

export function resolveSpotImage(spotId: string, backendImageUrl?: string): string {
  const trimmed = backendImageUrl?.trim();
  if (trimmed) {
    return trimmed;
  }

  return spotImageMap[spotId] ?? fallbackSpotImage;
}
