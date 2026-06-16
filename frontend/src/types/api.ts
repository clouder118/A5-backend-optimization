export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  detail?: unknown;
}

export interface KnowledgeRebuildResult {
  status: 'queued' | 'running' | 'completed' | 'failed';
  message: string;
  indexedDocs?: number;
  indexedChunks?: number;
  startedAt?: string;
}

export interface KnowledgeDocItem {
  id: string;
  title: string;
  sourceType: string;
  path: string;
  chunkCount: number;
  indexed: boolean;
}

export type WebFactCandidateStatus =
  | 'pending_review'
  | 'approved_supplemental'
  | 'approved_official'
  | 'rejected'
  | 'ignored';

export type WebFactReviewAction = 'approve_supplemental' | 'approve_official' | 'reject' | 'ignore';

export interface WebFactCandidate {
  id: number;
  entityType: string;
  entityId: string;
  entityName: string;
  factKey: string;
  factValue: string;
  sourceUrl: string;
  sourceLevel: string;
  question: string;
  answerExcerpt: string;
  status: WebFactCandidateStatus;
  createdAt: string;
}

export interface ChatLogItem {
  id: string;
  sessionId: string;
  question: string;
  answer: string;
  sources: Array<{
    id?: string;
    title: string;
    spotName: string;
    section?: string;
    snippet?: string;
    sourceType?: string;
    sourceUrl?: string;
    sourceLevel?: string;
  }>;
  visitorType?: string;
  preference?: string;
  metrics?: {
    retrievalMs: number;
    llmMs: number;
    ttsMs: number;
    totalMs: number;
    cacheHit: boolean;
    degraded: boolean;
  };
  createdAt: string;
}

export interface ChatLogQuery {
  keyword?: string;
  limit?: number;
}

export interface ChatLogDeleteResult {
  status: 'deleted';
  deletedCount: number;
}

export interface AdminDashboardSummary {
  totalQuestions: number;
  todayQuestions: number;
  spotCount: number;
  routeCount: number;
  knowledgeDocCount: number;
  knowledgeChunkCount: number;
  degradedCount: number;
  avgTotalMs: number;
}

export interface BehaviorSummary {
  sourceFile?: string;
  generatedAt?: string;
  recordCount: number;
  fieldCount?: number;
  usageNote: string;
  overall: {
    avgStayDuration?: number;
    avgTotalCost?: number;
    avgTicketCost?: number;
    avgFoodCost?: number;
    avgShoppingCost?: number;
    avgTransportCost?: number;
    avgEntertainmentCost?: number;
    avgGroupSize?: number;
    avgSatisfaction?: number;
  };
  genderDistribution: Array<{
    label: string;
    count: number;
  }>;
  ageDistribution: Array<{
    label: string;
    count: number;
  }>;
  attractionTypeDistribution: Array<{
    label: string;
    count: number;
  }>;
  topAttractions?: Array<{
    label: string;
    count: number;
  }>;
  satisfactionDistribution?: Array<{
    label: string;
    count: number;
  }>;
  peakMonths?: Array<{
    label: string;
    count: number;
  }>;
  typeBehavior: Array<{
    label: string;
    count: number;
    avgStayDuration: number;
    avgTotalCost: number;
    avgSatisfaction: number;
  }>;
  insights: string[];
}

export interface AdminDashboardData {
  summary: AdminDashboardSummary;
  topQuestions: Array<{
    question: string;
    count: number;
  }>;
  topSpots: Array<{
    spotName: string;
    count: number;
  }>;
  preferenceDistribution: Array<{
    label: string;
    count: number;
  }>;
  qaTrend: Array<{
    date: string;
    count: number;
  }>;
  recentLogs: Array<{
    id: string;
    question: string;
    answer: string;
    sourceCount: number;
    createdAt: string;
  }>;
  behaviorSummary?: BehaviorSummary;
}
