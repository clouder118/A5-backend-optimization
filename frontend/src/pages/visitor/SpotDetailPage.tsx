import { useEffect, useState } from 'react';
import { ArrowLeftOutlined, CompassOutlined, MessageOutlined } from '@ant-design/icons';
import { Button, Card, Col, Descriptions, Row, Space, Tag, Typography } from 'antd';
import { Link, useParams } from 'react-router-dom';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import PageLoading from '../../components/common/PageLoading';
import { fallbackSpotImage } from '../../api/spotImages';
import { getSpotDetail } from '../../api/spots';
import type { ScenicSpot } from '../../types/scenic';

export default function SpotDetailPage() {
  const { spotId } = useParams();
  const [spot, setSpot] = useState<ScenicSpot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSpot = () => {
    if (!spotId) {
      setError('缺少景点 ID。');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    getSpotDetail(spotId)
      .then(setSpot)
      .catch(() => setError('景点详情加载失败。'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSpot();
  }, [spotId]);

  if (loading) {
    return <PageLoading label="正在加载景点详情..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadSpot} />;
  }

  if (!spot) {
    return <EmptyState title="未找到景点" description="请回到景点列表重新选择。" />;
  }

  const guideQuestion = `请介绍一下${spot.name}的主要看点、适合人群和游览建议。`;
  const guideHref = `/guide?spotId=${encodeURIComponent(spot.id)}&spotName=${encodeURIComponent(
    spot.name,
  )}&question=${encodeURIComponent(guideQuestion)}`;

  return (
    <div className="page-stack">
      <Link to="/spots">
        <Button icon={<ArrowLeftOutlined />}>返回景点列表</Button>
      </Link>

      <Card className="spot-detail-hero">
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={9}>
            {spot.imageUrl ? (
              <img
                className="spot-detail-image"
                src={spot.imageUrl}
                alt={`${spot.name}景点图`}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = fallbackSpotImage;
                }}
              />
            ) : (
              <div className={`spot-visual tone-${spot.coverTone} spot-detail-image`} aria-hidden="true" />
            )}
          </Col>
          <Col xs={24} lg={15}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div>
                <Typography.Title level={1} style={{ marginBottom: 6 }}>
                  {spot.name}
                </Typography.Title>
                <Typography.Text type="secondary">{spot.subtitle}</Typography.Text>
              </div>
              <Space size={[8, 8]} wrap>
                {spot.tags.map((tag) => (
                  <Tag color="green" key={tag}>
                    {tag}
                  </Tag>
                ))}
              </Space>
              <Typography.Paragraph style={{ fontSize: 16, lineHeight: 1.9 }}>
                {spot.summary}
              </Typography.Paragraph>
              <Space wrap>
                <Link to={guideHref}>
                  <Button type="primary" icon={<MessageOutlined />}>
                    问 AI 导游讲这个景点
                  </Button>
                </Link>
                <Link to="/routes">
                  <Button icon={<CompassOutlined />}>加入路线推荐</Button>
                </Link>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card className="spot-detail-card" title="导游讲解词">
            <Typography.Paragraph style={{ lineHeight: 1.9 }}>{spot.story}</Typography.Paragraph>
            <Typography.Title level={5}>讲解亮点</Typography.Title>
            <Space size={[8, 8]} wrap>
              {spot.highlights.map((highlight) => (
                <Tag color="gold" key={highlight}>
                  {highlight}
                </Tag>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card className="spot-detail-card" title="游览信息">
            <Descriptions column={1} size="middle">
              <Descriptions.Item label="建议停留">{spot.durationMinutes} 分钟</Descriptions.Item>
              <Descriptions.Item label="适合人群">
                {spot.crowdTypes.length ? spot.crowdTypes.join('、') : '轻松游、历史文化游'}
              </Descriptions.Item>
              <Descriptions.Item label="开放信息">{spot.openInfo}</Descriptions.Item>
              <Descriptions.Item label="服务提醒">{spot.serviceHint}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card className="spot-detail-card spot-question-card" title="可以这样问 AI" style={{ marginTop: 16 }}>
            <Space direction="vertical" size={10}>
              {[guideQuestion, `${spot.name}适合带小朋友看吗？`, `${spot.name}附近路线怎么安排？`].map((question) => (
                <Link
                  to={`/guide?spotId=${encodeURIComponent(spot.id)}&spotName=${encodeURIComponent(
                    spot.name,
                  )}&question=${encodeURIComponent(question)}`}
                  key={question}
                >
                  <Button block icon={<MessageOutlined />}>
                    {question}
                  </Button>
                </Link>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
