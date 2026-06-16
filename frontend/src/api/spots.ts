import { requestJson } from './client';
import { USE_MOCK_API } from './config';
import { scenicSpots } from './mock/visitorData';
import { resolveSpotImage } from './spotImages';
import type { ScenicSpot, SpotCollectionStats } from '../types/scenic';

const wait = (ms = 240) => new Promise((resolve) => window.setTimeout(resolve, ms));

interface BackendSpot {
  id: string;
  name: string;
  summary: string;
  story?: string;
  tags: string[];
  visit_minutes: number;
  crowd_types?: string[];
  image_url?: string;
}

interface BackendSpotList {
  items: BackendSpot[];
  total: number;
}

interface BackendSpotSummary {
  listed_spot_count: number;
  collected_spot_count: number;
}

function toScenicSpot(spot: BackendSpot): ScenicSpot {
  return {
    id: spot.id,
    name: spot.name,
    subtitle: spot.tags.slice(0, 2).join(' / ') || '灵山胜境',
    summary: spot.summary,
    story: spot.story ?? spot.summary,
    tags: spot.tags,
    crowdTypes: spot.crowd_types ?? [],
    durationMinutes: spot.visit_minutes,
    openInfo: '请以景区现场公告为准',
    serviceHint: '可结合现场导览标识安排游览顺序。',
    coverTone: spot.tags.includes('服务') ? 'service' : 'culture',
    imageUrl: resolveSpotImage(spot.id, spot.image_url),
    highlights: spot.tags.slice(0, 3),
  };
}

export async function getSpots(): Promise<ScenicSpot[]> {
  if (!USE_MOCK_API) {
    const response = await requestJson<BackendSpotList>('/api/spots');
    return response.items.map(toScenicSpot);
  }

  await wait();
  return scenicSpots.map((spot) => ({
    ...spot,
    imageUrl: resolveSpotImage(spot.id, spot.imageUrl),
  }));
}

export async function getSpotCollectionStats(): Promise<SpotCollectionStats> {
  if (!USE_MOCK_API) {
    const response = await requestJson<BackendSpotSummary>('/api/spots/summary');
    return {
      listedSpotCount: response.listed_spot_count,
      collectedSpotCount: response.collected_spot_count,
    };
  }

  await wait();
  return {
    listedSpotCount: scenicSpots.length,
    collectedSpotCount: scenicSpots.length,
  };
}

export async function getSpotDetail(spotId: string): Promise<ScenicSpot | undefined> {
  if (!USE_MOCK_API) {
    const response = await requestJson<BackendSpot>(`/api/spots/${encodeURIComponent(spotId)}`);
    return toScenicSpot(response);
  }

  await wait();
  const spot = scenicSpots.find((item) => item.id === spotId);
  return spot
    ? {
        ...spot,
        imageUrl: resolveSpotImage(spot.id, spot.imageUrl),
      }
    : undefined;
}
