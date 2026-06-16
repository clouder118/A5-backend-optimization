import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Input, Popconfirm, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { clearChatLogs, deleteChatLog, deleteChatLogs, getChatLogs } from '../../api';
import { toApiError } from '../../api/client';
import type { ChatLogItem } from '../../types/api';

export default function AdminChatLogPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [logs, setLogs] = useState<ChatLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const logStats = useMemo(() => {
    const degradedCount = logs.filter((log) => log.metrics?.degraded).length;
    const metricLogs = logs.filter((log) => log.metrics);
    const avgTotalMs = metricLogs.length
      ? Math.round(metricLogs.reduce((total, log) => total + (log.metrics?.totalMs ?? 0), 0) / metricLogs.length)
      : 0;
    const sourceCount = logs.reduce((total, log) => total + log.sources.length, 0);
    return { degradedCount, avgTotalMs, sourceCount };
  }, [logs]);

  const load = (nextKeyword = keyword) => {
    setLoading(true);
    setError('');
    getChatLogs({ keyword: nextKeyword, limit: 50 })
      .then((items) => {
        setLogs(items);
        setSelectedRowKeys((keys) => keys.filter((key) => items.some((item) => item.id === key)));
      })
      .catch((err) => {
        const apiError = toApiError(err);
        setError(apiError.message);
        messageApi.error(apiError.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load('');
  }, []);

  const runDelete = (action: () => Promise<{ deletedCount: number }>) => {
    setDeleting(true);
    action()
      .then((result) => {
        messageApi.success(`已删除 ${result.deletedCount} 条问答日志`);
        setSelectedRowKeys([]);
        load();
      })
      .catch((err) => {
        const apiError = toApiError(err);
        messageApi.error(apiError.message);
      })
      .finally(() => setDeleting(false));
  };

  const handleDeleteOne = (id: string) => {
    runDelete(() => deleteChatLog(id));
  };

  const handleDeleteSelected = () => {
    runDelete(() => deleteChatLogs(selectedRowKeys.map(String)));
  };

  const handleClearAll = () => {
    runDelete(clearChatLogs);
  };

  const columns: ColumnsType<ChatLogItem> = [
    {
      title: '问题',
      dataIndex: 'question',
      width: 230,
      render: (value: string, log) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">
            {log.visitorType ?? '未标注游客类型'}
            {log.preference ? ` / ${log.preference}` : ''}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '回答',
      dataIndex: 'answer',
      ellipsis: true,
    },
    {
      title: '来源',
      dataIndex: 'sources',
      width: 260,
      render: (sources: ChatLogItem['sources']) => (
        <Space size={[6, 6]} wrap>
          {sources.length ? sources.map((source) => (
            <Tag color="green" key={`${source.title}-${source.spotName}`}>
              {source.title} / {source.spotName}
            </Tag>
          )) : <Tag>暂无命中文档</Tag>}
        </Space>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 180,
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      fixed: 'right',
      render: (_, log) => (
        <Popconfirm
          title="删除这条问答日志？"
          description="删除后将不再出现在问答日志列表中。"
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={() => handleDeleteOne(log.id)}
        >
          <Button danger icon={<DeleteOutlined />} loading={deleting} size="small">
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const hasSelection = selectedRowKeys.length > 0;
  const selectedIds = new Set(selectedRowKeys.map(String));
  const allCurrentLogsSelected = logs.length > 0 && logs.every((log) => selectedIds.has(log.id));
  const toggleCurrentListSelection = () => {
    setSelectedRowKeys(allCurrentLogsSelected ? [] : logs.map((log) => log.id));
  };

  return (
    <div className="admin-page">
      {contextHolder}
      <div className="admin-toolbar">
        <Space direction="vertical" size={2}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            问答日志
          </Typography.Title>
          <Typography.Text type="secondary">查看游客问题、AI 回答、命中来源和提问时间。</Typography.Text>
        </Space>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="搜索问题或回答"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={(value) => load(value)}
            style={{ width: 260 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {error ? <Alert type="warning" showIcon message="日志加载失败" description={error} /> : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="当前日志" value={logs.length} suffix="条" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="命中来源" value={logStats.sourceCount} suffix="处" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="平均响应"
              value={logStats.avgTotalMs}
              suffix="ms"
              valueStyle={{ color: logStats.degradedCount ? '#c27a1a' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {logStats.degradedCount ? (
        <Alert
          type="warning"
          showIcon
          message="存在降级问答"
          description={`当前列表中有 ${logStats.degradedCount} 条问答使用了降级或兜底路径，可结合来源和回答内容复查。`}
        />
      ) : null}

      <div className="admin-bulk-toolbar">
        <Space wrap>
          <Typography.Text type="secondary">已选择 {selectedRowKeys.length} 条日志</Typography.Text>
          <Button onClick={toggleCurrentListSelection} disabled={!logs.length || loading}>
            {allCurrentLogsSelected ? '取消全选' : '全选当前列表'}
          </Button>
          <Popconfirm
            title={`删除选中的 ${selectedRowKeys.length} 条日志？`}
            description="删除后将不再出现在问答日志列表中。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            disabled={!hasSelection}
            onConfirm={handleDeleteSelected}
          >
            <Button danger icon={<DeleteOutlined />} disabled={!hasSelection} loading={deleting}>
              删除选中
            </Button>
          </Popconfirm>
          <Popconfirm
            title="清空全部问答日志？"
            description="该操作会删除数据库中的所有问答日志。"
            okText="清空"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={handleClearAll}
          >
            <Button danger disabled={!logs.length} loading={deleting}>
              清空全部
            </Button>
          </Popconfirm>
        </Space>
      </div>

      <Card className="admin-table-card">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={logs}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1120 }}
          expandable={{
            expandedRowRender: (log) => (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Typography.Text strong>命中来源明细</Typography.Text>
                {log.sources.length ? (
                  log.sources.map((source, index) => (
                    <Card size="small" key={`${source.title}-${index}`}>
                      <Space direction="vertical" size={4}>
                        <Space wrap>
                          <Tag color="green">{source.title}</Tag>
                          <Tag color="blue">{source.spotName}</Tag>
                          {source.section ? <Tag>{source.section}</Tag> : null}
                          {source.sourceType ? <Tag color="gold">{source.sourceType}</Tag> : null}
                        </Space>
                        {source.snippet ? <Typography.Text>{source.snippet}</Typography.Text> : null}
                        {source.sourceUrl ? (
                          <Typography.Link href={source.sourceUrl} target="_blank" rel="noreferrer">
                            {source.sourceUrl}
                          </Typography.Link>
                        ) : null}
                      </Space>
                    </Card>
                  ))
                ) : (
                  <Typography.Text type="secondary">本条问答没有返回可展示的命中文档。</Typography.Text>
                )}
              </Space>
            ),
          }}
        />
      </Card>
    </div>
  );
}
