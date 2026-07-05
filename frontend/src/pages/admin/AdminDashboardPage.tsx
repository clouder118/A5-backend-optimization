import {
  DashboardOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  LikeOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Column, Line, Pie } from '@ant-design/charts';
import { Alert, Button, Card, Col, Empty, List, Progress, Row, Segmented, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { getAdminDashboard } from '../../api';
import { toApiError } from '../../api/client';
import type { AdminDashboardData } from '../../types/api';

const preferenceLabelMap: Record<string, string> = {
  culture: '文化',
  family: '亲子',
  photo: '摄影',
  relaxed: '休闲',
};

export default function AdminDashboardPage() {
  type DashboardRange = NonNullable<AdminDashboardData['operationsOverview']>['range'];
  const [messageApi, contextHolder] = message.useMessage();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [range, setRange] = useState<DashboardRange>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const preferenceChartData = useMemo(
    () =>
      (data?.preferenceDistribution ?? []).map((item) => ({
        label: preferenceLabelMap[item.label] ?? item.label,
        count: item.count,
      })),
    [data],
  );
  const preferenceTotal = useMemo(
    () => preferenceChartData.reduce((total, item) => total + item.count, 0),
    [preferenceChartData],
  );
  const maxBehaviorTypeCount = useMemo(
    () => Math.max(1, ...(data?.behaviorSummary?.attractionTypeDistribution.map((item) => item.count) ?? [1])),
    [data],
  );
  const sentimentChartData = useMemo(
    () =>
      (data?.operationsOverview?.sentimentTrend ?? []).flatMap((item) => [
        { date: item.date, sentiment: '正向', count: item.positive },
        { date: item.date, sentiment: '中性', count: item.neutral },
        { date: item.date, sentiment: '负向', count: item.negative },
      ]),
    [data],
  );
  const maxConcernTopicCount = useMemo(
    () => Math.max(1, ...(data?.visitorInsightsReport?.concernTopics.map((item) => item.count) ?? [1])),
    [data],
  );

  const load = (nextRange = range) => {
    setLoading(true);
    setError('');
    getAdminDashboard(nextRange)
      .then(setData)
      .catch((err) => {
        const apiError = toApiError(err);
        setError(apiError.message);
        messageApi.error(apiError.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(range);
  }, [range]);

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
  const operationsOverview = data?.operationsOverview;
  const visitorInsightsReport = data?.visitorInsightsReport;
  const hasSatisfactionTrend =
    operationsOverview?.satisfactionTrend.some((item) => item.avgSatisfactionScore != null) ?? false;
  const rangeLabel = {
    today: '今日',
    week: '本周',
    '7d': '近 7 天',
    '30d': '近 30 天',
  }[range];
  const avgSatisfactionScore = operationsOverview?.summary.avgSatisfactionScore;
  const reportStatus = visitorInsightsReport?.report.llmStatus ?? 'skipped_no_key';
  const reportStatusTag =
    reportStatus === 'success'
      ? { color: 'green', label: 'LLM 增强' }
      : reportStatus === 'failed'
        ? { color: 'gold', label: '规则兜底' }
        : { color: 'default', label: '规则报告' };
  const sentimentLabel = {
    positive: { color: 'green', label: '正向' },
    neutral: { color: 'default', label: '中性' },
    negative: { color: 'red', label: '负向' },
  } as const;

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
        <Space wrap>
          <Segmented
            value={range}
            onChange={(value) => setRange(value as DashboardRange)}
            options={[
              { label: '今日', value: 'today' },
              { label: '本周', value: 'week' },
              { label: '近 7 天', value: '7d' },
              { label: '近 30 天', value: '30d' },
            ]}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(range)}>
            刷新
          </Button>
        </Space>
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

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="今日服务人次"
              value={operationsOverview?.summary.todayServiceSessions ?? 0}
              suffix="人次"
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="本周服务人次"
              value={operationsOverview?.summary.weekServiceSessions ?? 0}
              suffix="人次"
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="今日问答量"
              value={operationsOverview?.summary.todayQuestions ?? 0}
              suffix="条"
              prefix={<MessageOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="本周问答量"
              value={operationsOverview?.summary.weekQuestions ?? 0}
              suffix="条"
              prefix={<MessageOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={`${rangeLabel}服务人次`}
              value={operationsOverview?.summary.rangeServiceSessions ?? 0}
              suffix="人次"
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={`${rangeLabel}问答量`}
              value={operationsOverview?.summary.rangeQuestions ?? 0}
              suffix="条"
              prefix={<MessageOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="游客满意度"
              value={avgSatisfactionScore ?? 'null'}
              suffix={avgSatisfactionScore == null ? '' : '分'}
              prefix={<LikeOutlined />}
              precision={avgSatisfactionScore == null ? undefined : 2}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="游客情感趋势" loading={loading}>
            {sentimentChartData.length ? (
              <div
                className="dashboard-chart"
                data-testid="sentiment-trend-chart"
                role="img"
                aria-label="游客情感趋势堆叠柱状图"
              >
                <div className="dashboard-chart-legend" aria-hidden="true">
                  <span><i style={{ background: '#2f855a' }} />正向</span>
                  <span><i style={{ background: '#94a3b8' }} />中性</span>
                  <span><i style={{ background: '#d96666' }} />负向</span>
                </div>
                <Column
                  data={sentimentChartData}
                  xField="date"
                  yField="count"
                  colorField="sentiment"
                  stack
                  height={248}
                  autoFit
                  theme="dark"
                  scale={{
                    color: { domain: ['正向', '中性', '负向'], range: ['#2f855a', '#94a3b8', '#d96666'] },
                    y: { domainMin: 0, nice: true },
                  }}
                  axis={{
                    x: { title: false, labelFormatter: (value: string) => value.slice(5) },
                    y: { title: false, grid: true },
                  }}
                  legend={false}
                  tooltip={{ items: [{ field: 'count', name: '问答量' }] }}
                />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无情感趋势数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="满意度趋势" loading={loading}>
            {hasSatisfactionTrend ? (
              <div
                className="dashboard-chart"
                data-testid="satisfaction-trend-chart"
                role="img"
                aria-label="游客满意度趋势折线图"
              >
                <Line
                  data={operationsOverview?.satisfactionTrend ?? []}
                  xField="date"
                  yField="avgSatisfactionScore"
                  height={280}
                  autoFit
                  theme="dark"
                  smooth
                  connectNulls={false}
                  point={{ size: 4, shape: 'circle' }}
                  scale={{ y: { domain: [0, 100] } }}
                  axis={{
                    x: { title: false, labelFormatter: (value: string) => value.slice(5) },
                    y: { title: false, grid: true },
                  }}
                  tooltip={{ items: [{ field: 'avgSatisfactionScore', name: '满意度' }] }}
                  style={{ stroke: '#c7922e', lineWidth: 3 }}
                />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无满意度趋势数据" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="游客关注点分析" extra={<Tag color={reportStatusTag.color}>{reportStatusTag.label}</Tag>} loading={loading}>
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message={visitorInsightsReport?.report.summary ?? '当前时间范围内暂无游客交互记录。'}
                description={visitorInsightsReport?.report.ruleSummary ?? '规则报告基于问答文本关键词识别关注点、情感倾向和服务建议。'}
              />
              {(visitorInsightsReport?.concernTopics ?? []).map((item) => (
                <div key={item.topic}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                    <Space size={8} wrap>
                      <Typography.Text strong>{item.topic}</Typography.Text>
                      <Tag color="blue">{item.count} 条</Tag>
                      <Tag>{Math.round(item.share * 100)}%</Tag>
                    </Space>
                    <Space size={6} wrap>
                      <Tag color="green">正向 {item.sentiment.positive}</Tag>
                      <Tag>中性 {item.sentiment.neutral}</Tag>
                      <Tag color="red">负向 {item.sentiment.negative}</Tag>
                    </Space>
                  </Space>
                  <Progress percent={Math.round((item.count / maxConcernTopicCount) * 100)} showInfo={false} />
                  <List
                    size="small"
                    dataSource={item.representativeQuestions}
                    locale={{ emptyText: '暂无代表问题' }}
                    renderItem={(question) => (
                      <List.Item>
                        <Typography.Text type="secondary">{question}</Typography.Text>
                      </List.Item>
                    )}
                  />
                </div>
              ))}
              {visitorInsightsReport?.concernTopics.length === 0 ? (
                <Typography.Text type="secondary">暂无关注点分析数据</Typography.Text>
              ) : null}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="规则服务建议" loading={loading}>
            <List
              dataSource={visitorInsightsReport?.serviceSuggestions ?? []}
              locale={{ emptyText: '暂无服务建议' }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <Tag color={item.type === 'negative_topic' ? 'red' : 'green'}>
                          {item.type === 'negative_topic' ? '负向主题' : '高频主题'}
                        </Tag>
                        <Typography.Text strong>{item.topic}</Typography.Text>
                      </Space>
                    }
                    description={item.message}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="热门问答聚类" loading={loading}>
        <List
          dataSource={visitorInsightsReport?.popularQuestionClusters ?? []}
          locale={{ emptyText: '暂无热门问答聚类' }}
          renderItem={(item) => {
            const sentiment = sentimentLabel[item.sentiment];
            return (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Typography.Text strong>{item.clusterLabel}</Typography.Text>
                      <Tag color="blue">{item.count} 次</Tag>
                      <Tag>{item.intentCategory}</Tag>
                      <Tag color={sentiment.color}>{sentiment.label}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4}>
                      <Typography.Text>{item.representativeQuestion}</Typography.Text>
                      <Typography.Text type="secondary">{item.questions.join(' / ')}</Typography.Text>
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Card>

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
            {data?.qaTrend.length ? (
              <div
                className="dashboard-chart"
                data-testid="qa-trend-chart"
                role="img"
                aria-label="最近 7 天问答量趋势图"
              >
                <Line
                  data={data.qaTrend}
                  xField="date"
                  yField="count"
                  height={280}
                  autoFit
                  theme="dark"
                  smooth
                  point={{ size: 4, shape: 'circle' }}
                  scale={{ y: { domainMin: 0, nice: true } }}
                  axis={{
                    x: { title: false, labelFormatter: (value: string) => value.slice(5) },
                    y: { title: false, grid: true },
                  }}
                  tooltip={{ items: [{ field: 'count', name: '问答量' }] }}
                  style={{ stroke: '#16776f', lineWidth: 3 }}
                />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无问答趋势数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="游客偏好分布" loading={loading}>
            {preferenceChartData.length ? (
              <div
                className="dashboard-chart dashboard-preference-chart"
                data-testid="preference-distribution-chart"
                role="img"
                aria-label="游客偏好分布环形图"
              >
                <div className="dashboard-donut-wrap">
                  <Pie
                    data={preferenceChartData}
                    angleField="count"
                    colorField="label"
                    innerRadius={0.64}
                    height={240}
                    autoFit
                    theme="dark"
                    scale={{ color: { range: ['#16776f', '#5ca88e', '#c7922e', '#94a3b8', '#7c8a86'] } }}
                    legend={false}
                    tooltip={{ items: [{ field: 'count', name: '数量' }] }}
                    style={{ stroke: '#ffffff', lineWidth: 2 }}
                  />
                  <div className="dashboard-donut-total" aria-hidden="true">
                    <strong>{preferenceTotal}</strong>
                    <span>偏好记录</span>
                  </div>
                </div>
                <div className="dashboard-preference-legend">
                  {preferenceChartData.map((item, index) => (
                    <div key={item.label}>
                      <i style={{ background: ['#16776f', '#5ca88e', '#c7922e', '#94a3b8', '#7c8a86'][index % 5] }} />
                      <span>
                        {item.label} {item.count}（{Math.round((item.count / preferenceTotal) * 100)}%）
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无游客偏好数据" />
            )}
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
