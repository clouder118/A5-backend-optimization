import { AimOutlined, ClockCircleOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import type { RoutePlan } from '../../types/scenic';

export interface RouteCardProps {
  route?: RoutePlan;
  loading?: boolean;
  error?: string;
  emptyText?: string;
  onRetry?: () => void;
}

export default function RouteCard({
  route,
  loading = false,
  error,
  emptyText = '暂无推荐路线',
  onRetry,
}: RouteCardProps) {
  if (loading) {
    return (
      <Card className="route-card">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="route-card">
        <Alert
          type="warning"
          showIcon
          message="路线加载失败"
          description={error}
          action={
            onRetry ? (
              <Button size="small" onClick={onRetry}>
                重试
              </Button>
            ) : null
          }
        />
      </Card>
    );
  }

  if (!route) {
    return (
      <Card className="route-card">
        <Empty description={emptyText} />
      </Card>
    );
  }

  return (
    <Card
      className="route-card"
      title={route.name}
      extra={
        <Tag color="green" icon={<EnvironmentOutlined />}>
          {route.spots.length} 个点位
        </Tag>
      }
    >
      <Space className="route-card-content" direction="vertical" size={12} style={{ width: '100%' }}>
        <Space size={[8, 8]} wrap>
          <Tag color="gold">{route.theme}</Tag>
          <Tag icon={<ClockCircleOutlined />}>{route.durationMinutes} 分钟</Tag>
          {route.suitableCrowd.map((crowd) => (
            <Tag key={crowd} color="green">
              {crowd}
            </Tag>
          ))}
        </Space>
        <Typography.Paragraph className="route-description" style={{ marginBottom: 0 }}>
          {route.description}
        </Typography.Paragraph>
        <div className="route-reason">
          <AimOutlined />
          <Typography.Text>{route.reason}</Typography.Text>
        </div>
        <div className="route-timeline">
          {route.spots.map((spot, index) => (
            <div className="route-timeline-item" key={`${route.id}-${spot.spotId}`}>
              <div className="route-step-index">{index + 1}</div>
              <div>
                <Typography.Text strong>
                  {spot.name} · {spot.stayMinutes} 分钟
                </Typography.Text>
                <Typography.Paragraph style={{ margin: '4px 0 0' }}>{spot.reason}</Typography.Paragraph>
              </div>
            </div>
          ))}
        </div>
      </Space>
    </Card>
  );
}
