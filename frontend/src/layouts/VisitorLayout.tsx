import { Button, Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import type { MouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearVisitorToken, getCurrentVisitor, readVisitorToken } from '../api/auth';
import LingShanLoadingOverlay from '../components/common/LingShanLoadingOverlay';
import { productCopy } from '../config/product';
import type { AuthUser } from '../types/api';
import { VisitorAuthContext } from '../utils/visitorAuthContext';
import { clearVisitorSessionState, loadRouteEntrySession } from '../utils/visitorSessionState';

const guestNavItems: MenuProps['items'] = [{ key: '/', label: <Link to="/">[ 首页 ]</Link> }];
const HOME_TRANSITION_NAVIGATION_DELAY_MS = 280;

function isProtectedVisitorPath(pathname: string) {
  return (
    pathname === '/spots' ||
    pathname.startsWith('/spots/') ||
    pathname === '/routes' ||
    pathname.startsWith('/route-drafts/') ||
    pathname.startsWith('/tour/') ||
    pathname === '/guide'
  );
}

export default function VisitorLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const previousPathRef = useRef(location.pathname);
  const skipNextHomeLoaderRef = useRef(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeLoaderMode, setHomeLoaderMode] = useState<'pre-navigation' | 'post-navigation' | null>(null);
  const isHome = location.pathname === '/';
  const isSpots = location.pathname === '/spots';
  const isSpotDetail = /^\/spots\/[^/]+$/.test(location.pathname);
  const usesFixedVisitorHeader = isHome || isSpots;
  const isSignedIn = Boolean(user);
  const shouldShowEntryLoader = Boolean(
    (location.state as { showLingShanLoader?: boolean } | null)?.showLingShanLoader,
  );
  const handleHomeNavigation = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (!isSignedIn || location.pathname === '/' || homeLoaderMode) return;
    event.preventDefault();
    setHomeLoaderMode('pre-navigation');
  }, [homeLoaderMode, isSignedIn, location.pathname]);
  const routeEntry = loadRouteEntrySession();
  const shouldResetRouteEntry =
    routeEntry?.mode !== 'tour' && (location.pathname === '/' || location.pathname.startsWith('/spots'));
  const routeNavPath = shouldResetRouteEntry ? '/routes' : routeEntry?.path ?? '/routes';
  const routeNavState = location.pathname === '/guide' && routeEntry?.skipHydraLoader && routeNavPath.startsWith('/routes')
    ? { skipHydraLoader: true }
    : undefined;
  const visitorNavItems = useMemo<MenuProps['items']>(() => [
    { key: '/', label: <Link to="/" onClick={handleHomeNavigation}>[ 首页 ]</Link> },
    { key: '/spots', label: <Link to="/spots">[ 景点 ]</Link> },
    { key: '/routes', label: <Link to={routeNavPath} state={routeNavState}>[ 路线 ]</Link> },
    { key: '/guide', label: <Link to="/guide">[ 导游 ]</Link> },
  ], [handleHomeNavigation, routeNavPath, routeNavState]);
  const navItems = isSignedIn ? visitorNavItems : guestNavItems;
  const selectedKey =
    navItems?.find((item) => typeof item?.key === 'string' && location.pathname === item.key)?.key?.toString() ||
    (location.pathname.startsWith('/spots') ? '/spots' : '') ||
    (location.pathname === '/routes' || location.pathname.startsWith('/route-drafts/') || location.pathname.startsWith('/tour/')
      ? '/routes'
      : '/');

  useEffect(() => {
    let cancelled = false;
    const token = readVisitorToken();
    if (!token) {
      clearVisitorSessionState();
      setUser(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    getCurrentVisitor(token)
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser.role === 'visitor' ? currentUser : null);
        }
      })
      .catch(() => {
        clearVisitorToken();
        clearVisitorSessionState();
        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading && !user && isProtectedVisitorPath(location.pathname)) {
      navigate('/', { replace: true });
    }
  }, [loading, location.pathname, navigate, user]);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const currentPath = location.pathname;

    if (currentPath === '/' && previousPath !== '/' && skipNextHomeLoaderRef.current) {
      skipNextHomeLoaderRef.current = false;
    } else if (!loading && user && currentPath === '/' && previousPath !== '/' && !homeLoaderMode) {
      setHomeLoaderMode('post-navigation');
    }

    previousPathRef.current = currentPath;
  }, [homeLoaderMode, loading, location.pathname, user]);

  useEffect(() => {
    if (loading || !user || location.pathname !== '/' || !shouldShowEntryLoader || homeLoaderMode) return;
    setHomeLoaderMode('post-navigation');
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [homeLoaderMode, loading, location.pathname, location.search, navigate, shouldShowEntryLoader, user]);

  useEffect(() => {
    if (homeLoaderMode !== 'pre-navigation' || location.pathname === '/') return undefined;

    const timer = window.setTimeout(() => {
      skipNextHomeLoaderRef.current = true;
      navigate('/');
    }, HOME_TRANSITION_NAVIGATION_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [homeLoaderMode, location.pathname, navigate]);

  const finishHomeLoader = useCallback(() => {
    setHomeLoaderMode(null);
  }, []);

  const authState = useMemo(
    () => ({
      user,
      loading,
      logout: () => {
        clearVisitorToken();
        clearVisitorSessionState();
        setUser(null);
        navigate('/', { replace: true });
      },
    }),
    [loading, navigate, user],
  );

  return (
    <VisitorAuthContext.Provider value={authState}>
      <Layout
        className={`visitor-layout ${isHome ? 'visitor-layout-home' : ''} ${isSpots ? 'visitor-layout-spots' : ''} ${
          isSpotDetail ? 'visitor-layout-immersive' : ''
        } ${usesFixedVisitorHeader ? 'visitor-layout-fixed-header' : ''}`}
      >
        {!isSpotDetail ? (
          <Layout.Header className="visitor-header">
            <Link to="/" className="brand-mark" data-cue="[ 首页 ]" onClick={handleHomeNavigation}>
              <span className="brand-symbol" aria-hidden="true">
                L
              </span>
              <span className="brand-text">{productCopy.visitorBrandName}</span>
            </Link>
            <Menu className="visitor-menu" mode="horizontal" selectedKeys={[selectedKey]} items={navItems} />
            <div className="visitor-auth-actions">
              {isSignedIn ? (
                <>
                  <span className="visitor-user-label">[ {user?.username} ]</span>
                  <Button onClick={authState.logout}>[ 退出 ]</Button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button>[ 登录 ]</Button>
                  </Link>
                  <Link to="/register">
                    <Button type="primary">[ 注册 ]</Button>
                  </Link>
                </>
              )}
            </div>
          </Layout.Header>
        ) : null}
        <Layout.Content className="visitor-content">
          <Outlet />
        </Layout.Content>
        {homeLoaderMode ? <LingShanLoadingOverlay preserveHeader onComplete={finishHomeLoader} /> : null}
      </Layout>
    </VisitorAuthContext.Provider>
  );
}
