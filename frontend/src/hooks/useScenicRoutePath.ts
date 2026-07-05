import { useEffect, useMemo, useState } from 'react';
import {
  getScenicRoutePath,
  type ScenicMapId,
} from '../api/maps';
import type { RoutingProfile, ScenicRoutePath } from '../types/scenic';

const routePathCache = new Map<string, ScenicRoutePath>();

export default function useScenicRoutePath(
  mapId: ScenicMapId,
  spotIds: string[],
  routingProfile: RoutingProfile = 'fastest',
) {
  const key = useMemo(() => spotIds.join('|'), [spotIds]);
  const cacheKey = useMemo(() => `${mapId}:${routingProfile}:${key}`, [key, mapId, routingProfile]);
  const [routePath, setRoutePath] = useState<ScenicRoutePath | undefined>(() => routePathCache.get(cacheKey));

  useEffect(() => {
    let active = true;
    const cached = routePathCache.get(cacheKey);
    if (cached) {
      setRoutePath(cached);
      return () => {
        active = false;
      };
    }
    setRoutePath(undefined);
    getScenicRoutePath(mapId, spotIds, routingProfile).then((result) => {
      routePathCache.set(cacheKey, result);
      if (active) setRoutePath(result);
    });
    return () => {
      active = false;
    };
  }, [cacheKey, key, mapId, routingProfile]);

  return routePath;
}
