import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getScenicMap, type ScenicMapId } from '../../api/maps';
import useScenicRoutePath from '../../hooks/useScenicRoutePath';
import type { RoutePlan, ScenicMap } from '../../types/scenic';
import { loadRouteMapSession, saveRouteMapSession } from '../../utils/visitorSessionState';
import RouteCard from './RouteCard';
import ScenicPointMap, { type ScenicMapCoordinate } from './ScenicPointMap';
import styles from './RouteMapWorkbench.module.css';

const mapOptions: Array<{ id: ScenicMapId; label: string }> = [
  { id: 'ling-shan', label: '灵山胜境' },
  { id: 'nianhua-bay', label: '拈花湾' },
];

// Manual route map scale: 1 fits the container, 0.9 leaves more breathing room.
const ROUTE_MAP_FIT_SCALE = 2;

export interface RouteMapWorkbenchProps {
  routes: RoutePlan[];
  creatingRouteId?: string;
  startingRouteId?: string;
  guideHref?: string;
  onCreateDraft?: (route: RoutePlan) => void;
  onStartTour?: (route: RoutePlan) => void;
  onMapChange?: (mapId: ScenicMapId) => void;
}

export default function RouteMapWorkbench({
  routes,
  creatingRouteId,
  startingRouteId,
  guideHref,
  onCreateDraft,
  onStartTour,
  onMapChange,
}: RouteMapWorkbenchProps) {
  const [initialMapSession] = useState(() => loadRouteMapSession());
  const [maps, setMaps] = useState<Partial<Record<ScenicMapId, ScenicMap>>>({});
  const [activeMapId, setActiveMapId] = useState<ScenicMapId>(
    initialMapSession?.activeMapId ?? routes[0]?.mapId ?? 'ling-shan',
  );
  const [activeRouteId, setActiveRouteId] = useState(
    initialMapSession?.activeRouteId ?? routes[0]?.id ?? '',
  );
  const [isRoutePanelOpen, setIsRoutePanelOpen] = useState(Boolean(routes.length));
  const [pointerCoordinate, setPointerCoordinate] = useState<ScenicMapCoordinate | undefined>();
  const mapRoutes = routes.filter((item) => item.mapId === activeMapId);
  const route = mapRoutes.find((item) => item.id === activeRouteId) ?? mapRoutes[0];
  const map = maps[activeMapId];
  const [activeSpotId, setActiveSpotId] = useState(
    initialMapSession?.activeSpotId ?? route?.spots[0]?.spotId,
  );
  const [scrollToActive, setScrollToActive] = useState(false);
  const routeSpotIds = useMemo(
    () => route?.spots.map((spot) => spot.spotId) ?? [],
    [route?.spots],
  );

  const activeMapPoint = useMemo(
    () => map?.points.find((point) => point.spotId === activeSpotId),
    [activeSpotId, map?.points],
  );

  const displayCoordinate = useMemo(() => {
    if (pointerCoordinate) {
      return pointerCoordinate;
    }
    if (activeMapPoint && map) {
      return {
        x: Math.round(activeMapPoint.xRatio * map.width),
        y: Math.round(activeMapPoint.yRatio * map.height),
        xRatio: activeMapPoint.xRatio,
        yRatio: activeMapPoint.yRatio,
      };
    }
    return { x: 0, y: 0, xRatio: 0, yRatio: 0 };
  }, [activeMapPoint, map, pointerCoordinate]);
  const pointListRoute = useMemo(
    () => (route ? { ...route, name: `${map?.name ?? '当前路线'}点位顺序` } : undefined),
    [map?.name, route],
  );

  useEffect(() => {
    let active = true;
    Promise.all([getScenicMap('ling-shan'), getScenicMap('nianhua-bay')]).then(
      ([lingShanMap, nianhuaBayMap]) => {
        if (!active) return;
        setMaps({
          'ling-shan': lingShanMap,
          'nianhua-bay': nianhuaBayMap,
        });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const mappedSpotIds = useMemo(
    () =>
      new Set(
        Object.values(maps).flatMap((scenicMap) =>
          scenicMap ? scenicMap.points.map((point) => point.spotId) : [],
        ),
      ),
    [maps],
  );

  useEffect(() => {
    const nextMapId = routes[0]?.mapId;
    if (nextMapId && !routes.some((item) => item.mapId === activeMapId)) {
      setActiveMapId(nextMapId);
    }
  }, [activeMapId, routes]);

  useEffect(() => {
    if (routes.length > 0) {
      setIsRoutePanelOpen(true);
    }
    const currentRouteStillAvailable = routes.some(
      (item) => item.id === activeRouteId && item.mapId === activeMapId,
    );
    if (!currentRouteStillAvailable) {
      setActiveRouteId(mapRoutes[0]?.id ?? routes[0]?.id ?? '');
    }
  }, [activeMapId, activeRouteId, mapRoutes, routes]);

  useEffect(() => {
    if (!map) {
      return;
    }
    const firstRouteSpotOnMap = route?.spots.find((spot) =>
      map.points.some((point) => point.spotId === spot.spotId),
    );
    setActiveSpotId((current) => {
      const currentStillVisible = Boolean(
        current &&
          routeSpotIds.includes(current) &&
          map.points.some((point) => point.spotId === current),
      );
      if (currentStillVisible) return current;
      return firstRouteSpotOnMap?.spotId ?? map.points[0]?.spotId ?? '';
    });
    setScrollToActive(false);
  }, [map, route?.id, routeSpotIds]);

  useEffect(() => {
    if (!route) return;
    saveRouteMapSession({
      activeMapId,
      activeRouteId: route.id,
      activeSpotId,
    });
  }, [activeMapId, activeSpotId, route]);

  const routePath = useScenicRoutePath(
    activeMapId,
    routeSpotIds,
    route?.routingProfile ?? 'fastest',
  );

  return (
    <section className={styles.shell} aria-label={`${route?.name ?? '景区'} 地图路线工作台`}>
      <main className={styles.mapPanel} data-testid="route-map-panel">
        {map ? (
          <>
            <header className={styles.mapHeader}>
              <div>
                <span className={styles.mapKicker}>Route viewport</span>
                <span className={styles.mapTitle}>{map.name}</span>
              </div>
              <div className={styles.mapSwitcher} role="tablist" aria-label="切换景区地图">
                {mapOptions.map((option) => {
                  const selected = option.id === activeMapId;
                  return (
                    <button
                      key={option.id}
                      className={[
                        styles.mapSwitch,
                        selected ? styles.mapSwitchActive : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => {
                        setActiveMapId(option.id);
                        setPointerCoordinate(undefined);
                        onMapChange?.(option.id);
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </header>
            <ScenicPointMap
              map={map}
              routeSpotIds={routeSpotIds}
              routePath={routePath}
              activeSpotId={activeSpotId}
              fitToContainer
              panEnabled
              fitScale={ROUTE_MAP_FIT_SCALE}
              onPointerCoordinateChange={setPointerCoordinate}
              onSpotActivate={(spotId) => {
                setScrollToActive(true);
                setActiveSpotId(spotId);
              }}
              onSpotPreview={(spotId) => {
                setScrollToActive(false);
                setActiveSpotId(spotId);
              }}
            />
          </>
        ) : (
          <div className={styles.loading} />
        )}
      </main>
      <aside className={styles.rightRail} aria-label="路线地图信息">
        <section className={styles.panel} data-testid="route-coordinate-panel">
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>坐标显示</span>
            <span className={styles.panelMeta}>{map?.version ?? 'MAP'}</span>
          </div>
          <div className={styles.coordinateReadout} aria-label="当前地图坐标">
            <span>X {displayCoordinate.x}</span>
            <span>Y {displayCoordinate.y}</span>
          </div>
          <div className={styles.coordinateDetail}>
            <span>{map?.name ?? '地图载入中'}</span>
            <span>{activeMapPoint?.name ?? '未选中点位'}</span>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.pointsPanel}`} data-testid="route-points-panel">
          <button
            className={styles.panelToggle}
            type="button"
            aria-expanded={isRoutePanelOpen}
            onClick={() => setIsRoutePanelOpen((current) => !current)}
          >
            <span className={styles.panelTitle}>路线的点位</span>
            <span className={styles.panelMeta}>{isRoutePanelOpen ? '收起' : '展开'}</span>
          </button>
          {isRoutePanelOpen ? (
            <div className={styles.routePanelBody}>
              {mapRoutes.length > 1 ? (
                <div className={styles.routeSelector} aria-label="选择路线">
                  {mapRoutes.map((item, index) => (
                    <button
                      key={item.id}
                      className={[
                        styles.routeChoice,
                        item.id === route?.id ? styles.routeChoiceActive : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      type="button"
                      onClick={() => {
                        setActiveRouteId(item.id);
                        setActiveSpotId(item.spots[0]?.spotId ?? '');
                      }}
                    >
                      路线 {index + 1} · {item.durationMinutes} 分钟
                    </button>
                  ))}
                </div>
              ) : null}
              {route ? (
                <>
                  <div className={styles.routeActions}>
                    <button
                      className={`${styles.actionButton} ${styles.startButton}`}
                      type="button"
                      data-testid="start-recommended-tour"
                      disabled={Boolean(creatingRouteId || startingRouteId)}
                      onClick={() => onStartTour?.(route)}
                    >
                      {startingRouteId === route.id ? '正在开始游览...' : '[ 开始游览 ]'}
                    </button>
                    <button
                      className={styles.actionButton}
                      type="button"
                      data-testid="create-route-draft"
                      disabled={Boolean(creatingRouteId || startingRouteId)}
                      onClick={() => onCreateDraft?.(route)}
                    >
                      {creatingRouteId === route.id ? '正在创建草稿...' : '[ 编辑路线 ]'}
                    </button>
                    {guideHref ? (
                      <Link className={`${styles.actionButton} ${styles.guideButton}`} to={guideHref}>
                        [ 咨询导游 ]
                      </Link>
                    ) : null}
                  </div>
                  <div className={styles.routeCard}>
                    <RouteCard
                      route={pointListRoute ?? route}
                      activeSpotId={activeSpotId}
                      mappedSpotIds={mappedSpotIds}
                      scrollToActive={scrollToActive}
                      onSpotActivate={(spotId) => {
                        setScrollToActive(false);
                        setActiveSpotId(spotId);
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className={styles.emptyPoints}>当前地图暂无推荐路线。</div>
              )}
            </div>
          ) : (
            <div className={styles.collapsedSummary}>
              {route ? `${route.spots.length} 个点位 · ${route.durationMinutes} 分钟` : '暂无路线'}
            </div>
          )}
        </section>
      </aside>
    </section>
  );
}
