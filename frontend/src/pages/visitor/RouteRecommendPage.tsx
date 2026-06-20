import { useEffect, useState } from 'react';
import { Alert, Button, Col, Row, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/common/EmptyState';
import PreferenceForm from '../../components/scenic/PreferenceForm';
import RouteCard from '../../components/scenic/RouteCard';
import { recommendRoutes } from '../../api/routes';
import type { RoutePlan, RoutePreferenceInput } from '../../types/scenic';
import {
  buildPreferenceGuideQuestion,
  defaultVisitorPreference,
  formatVisitorPreference,
  loadVisitorPreference,
  preferenceToSearchParams,
  saveVisitorPreference,
} from '../../utils/visitorProfile';

export default function RouteRecommendPage() {
  const [routes, setRoutes] = useState<RoutePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preference, setPreference] = useState<RoutePreferenceInput>(() => loadVisitorPreference());

  const loadRoutes = (values: RoutePreferenceInput) => {
    saveVisitorPreference(values);
    setPreference(values);
    setLoading(true);
    setError('');
    recommendRoutes(values)
      .then(setRoutes)
      .catch(() => setError('路线推荐失败，请稍后重试。'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRoutes(loadVisitorPreference());
  }, []);

  const guideParams = preferenceToSearchParams(preference);
  guideParams.set('question', buildPreferenceGuideQuestion(preference));
  const guideHref = `/guide?${guideParams.toString()}`;

  return (
    <div className="page-stack route-page">
      <Space className="video-page-heading" direction="vertical" size={6}>
        <Typography.Text className="mono-label">[ ROUTE SYSTEM ]</Typography.Text>
        <Typography.Title level={1} style={{ margin: 0 }}>
          个性化路线推荐
        </Typography.Title>
      </Space>

      <Row className="route-layout" gutter={[16, 16]}>
        <Col className="route-filter-column" xs={24} lg={8}>
          <PreferenceForm initialValues={preference} loading={loading} error={error} onSubmit={loadRoutes} />
        </Col>
        <Col className="route-results-column" xs={24} lg={16}>
          <div className="page-stack">
            <Alert
              className="route-guide-alert"
              type="info"
              showIcon
              message={`当前偏好：${formatVisitorPreference(preference)}`}
              action={
                <Link to={guideHref}>
                  <Button type="primary" size="small" data-cue="[ GUIDE ]">
                    [ GUIDE ]
                  </Button>
                </Link>
              }
            />
            {loading ? <RouteCard loading /> : null}
            {error ? <RouteCard error={error} onRetry={() => loadRoutes(defaultVisitorPreference)} /> : null}
            {!error && routes.length === 0 && !loading ? (
              <EmptyState title="暂无路线" description="请选择偏好后生成推荐。" />
            ) : null}
            {!loading && !error
              ? routes.map((route) => <RouteCard key={route.id} route={route} />)
              : null}
          </div>
        </Col>
      </Row>
    </div>
  );
}
