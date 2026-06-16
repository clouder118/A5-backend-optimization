import { useEffect, useState } from 'react';
import { Col, Row, Typography } from 'antd';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import PageLoading from '../../components/common/PageLoading';
import SpotCard from '../../components/scenic/SpotCard';
import { getSpots } from '../../api/spots';
import type { ScenicSpot } from '../../types/scenic';

export default function SpotListPage() {
  const [spots, setSpots] = useState<ScenicSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSpots = () => {
    setLoading(true);
    setError('');
    getSpots()
      .then(setSpots)
      .catch(() => setError('景点数据加载失败，请稍后重试。'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSpots();
  }, []);

  if (loading) {
    return <PageLoading label="正在加载景点列表..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadSpots} />;
  }

  return (
    <div className="page-stack">
      <Typography.Title level={1} style={{ margin: 0 }}>
        灵山胜境景点
      </Typography.Title>

      {spots.length === 0 ? (
        <EmptyState title="暂无景点" description="请先准备景区种子数据。" />
      ) : (
        <Row gutter={[16, 16]}>
          {spots.map((spot) => (
            <Col xs={24} sm={12} lg={8} key={spot.id}>
              <SpotCard spot={spot} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
