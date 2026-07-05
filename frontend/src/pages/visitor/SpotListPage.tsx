import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import PageLoading from '../../components/common/PageLoading';
import SpotEntryLoader from '../../components/scenic/SpotEntryLoader';
import SpotReel from '../../components/scenic/SpotReel';
import { getSpots } from '../../api/spots';
import type { ScenicSpot } from '../../types/scenic';

const routeOnlySpotIds = new Set(['spot_ls_entrance', 'spot_nh_entrance']);

export default function SpotListPage() {
  const location = useLocation();
  const [spots, setSpots] = useState<ScenicSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEntryLoader, setShowEntryLoader] = useState(true);

  const loadSpots = useCallback(() => {
    setLoading(true);
    setError('');
    getSpots()
      .then((items) => setSpots(items.filter((spot) => !routeOnlySpotIds.has(spot.id))))
      .catch(() => setError('景点数据加载失败，请稍后重试。'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSpots();
  }, [loadSpots]);

  useLayoutEffect(() => {
    setShowEntryLoader(true);
  }, [location.key]);

  const finishEntryLoader = useCallback(() => {
    setShowEntryLoader(false);
  }, []);

  let content = <PageLoading label="正在加载景点列表..." />;
  if (error) {
    content = <ErrorState message={error} onRetry={loadSpots} />;
  } else if (!loading) {
    content = (
      <div className="spot-reel-page">
        {spots.length === 0 ? (
          <EmptyState title="暂无景点" description="请先准备景区种子数据。" />
        ) : (
          <SpotReel spots={spots} />
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className={`spot-entry-content ${
          showEntryLoader ? 'spot-entry-content--waiting' : 'spot-entry-content--ready'
        }`}
        aria-hidden={showEntryLoader}
      >
        {content}
      </div>
      {showEntryLoader ? <SpotEntryLoader preserveHeader onComplete={finishEntryLoader} /> : null}
    </>
  );
}
