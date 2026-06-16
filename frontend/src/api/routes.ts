import { requestJson } from './client';
import { USE_MOCK_API } from './config';
import { routePlans } from './mock/visitorData';
import type { RoutePlan, RoutePreferenceInput } from '../types/scenic';

const wait = (ms = 260) => new Promise((resolve) => window.setTimeout(resolve, ms));

const preferenceMap = {
  family: '亲子游',
  culture: '历史文化游',
  relax: '轻松游',
  photo: '摄影游',
} as const;

const physicalLevelMap = {
  low: '低',
  medium: '中',
  high: '高',
} as const;

interface BackendRouteSpot {
  id: string;
  name: string;
  stay_minutes: number;
  reason: string;
}

interface BackendRoute {
  id: string;
  name: string;
  theme: string;
  total_minutes: number;
  spots: BackendRouteSpot[];
  recommendation_reason: string;
}

interface BackendRouteResponse {
  items: BackendRoute[];
}

function toRoutePlan(route: BackendRoute): RoutePlan {
  return {
    id: route.id,
    name: route.name,
    theme: route.theme,
    durationMinutes: route.total_minutes,
    suitableCrowd: [route.theme],
    description: route.recommendation_reason,
    reason: route.recommendation_reason,
    spots: route.spots.map((spot) => ({
      spotId: spot.id,
      name: spot.name,
      stayMinutes: spot.stay_minutes,
      reason: spot.reason,
    })),
  };
}

export async function recommendRoutes(input: RoutePreferenceInput): Promise<RoutePlan[]> {
  if (!USE_MOCK_API) {
    const response = await requestJson<BackendRouteResponse, unknown>('/api/routes/recommend', {
      method: 'POST',
      body: {
        visitor_type: preferenceMap[input.visitorType],
        duration_minutes: input.durationMinutes,
        physical_level: physicalLevelMap[input.physicalLevel],
        interest_tags: input.interestTags,
      },
    });
    return response.items.map(toRoutePlan);
  }

  await wait();

  const preferredLabel = preferenceMap[input.visitorType];
  const filtered = routePlans.filter(
    (route) =>
      route.suitableCrowd.includes(preferredLabel) ||
      route.durationMinutes <= input.durationMinutes + 20,
  );

  return filtered.length > 0 ? filtered : routePlans.slice(0, 2);
}
