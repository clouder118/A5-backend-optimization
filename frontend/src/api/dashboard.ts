import { requestAdminJson } from './adminClient';
import { USE_MOCK_API } from './config';
import type { AdminDashboardData, BehaviorSummary, OperationsOverview, VisitorInsightsReport } from '../types/api';

const wait = (ms = 220) => new Promise((resolve) => window.setTimeout(resolve, ms));
export type DashboardRange = OperationsOverview['range'];

interface BackendAdminDashboardData {
  summary: {
    total_questions: number;
    today_questions: number;
    spot_count: number;
    route_count: number;
    knowledge_doc_count: number;
    knowledge_chunk_count: number;
    degraded_count: number;
    avg_total_ms: number;
  };
  top_questions: Array<{ question: string; count: number }>;
  top_spots: Array<{ spot_name: string; count: number }>;
  preference_distribution: Array<{ label: string; count: number }>;
  qa_trend: Array<{ date: string; count: number }>;
  recent_logs: Array<{
    id: number;
    question: string;
    answer: string;
    source_count: number;
    created_at: string;
  }>;
  behavior_summary?: BackendBehaviorSummary;
}

interface BackendOperationsOverview {
  range: OperationsOverview['range'];
  period: {
    start: string;
    end: string;
  };
  summary: {
    today_service_sessions: number;
    week_service_sessions: number;
    today_questions: number;
    week_questions: number;
    range_service_sessions: number;
    range_questions: number;
    avg_satisfaction_score: number | null;
  };
  sentiment_trend: Array<{
    date: string;
    positive: number;
    neutral: number;
    negative: number;
  }>;
  satisfaction_trend: Array<{
    date: string;
    avg_satisfaction_score: number | null;
  }>;
}

interface BackendVisitorInsightsReport {
  range: VisitorInsightsReport['range'];
  period: {
    start: string;
    end: string;
  };
  total_questions: number;
  topic_categories: string[];
  popular_question_clusters: Array<{
    cluster_label: string;
    representative_question: string;
    questions: string[];
    count: number;
    intent_category: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  concern_topics: Array<{
    topic: string;
    count: number;
    share: number;
    sentiment: {
      positive: number;
      neutral: number;
      negative: number;
    };
    representative_questions: string[];
  }>;
  service_suggestions: Array<{
    type: 'high_frequency_topic' | 'negative_topic';
    topic: string;
    message: string;
  }>;
  report: {
    generated_by: 'rule_based' | 'llm_enhanced';
    llm_status: 'success' | 'skipped_no_key' | 'failed';
    llm_error?: string;
    summary: string;
    rule_summary: string;
  };
}

interface BackendBehaviorSummary {
  source_file?: string;
  generated_at?: string;
  record_count: number;
  field_count?: number;
  usage_note: string;
  overall: {
    avg_stay_duration?: number;
    avg_total_cost?: number;
    avg_ticket_cost?: number;
    avg_food_cost?: number;
    avg_shopping_cost?: number;
    avg_transport_cost?: number;
    avg_entertainment_cost?: number;
    avg_group_size?: number;
    avg_satisfaction?: number;
  };
  gender_distribution: Array<{ label: string; count: number }>;
  age_distribution: Array<{ label: string; count: number }>;
  attraction_type_distribution: Array<{ label: string; count: number }>;
  top_attractions?: Array<{ label: string; count: number }>;
  satisfaction_distribution?: Array<{ label: string; count: number }>;
  peak_months?: Array<{ label: string; count: number }>;
  type_behavior: Array<{
    label: string;
    count: number;
    avg_stay_duration: number;
    avg_total_cost: number;
    avg_satisfaction: number;
  }>;
  insights: string[];
}

function mapBehaviorSummary(summary?: BackendBehaviorSummary): BehaviorSummary | undefined {
  if (!summary) {
    return undefined;
  }

  return {
    sourceFile: summary.source_file,
    generatedAt: summary.generated_at,
    recordCount: summary.record_count,
    fieldCount: summary.field_count,
    usageNote: summary.usage_note,
    overall: {
      avgStayDuration: summary.overall.avg_stay_duration,
      avgTotalCost: summary.overall.avg_total_cost,
      avgTicketCost: summary.overall.avg_ticket_cost,
      avgFoodCost: summary.overall.avg_food_cost,
      avgShoppingCost: summary.overall.avg_shopping_cost,
      avgTransportCost: summary.overall.avg_transport_cost,
      avgEntertainmentCost: summary.overall.avg_entertainment_cost,
      avgGroupSize: summary.overall.avg_group_size,
      avgSatisfaction: summary.overall.avg_satisfaction,
    },
    genderDistribution: summary.gender_distribution ?? [],
    ageDistribution: summary.age_distribution ?? [],
    attractionTypeDistribution: summary.attraction_type_distribution ?? [],
    topAttractions: summary.top_attractions ?? [],
    satisfactionDistribution: summary.satisfaction_distribution ?? [],
    peakMonths: summary.peak_months ?? [],
    typeBehavior: (summary.type_behavior ?? []).map((item) => ({
      label: item.label,
      count: item.count,
      avgStayDuration: item.avg_stay_duration,
      avgTotalCost: item.avg_total_cost,
      avgSatisfaction: item.avg_satisfaction,
    })),
    insights: summary.insights ?? [],
  };
}

function mapOperationsOverview(overview: BackendOperationsOverview): OperationsOverview {
  return {
    range: overview.range,
    period: overview.period,
    summary: {
      todayServiceSessions: overview.summary.today_service_sessions,
      weekServiceSessions: overview.summary.week_service_sessions,
      todayQuestions: overview.summary.today_questions,
      weekQuestions: overview.summary.week_questions,
      rangeServiceSessions: overview.summary.range_service_sessions,
      rangeQuestions: overview.summary.range_questions,
      avgSatisfactionScore: overview.summary.avg_satisfaction_score,
    },
    sentimentTrend: overview.sentiment_trend,
    satisfactionTrend: overview.satisfaction_trend.map((item) => ({
      date: item.date,
      avgSatisfactionScore: item.avg_satisfaction_score,
    })),
  };
}

function mapVisitorInsightsReport(report: BackendVisitorInsightsReport): VisitorInsightsReport {
  return {
    range: report.range,
    period: report.period,
    totalQuestions: report.total_questions,
    topicCategories: report.topic_categories,
    popularQuestionClusters: report.popular_question_clusters.map((item) => ({
      clusterLabel: item.cluster_label,
      representativeQuestion: item.representative_question,
      questions: item.questions,
      count: item.count,
      intentCategory: item.intent_category,
      sentiment: item.sentiment,
    })),
    concernTopics: report.concern_topics.map((item) => ({
      topic: item.topic,
      count: item.count,
      share: item.share,
      sentiment: item.sentiment,
      representativeQuestions: item.representative_questions,
    })),
    serviceSuggestions: report.service_suggestions,
    report: {
      generatedBy: report.report.generated_by,
      llmStatus: report.report.llm_status,
      llmError: report.report.llm_error,
      summary: report.report.summary,
      ruleSummary: report.report.rule_summary,
    },
  };
}

const baseMockDashboard: AdminDashboardData = {
  summary: {
    totalQuestions: 38,
    todayQuestions: 6,
    spotCount: 22,
    routeCount: 4,
    knowledgeDocCount: 28,
    knowledgeChunkCount: 184,
    degradedCount: 1,
    avgTotalMs: 860,
  },
  operationsOverview: {
    range: 'week',
    period: {
      start: '2026-06-15T00:00:00+08:00',
      end: '2026-06-22T00:00:00+08:00',
    },
    summary: {
      todayServiceSessions: 4,
      weekServiceSessions: 18,
      todayQuestions: 6,
      weekQuestions: 38,
      rangeServiceSessions: 18,
      rangeQuestions: 38,
      avgSatisfactionScore: 76.5,
    },
    sentimentTrend: [
      { date: '2026-06-15', positive: 2, neutral: 4, negative: 1 },
      { date: '2026-06-16', positive: 3, neutral: 5, negative: 0 },
      { date: '2026-06-17', positive: 2, neutral: 6, negative: 2 },
      { date: '2026-06-18', positive: 4, neutral: 3, negative: 1 },
      { date: '2026-06-19', positive: 3, neutral: 4, negative: 1 },
      { date: '2026-06-20', positive: 5, neutral: 2, negative: 0 },
      { date: '2026-06-21', positive: 2, neutral: 3, negative: 1 },
    ],
    satisfactionTrend: [
      { date: '2026-06-15', avgSatisfactionScore: 71.4 },
      { date: '2026-06-16', avgSatisfactionScore: 75.6 },
      { date: '2026-06-17', avgSatisfactionScore: 68.0 },
      { date: '2026-06-18', avgSatisfactionScore: 76.9 },
      { date: '2026-06-19', avgSatisfactionScore: 74.5 },
      { date: '2026-06-20', avgSatisfactionScore: 82.2 },
      { date: '2026-06-21', avgSatisfactionScore: 73.3 },
    ],
  },
  visitorInsightsReport: {
    range: '7d',
    period: {
      start: '2026-06-15T00:00:00+08:00',
      end: '2026-06-22T00:00:00+08:00',
    },
    totalQuestions: 38,
    topicCategories: ['景点讲解', '路线规划', '服务设施', '票务开放', '亲子老人', '交通到达', '投诉风险', '其他咨询'],
    popularQuestionClusters: [
      {
        clusterLabel: '路线规划咨询',
        representativeQuestion: '两个小时怎么游览灵山胜境？',
        questions: ['两个小时怎么游览灵山胜境？', '带老人来怎么安排路线？'],
        count: 13,
        intentCategory: '路线规划',
        sentiment: 'neutral',
      },
      {
        clusterLabel: '灵山大佛看点',
        representativeQuestion: '灵山大佛有哪些看点？',
        questions: ['灵山大佛有哪些看点？'],
        count: 7,
        intentCategory: '景点讲解',
        sentiment: 'positive',
      },
      {
        clusterLabel: '停车与到达投诉',
        representativeQuestion: '停车场太远了，找不到入口。',
        questions: ['停车场太远了，找不到入口。'],
        count: 3,
        intentCategory: '投诉风险',
        sentiment: 'negative',
      },
    ],
    concernTopics: [
      {
        topic: '路线规划',
        count: 12,
        share: 0.3158,
        sentiment: { positive: 4, neutral: 7, negative: 1 },
        representativeQuestions: ['两个小时怎么游览灵山胜境？', '带老人来怎么安排路线？'],
      },
      {
        topic: '景点讲解',
        count: 10,
        share: 0.2632,
        sentiment: { positive: 5, neutral: 5, negative: 0 },
        representativeQuestions: ['灵山大佛有哪些看点？', '灵山梵宫适合拍照吗？'],
      },
      {
        topic: '投诉风险',
        count: 3,
        share: 0.0789,
        sentiment: { positive: 0, neutral: 1, negative: 2 },
        representativeQuestions: ['停车场太远了，找不到入口。'],
      },
    ],
    serviceSuggestions: [
      {
        type: 'high_frequency_topic',
        topic: '路线规划',
        message: '路线规划咨询较集中，建议在游客端和现场导览中前置半日、一日、老人亲子等路线说明。',
      },
      {
        type: 'negative_topic',
        topic: '投诉风险',
        message: '投诉风险出现负向反馈，建议管理方复查现场服务、排队动线和指引信息，优先闭环代表问题。',
      },
    ],
    report: {
      generatedBy: 'rule_based',
      llmStatus: 'skipped_no_key',
      summary: '当前时间范围内路线规划和景点讲解咨询最集中，投诉风险类问题需要优先关注。',
      ruleSummary: '规则报告基于问答文本关键词识别关注点、情感倾向和服务建议。',
    },
  },
  topQuestions: [
    { question: '两个小时怎么游览灵山胜境？', count: 8 },
    { question: '灵山大佛有哪些看点？', count: 7 },
    { question: '带老人来怎么安排路线？', count: 5 },
  ],
  topSpots: [
    { spotName: '灵山大佛', count: 13 },
    { spotName: '灵山梵宫', count: 9 },
    { spotName: '九龙灌浴', count: 6 },
  ],
  preferenceDistribution: [
    { label: 'culture', count: 16 },
    { label: 'family', count: 12 },
    { label: 'photo', count: 7 },
    { label: '未标注', count: 3 },
  ],
  qaTrend: [
    { date: '2026-05-29', count: 2 },
    { date: '2026-05-30', count: 4 },
    { date: '2026-05-31', count: 3 },
    { date: '2026-06-01', count: 7 },
    { date: '2026-06-02', count: 6 },
    { date: '2026-06-03', count: 10 },
    { date: '2026-06-04', count: 6 },
  ],
  recentLogs: [
    {
      id: 'mock-log-1',
      question: '灵山梵宫适合拍照吗？',
      answer: '适合，但部分区域需要遵守现场拍摄提示。',
      sourceCount: 2,
      createdAt: '2026-06-04 10:20:00',
    },
  ],
  behaviorSummary: {
    sourceFile: '../Scenic Area Public Information Package/景点景区旅游数据行为分析数据.xlsx',
    generatedAt: '2026-06-04T00:00:00+00:00',
    recordCount: 140447,
    fieldCount: 17,
    usageNote: 'Excel 行为数据不进入 RAG 问答知识库；本摘要用于后台运营看板、游客画像说明和路线推荐依据展示。',
    overall: {
      avgStayDuration: 4.23,
      avgTotalCost: 692.89,
      avgGroupSize: 2.62,
      avgSatisfaction: 3.72,
    },
    genderDistribution: [
      { label: '女', count: 70300 },
      { label: '男', count: 70147 },
    ],
    ageDistribution: [
      { label: '26-35岁', count: 42000 },
      { label: '36-45岁', count: 36000 },
      { label: '46-60岁', count: 28000 },
    ],
    attractionTypeDistribution: [
      { label: '古镇水乡', count: 31564 },
      { label: '风景名胜与休闲度假', count: 25682 },
      { label: '主题乐园', count: 17524 },
    ],
    typeBehavior: [
      {
        label: '古镇水乡',
        count: 31564,
        avgStayDuration: 3.9,
        avgTotalCost: 620.2,
        avgSatisfaction: 3.7,
      },
      {
        label: '主题乐园',
        count: 17524,
        avgStayDuration: 5.6,
        avgTotalCost: 980.4,
        avgSatisfaction: 3.8,
      },
    ],
    insights: [
      '资料包共纳入 140447 条游客行为记录，可作为游客画像和运营看板的基线数据。',
      '样本中占比最高的景区类型是“古镇水乡”，可支撑偏好分析展示。',
    ],
  },
};

function cloneDashboard(data: AdminDashboardData): AdminDashboardData {
  return JSON.parse(JSON.stringify(data)) as AdminDashboardData;
}

function mockDashboardForRange(range: DashboardRange): AdminDashboardData {
  const data = cloneDashboard(baseMockDashboard);
  if (data.operationsOverview) {
    data.operationsOverview.range = range;
  }
  if (data.visitorInsightsReport) {
    data.visitorInsightsReport.range = range;
  }

  if (range === '7d' && data.visitorInsightsReport) {
    data.visitorInsightsReport.report = {
      ...data.visitorInsightsReport.report,
      generatedBy: 'llm_enhanced',
      llmStatus: 'success',
      summary: 'LLM 增强摘要：近 7 天路线规划和景点讲解咨询最集中，停车与到达体验需要持续关注。',
    };
  }

  if (range === '30d' && data.visitorInsightsReport && data.operationsOverview) {
    data.operationsOverview.summary.rangeServiceSessions = 42;
    data.operationsOverview.summary.rangeQuestions = 96;
    data.operationsOverview.summary.avgSatisfactionScore = 72.4;
    data.visitorInsightsReport.report = {
      ...data.visitorInsightsReport.report,
      generatedBy: 'rule_based',
      llmStatus: 'failed',
      llmError: 'llm_summary_failed',
      summary: '当前时间范围内共分析 96 条游客问答记录，报告由本地规则生成。',
    };
  }

  if (range === 'today' && data.operationsOverview && data.visitorInsightsReport) {
    data.operationsOverview.summary = {
      ...data.operationsOverview.summary,
      todayServiceSessions: 0,
      todayQuestions: 0,
      rangeServiceSessions: 0,
      rangeQuestions: 0,
      avgSatisfactionScore: null,
    };
    data.operationsOverview.sentimentTrend = [];
    data.operationsOverview.satisfactionTrend = [];
    data.visitorInsightsReport.totalQuestions = 0;
    data.visitorInsightsReport.popularQuestionClusters = [];
    data.visitorInsightsReport.concernTopics = [];
    data.visitorInsightsReport.serviceSuggestions = [];
    data.visitorInsightsReport.report = {
      generatedBy: 'rule_based',
      llmStatus: 'skipped_no_key',
      summary: '当前时间范围内暂无游客交互记录。',
      ruleSummary: '规则报告基于问答文本关键词识别关注点、情感倾向和服务建议。',
    };
  }

  return data;
}

export async function getAdminDashboard(range: DashboardRange = 'week'): Promise<AdminDashboardData> {
  if (USE_MOCK_API) {
    await wait();
    return mockDashboardForRange(range);
  }

  const query = new URLSearchParams({ range }).toString();
  const [response, operationsOverview, visitorInsightsReport] = await Promise.all([
    requestAdminJson<BackendAdminDashboardData>('/api/admin/dashboard'),
    requestAdminJson<BackendOperationsOverview>(`/api/admin/operations/overview?${query}`),
    requestAdminJson<BackendVisitorInsightsReport>(`/api/admin/visitor-insights/report?${query}`),
  ]);
  return {
    summary: {
      totalQuestions: response.summary.total_questions,
      todayQuestions: response.summary.today_questions,
      spotCount: response.summary.spot_count,
      routeCount: response.summary.route_count,
      knowledgeDocCount: response.summary.knowledge_doc_count,
      knowledgeChunkCount: response.summary.knowledge_chunk_count,
      degradedCount: response.summary.degraded_count,
      avgTotalMs: response.summary.avg_total_ms,
    },
    operationsOverview: mapOperationsOverview(operationsOverview),
    visitorInsightsReport: mapVisitorInsightsReport(visitorInsightsReport),
    topQuestions: response.top_questions,
    topSpots: response.top_spots.map((item) => ({
      spotName: item.spot_name,
      count: item.count,
    })),
    preferenceDistribution: response.preference_distribution,
    qaTrend: response.qa_trend,
    recentLogs: response.recent_logs.map((item) => ({
      id: String(item.id),
      question: item.question,
      answer: item.answer,
      sourceCount: item.source_count,
      createdAt: item.created_at,
    })),
    behaviorSummary: mapBehaviorSummary(response.behavior_summary),
  };
}
