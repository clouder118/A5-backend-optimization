import {
  DashboardOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Col, List, Progress, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { getAdminDashboard } from '../../api';
import { toApiError } from '../../api/client';
import type { AdminDashboardData } from '../../types/api';

export default function AdminDashboardPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const maxPreferenceCount = useMemo(
    () => Math.max(1, ...(data?.preferenceDistribution.map((item) => item.count) ?? [1])),
    [data],
  );
  const maxBehaviorTypeCount = useMemo(
    () => Math.max(1, ...(data?.behaviorSummary?.attractionTypeDistribution.map((item) => item.count) ?? [1])),
    [data],
  );

  const load = () => {
    setLoading(true);
    setError('');
    getAdminDashboard()
      .then(setData)
      .catch((err) => {
        const apiError = toApiError(err);
        setError(apiError.message);
        messageApi.error(apiError.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const questionColumns: ColumnsType<AdminDashboardData['topQuestions'][number]> = [
    {
      title: '热门问题',
      dataIndex: 'question',
      ellipsis: true,
    },
    {
      title: '次数',
      dataIndex: 'count',
      width: 80,
      render: (value: number) => <Tag color="green">{value}</Tag>,
    },
  ];

  const spotColumns: ColumnsType<AdminDashboardData['topSpots'][number]> = [
    {
      title: '热门景点',
      dataIndex: 'spotName',
      ellipsis: true,
    },
    {
      title: '命中',
      dataIndex: 'count',
      width: 80,
      render: (value: number) => <Tag color="blue">{value}</Tag>,
    },
  ];

  const behaviorColumns: ColumnsType<NonNullable<AdminDashboardData['behaviorSummary']>['typeBehavior'][number]> = [
    {
      title: '景区类型',
      dataIndex: 'label',
      ellipsis: true,
    },
    {
      title: '样本量',
      dataIndex: 'count',
      width: 100,
      render: (value: number) => <Tag color="green">{value.toLocaleString()}</Tag>,
    },
    {
      title: '平均停留',
      dataIndex: 'avgStayDuration',
      width: 110,
      render: (value: number) => `${value} 小时`,
    },
    {
      title: '平均消费',
      dataIndex: 'avgTotalCost',
      width: 110,
      render: (value: number) => `${value} 元`,
    },
    {
      title: '满意度',
      dataIndex: 'avgSatisfaction',
      width: 90,
    },
  ];

  const summary = data?.summary;
  const behaviorSummary = data?.behaviorSummary;

  return (
    <div className="admin-page">
      {contextHolder}
      <div className="admin-toolbar">
        <Space direction="vertical" size={2}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            数据看板
          </Typography.Title>
          <Typography.Text type="secondary">汇总问答量、热门问题、热门景点和游客偏好，支撑 P1 答辩演示。</Typography.Text>
        </Space>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
          刷新
        </Button>
      </div>

      {error ? <Alert type="warning" showIcon message="看板加载失败" description={error} /> : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="累计问答" value={summary?.totalQuestions ?? 0} suffix="条" prefix={<MessageOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="今日问答" value={summary?.todayQuestions ?? 0} suffix="条" prefix={<DashboardOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="景点 / 路线" value={`${summary?.spotCount ?? 0} / ${summary?.routeCount ?? 0}`} prefix={<NodeIndexOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="知识切片" value={summary?.knowledgeChunkCount ?? 0} suffix="块" prefix={<FileTextOutlined />} />
          </Card>
        </Col>
      </Row>

      {behaviorSummary ? (
        <Card
          className="behavior-summary-card"
          loading={loading}
          title={
            <Space>
              <ExperimentOutlined />
              <span>资料包游客行为分析</span>
            </Space>
          }
          extra={<Tag color="cyan">Excel {behaviorSummary.recordCount.toLocaleString()} 条</Tag>}
        >
          <Alert
            type="info"
            showIcon
            message="公开资料包 Excel 已转为轻量统计摘要"
            description={behaviorSummary.usageNote}
            style={{ marginBottom: 16 }}
          />
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="行为样本量" value={behaviorSummary.recordCount} suffix="条" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="平均停留" value={behaviorSummary.overall.avgStayDuration ?? 0} suffix="小时" precision={2} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="平均消费" value={behaviorSummary.overall.avgTotalCost ?? 0} suffix="元" precision={2} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="平均满意度" value={behaviorSummary.overall.avgSatisfaction ?? 0} suffix="/ 5" precision={2} />
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={9}>
              <div className="behavior-panel">
                <Typography.Title level={5}>景区类型偏好</Typography.Title>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {behaviorSummary.attractionTypeDistribution.slice(0, 5).map((item) => (
                    <div key={item.label}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Typography.Text>{item.label}</Typography.Text>
                        <Typography.Text strong>{item.count.toLocaleString()}</Typography.Text>
                      </Space>
                      <Progress percent={Math.round((item.count / maxBehaviorTypeCount) * 100)} showInfo={false} />
                    </div>
                  ))}
                </Space>
              </div>
            </Col>
            <Col xs={24} lg={7}>
              <div className="behavior-panel">
                <Typography.Title level={5}>分析结论</Typography.Title>
                <List
                  size="small"
                  dataSource={behaviorSummary.insights}
                  locale={{ emptyText: '暂无行为分析结论' }}
                  renderItem={(item) => (
                    <List.Item>
                      <Typography.Text>{item}</Typography.Text>
                    </List.Item>
                  )}
                />
              </div>
            </Col>
            <Col xs={24} lg={8}>
              <div className="behavior-panel">
                <Typography.Title level={5}>类型行为基线</Typography.Title>
                <Table
                  rowKey="label"
                  size="small"
                  columns={behaviorColumns}
                  dataSource={behaviorSummary.typeBehavior}
                  pagination={false}
                  scroll={{ x: 520 }}
                />
              </div>
            </Col>
          </Row>
        </Card>
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="最近 7 天问答量" loading={loading}>
            <div className="trend-bars">
              {(data?.qaTrend ?? []).map((item) => {
                const maxCount = Math.max(1, ...(data?.qaTrend.map((trend) => trend.count) ?? [1]));
                return (
                  <div className="trend-bar-item" key={item.date}>
                    <Typography.Text type="secondary">{item.date.slice(5)}</Typography.Text>
                    <Progress percent={Math.round((item.count / maxCount) * 100)} showInfo={false} />
                    <Typography.Text strong>{item.count}</Typography.Text>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="游客偏好分布" loading={loading}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {(data?.preferenceDistribution ?? []).map((item) => (
                <div key={item.label}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Text>{item.label}</Typography.Text>
                    <Typography.Text strong>{item.count}</Typography.Text>
                  </Space>
                  <Progress percent={Math.round((item.count / maxPreferenceCount) * 100)} showInfo={false} />
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="admin-table-card" title="热门问题">
            <Table
              rowKey="question"
              loading={loading}
              columns={questionColumns}
              dataSource={data?.topQuestions ?? []}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="admin-table-card" title="热门景点">
            <Table
              rowKey="spotName"
              loading={loading}
              columns={spotColumns}
              dataSource={data?.topSpots ?? []}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近问答" loading={loading}>
        <List
          dataSource={data?.recentLogs ?? []}
          locale={{ emptyText: '暂无问答日志' }}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space wrap>
                    <Typography.Text strong>{item.question}</Typography.Text>
                    <Tag color="green">来源 {item.sourceCount}</Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <Typography.Text ellipsis>{item.answer}</Typography.Text>
                    <Typography.Text type="secondary">{item.createdAt}</Typography.Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
