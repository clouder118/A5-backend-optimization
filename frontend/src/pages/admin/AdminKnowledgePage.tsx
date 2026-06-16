import {
  CheckCircleOutlined,
  CloudSyncOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  EyeInvisibleOutlined,
  LinkOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { listKnowledgeDocs, listWebFactCandidates, rebuildKnowledgeIndex, reviewWebFactCandidate } from '../../api';
import { toApiError } from '../../api/client';
import type {
  KnowledgeDocItem,
  KnowledgeRebuildResult,
  WebFactCandidate,
  WebFactCandidateStatus,
  WebFactReviewAction,
} from '../../types/api';

type CandidateFilter = WebFactCandidateStatus | '';

function docStatusTag(indexed: boolean) {
  return indexed ? <Tag color="green">已索引</Tag> : <Tag color="gold">待重建</Tag>;
}

function docSourceTag(sourceType: string) {
  const normalized = sourceType.toLowerCase();
  if (normalized === 'docx') {
    return <Tag color="blue">原始 Word</Tag>;
  }
  if (normalized === 'md') {
    return <Tag color="green">派生 Markdown</Tag>;
  }
  return <Tag>{sourceType}</Tag>;
}

function docStorageLabel(path: string) {
  return path.includes('knowledge') ? 'v1/knowledge 知识包' : '原始资料包';
}

function candidateStatusTag(status: WebFactCandidate['status']) {
  const map = {
    pending_review: { color: 'gold', label: '待审核' },
    approved_supplemental: { color: 'blue', label: '已补充' },
    approved_official: { color: 'green', label: '已入库' },
    rejected: { color: 'red', label: '已拒绝' },
    ignored: { color: 'default', label: '已忽略' },
  } as const;
  return <Tag color={map[status].color}>{map[status].label}</Tag>;
}

export default function AdminKnowledgePage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [docs, setDocs] = useState<KnowledgeDocItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<KnowledgeRebuildResult>();
  const [candidates, setCandidates] = useState<WebFactCandidate[]>([]);
  const [candidateStatus, setCandidateStatus] = useState<CandidateFilter>('pending_review');
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<number>();

  const stats = useMemo(() => {
    const indexedDocs = docs.filter((doc) => doc.indexed).length;
    const chunkCount = docs.reduce((total, doc) => total + doc.chunkCount, 0);
    const derivedDocs = docs.filter((doc) => doc.path.includes('knowledge')).length;
    const spotDocs = docs.filter((doc) => /^(LS|NH)-\d{3}-/.test(doc.title)).length;
    return {
      indexedDocs,
      chunkCount,
      derivedDocs,
      spotDocs,
      pendingDocs: docs.length - indexedDocs,
    };
  }, [docs]);

  const loadDocs = async () => {
    setDocsLoading(true);
    try {
      setDocs(await listKnowledgeDocs());
    } catch (error) {
      const apiError = toApiError(error);
      messageApi.error(apiError.message);
    } finally {
      setDocsLoading(false);
    }
  };

  const loadCandidates = async (status = candidateStatus) => {
    setCandidatesLoading(true);
    try {
      setCandidates(await listWebFactCandidates(status));
    } catch (error) {
      const apiError = toApiError(error);
      messageApi.error(apiError.message);
    } finally {
      setCandidatesLoading(false);
    }
  };

  useEffect(() => {
    void loadDocs();
  }, []);

  useEffect(() => {
    void loadCandidates(candidateStatus);
  }, [candidateStatus]);

  const rebuild = async () => {
    setRebuilding(true);
    try {
      const result = await rebuildKnowledgeIndex();
      setRebuildResult(result);
      await loadDocs();
      messageApi.success(result.message);
    } catch (error) {
      const apiError = toApiError(error);
      messageApi.error(apiError.message);
    } finally {
      setRebuilding(false);
    }
  };

  const reviewCandidate = async (candidateId: number, action: WebFactReviewAction) => {
    setReviewingId(candidateId);
    try {
      await reviewWebFactCandidate(candidateId, action);
      await loadCandidates(candidateStatus);
      messageApi.success('联网事实候选已处理');
    } catch (error) {
      const apiError = toApiError(error);
      messageApi.error(apiError.message);
    } finally {
      setReviewingId(undefined);
    }
  };

  const docColumns: ColumnsType<KnowledgeDocItem> = [
    {
      title: '知识文档',
      dataIndex: 'title',
      width: 300,
      render: (_, doc) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{doc.title}</Typography.Text>
          <Typography.Text type="secondary">{doc.id}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '来源类型',
      dataIndex: 'sourceType',
      width: 140,
      render: (_, doc) => (
        <Space direction="vertical" size={2}>
          {docSourceTag(doc.sourceType)}
          <Typography.Text type="secondary">{docStorageLabel(doc.path)}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '索引状态',
      dataIndex: 'indexed',
      width: 110,
      render: docStatusTag,
    },
    {
      title: '切片数',
      dataIndex: 'chunkCount',
      width: 90,
    },
    {
      title: '存储路径',
      dataIndex: 'path',
      render: (path: string) => (
        <Typography.Text code copyable ellipsis={{ tooltip: path }}>
          {path}
        </Typography.Text>
      ),
    },
  ];

  const candidateColumns: ColumnsType<WebFactCandidate> = [
    {
      title: '事实候选',
      dataIndex: 'factValue',
      width: 360,
      render: (_, candidate) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{candidate.entityName}</Typography.Text>
          <Typography.Text>{candidate.factValue}</Typography.Text>
          <Typography.Text type="secondary">{candidate.question}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '字段',
      dataIndex: 'factKey',
      width: 120,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: '来源',
      dataIndex: 'sourceUrl',
      width: 260,
      render: (_, candidate) => (
        <Space direction="vertical" size={2}>
          <Tag color={candidate.sourceLevel === 'official' ? 'green' : 'blue'}>{candidate.sourceLevel}</Tag>
          <Typography.Link href={candidate.sourceUrl} target="_blank" rel="noreferrer" ellipsis>
            <LinkOutlined /> {candidate.sourceUrl}
          </Typography.Link>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: candidateStatusTag,
    },
    {
      title: '操作',
      width: 320,
      render: (_, candidate) => (
        <Space wrap>
          <Button
            size="small"
            icon={<CheckCircleOutlined />}
            loading={reviewingId === candidate.id}
            onClick={() => reviewCandidate(candidate.id, 'approve_supplemental')}
          >
            补充
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<DatabaseOutlined />}
            loading={reviewingId === candidate.id}
            onClick={() => reviewCandidate(candidate.id, 'approve_official')}
          >
            入库
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            loading={reviewingId === candidate.id}
            onClick={() => reviewCandidate(candidate.id, 'reject')}
          >
            拒绝
          </Button>
          <Button
            size="small"
            icon={<EyeInvisibleOutlined />}
            loading={reviewingId === candidate.id}
            onClick={() => reviewCandidate(candidate.id, 'ignore')}
          >
            忽略
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="admin-page">
      {contextHolder}
      <div className="admin-toolbar">
        <Space direction="vertical" size={2}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            知识库管理
          </Typography.Title>
          <Typography.Text type="secondary">查看后端知识库入库状态、切片数量和联网事实候选审核。</Typography.Text>
        </Space>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={docsLoading} onClick={loadDocs}>
            刷新文档
          </Button>
          <Button icon={<CloudSyncOutlined />} loading={rebuilding} onClick={rebuild}>
            重建索引
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="当前知识库流程"
        description="后端已将原始 Word 资料派生为 v1/knowledge 知识包，并在启动时写入数据库；AI 导游问答检索数据库中的结构化事实、文档切片和已审核联网补充，不再直接扫描原始资料目录。"
      />

      <Space size={16} wrap>
        <Card>
          <Statistic title="知识文档" value={docs.length} suffix="份" />
        </Card>
        <Card>
          <Statistic title="派生文档" value={stats.derivedDocs} suffix="份" />
        </Card>
        <Card>
          <Statistic title="景点文档" value={stats.spotDocs} suffix="份" />
        </Card>
        <Card>
          <Statistic title="已索引文档" value={stats.indexedDocs} suffix={`/ ${docs.length}`} />
        </Card>
        <Card>
          <Statistic title="知识切片" value={stats.chunkCount} suffix="块" />
        </Card>
        <Card>
          <Statistic title="待审核联网事实" value={candidates.length} suffix="条" />
        </Card>
      </Space>

      <Card title="运营摘要">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text>
            当前资料库包含 {docs.length} 份文档、{stats.chunkCount} 个知识切片，其中 {stats.spotDocs}{' '}
            份为景点文档，适合支撑游客端景点讲解和路线问答。
          </Typography.Text>
          <Typography.Text type="secondary">
            最近导入文档：
            {docs.slice(0, 3).map((doc) => (
              <Tag key={doc.id} color={doc.indexed ? 'green' : 'gold'} style={{ marginLeft: 8 }}>
                {doc.title}
              </Tag>
            ))}
          </Typography.Text>
        </Space>
      </Card>

      {stats.pendingDocs > 0 ? (
        <Alert
          type="warning"
          showIcon
          message="存在待重建文档"
          description={`当前有 ${stats.pendingDocs} 份文档尚未标记为已索引。点击“重建索引”后，后端会刷新索引状态。`}
        />
      ) : null}

      {rebuildResult ? (
        <Alert
          type={rebuildResult.status === 'failed' ? 'warning' : 'success'}
          showIcon
          message="索引重建结果"
          description={`${rebuildResult.message} 文档：${rebuildResult.indexedDocs ?? docs.length}，切片：${
            rebuildResult.indexedChunks ?? stats.chunkCount
          }。`}
        />
      ) : null}

      <Card className="admin-table-card" title="后端知识文档">
        <Table
          rowKey="id"
          columns={docColumns}
          dataSource={docs}
          loading={docsLoading}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 980 }}
        />
      </Card>

      <Card
        className="admin-table-card"
        title="联网事实候选"
        extra={
          <Space wrap>
            <Select<CandidateFilter>
              value={candidateStatus}
              style={{ width: 150 }}
              onChange={setCandidateStatus}
              options={[
                { value: 'pending_review', label: '待审核' },
                { value: 'approved_supplemental', label: '已补充' },
                { value: 'approved_official', label: '已入库' },
                { value: 'rejected', label: '已拒绝' },
                { value: 'ignored', label: '已忽略' },
                { value: '', label: '全部状态' },
              ]}
            />
            <Button loading={candidatesLoading} onClick={() => loadCandidates()}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={candidateColumns}
          dataSource={candidates}
          loading={candidatesLoading}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 1120 }}
        />
      </Card>
    </div>
  );
}
