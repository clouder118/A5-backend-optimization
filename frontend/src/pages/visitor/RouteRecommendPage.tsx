import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import HydraRouteLoader from '../../components/scenic/HydraRouteLoader';
import PreferenceForm from '../../components/scenic/PreferenceForm';
import RouteMapWorkbench from '../../components/scenic/RouteMapWorkbench';
import { createRouteDraft } from '../../api/routeDrafts';
import { recommendRoutes } from '../../api/routes';
import { createTour } from '../../api/tours';
import type { RoutePlan, RoutePreferenceInput } from '../../types/scenic';
import {
  buildPreferenceGuideQuestion,
  defaultVisitorPreference,
  loadVisitorPreference,
  preferenceFromSearchParams,
  preferenceToSearchParams,
  saveVisitorPreference,
} from '../../utils/visitorProfile';
import {
  loadRouteRecommendationSession,
  saveRouteRecommendationSession,
} from '../../utils/visitorSessionState';
import styles from './RouteRecommendPage.module.css';

export default function RouteRecommendPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const profileKey = searchParams.toString();
  const urlPreference = useMemo(() => preferenceFromSearchParams(searchParams), [profileKey]);
  const [initialRouteSession] = useState(() => loadRouteRecommendationSession());
  const [routes, setRoutes] = useState<RoutePlan[]>(() => initialRouteSession?.routes ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creatingRouteId, setCreatingRouteId] = useState('');
  const [startingRouteId, setStartingRouteId] = useState('');
  const [showHydraLoader, setShowHydraLoader] = useState(true);
  const [preference, setPreference] = useState<RoutePreferenceInput>(() =>
    initialRouteSession?.preference ?? urlPreference,
  );

  useEffect(() => {
    document.body.classList.add('route-workbench-active');
    return () => {
      document.body.classList.remove('route-workbench-active');
    };
  }, []);

  const loadRoutes = (values: RoutePreferenceInput) => {
    saveVisitorPreference(values);
    setPreference(values);
    setLoading(true);
    setError('');
    recommendRoutes(values)
      .then((nextRoutes) => {
        setRoutes(nextRoutes);
        saveRouteRecommendationSession({
          preference: values,
          routes: nextRoutes,
        });
      })
      .catch(() => setError('路线推荐失败，请稍后重试。'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const hasCachedRoutes = Boolean(initialRouteSession?.routes.length);
    const hasUrlPreference = profileKey.length > 0;
    if (hasCachedRoutes && (!hasUrlPreference || samePreference(initialRouteSession?.preference, urlPreference))) {
      return;
    }
    loadRoutes(hasUrlPreference ? urlPreference : loadVisitorPreference());
  }, []);

  useEffect(() => {
    setShowHydraLoader(true);
  }, [location.key]);

  const finishHydraLoader = useCallback(() => {
    setShowHydraLoader(false);
  }, []);

  const guideParams = preferenceToSearchParams(preference);
  guideParams.set('question', buildPreferenceGuideQuestion(preference));
  const guideHref = `/guide?${guideParams.toString()}`;

  const editRoute = async (route: RoutePlan) => {
    setCreatingRouteId(route.id);
    setError('');
    try {
      const draft = await createRouteDraft(route, preference);
      navigate(`/route-drafts/${draft.id}`);
    } catch {
      setError('路线草稿创建失败，请稍后重试。');
    } finally {
      setCreatingRouteId('');
    }
  };

  const startTour = async (route: RoutePlan) => {
    setStartingRouteId(route.id);
    setError('');
    try {
      const draft = await createRouteDraft(route, {
        ...preference,
        mapId: route.mapId,
      });
      const tour = await createTour(draft.id, route.mapId);
      navigate(`/tour/${tour.id}`);
    } catch {
      setError('开始游览失败，请稍后重试。');
    } finally {
      setStartingRouteId('');
    }
  };

  return (
    <div className={`${styles.page} route-page`} data-testid="route-workbench-page">
      <div
        className={[styles.content, showHydraLoader ? styles.contentWaiting : styles.contentReady]
          .filter(Boolean)
          .join(' ')}
        aria-hidden={showHydraLoader}
      >
        <h1 className={styles.srOnly}>个性化路线推荐</h1>
        <div className={styles.workspace} data-testid="route-workbench">
          <aside className={`route-filter-column ${styles.preferenceRail}`} data-testid="route-preference-rail">
            <PreferenceForm initialValues={preference} loading={loading} error={error} onSubmit={loadRoutes} />
          </aside>

          <section className={styles.results} data-testid="route-workbench-stage">
            {loading ? (
              <div className={styles.statusPanel} role="status">
                <span className={styles.statusKicker}>ROUTE ENGINE</span>
                <strong>正在生成路线</strong>
                <p>系统正在计算点位顺序、步行时间和地图路径。</p>
              </div>
            ) : null}
            {error ? (
              <div className={styles.statusPanel} role="alert">
                <span className={styles.statusKicker}>ROUTE ERROR</span>
                <strong>路线加载失败</strong>
                <p>{error}</p>
                <button type="button" onClick={() => loadRoutes(defaultVisitorPreference)}>
                  [ 重试 ]
                </button>
              </div>
            ) : null}
            {!error && routes.length === 0 && !loading ? (
              <div className={styles.statusPanel}>
                <span className={styles.statusKicker}>NO ROUTE</span>
                <strong>暂无路线</strong>
                <p>请选择左侧偏好后生成推荐。</p>
              </div>
            ) : null}
            {!loading && !error && routes.length > 0 ? (
              <RouteMapWorkbench
                routes={routes}
                creatingRouteId={creatingRouteId}
                startingRouteId={startingRouteId}
                guideHref={guideHref}
                onCreateDraft={editRoute}
                onStartTour={startTour}
                onMapChange={(mapId) => loadRoutes({ ...preference, mapId })}
              />
            ) : null}
          </section>
        </div>
      </div>
      {showHydraLoader ? <HydraRouteLoader onComplete={finishHydraLoader} /> : null}
    </div>
  );
}

function samePreference(left?: RoutePreferenceInput, right?: RoutePreferenceInput) {
  if (!left || !right) return false;
  return (
    left.mapId === right.mapId &&
    left.durationMinutes === right.durationMinutes &&
    left.physicalLevel === right.physicalLevel &&
    left.interestTags.join('|') === right.interestTags.join('|')
  );
}
