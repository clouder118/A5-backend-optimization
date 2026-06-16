export { getSpotCollectionStats, getSpots, getSpotDetail } from './spots';
export { recommendRoutes } from './routes';
export { chatWithGuide, mockChatApi, realChatApi, streamChatWithGuide } from './chat';
export { getTtsJobStatus } from './tts';
export { clearChatLogs, deleteChatLog, deleteChatLogs, getChatLogs } from './logs';
export { getAdminDashboard } from './dashboard';
export { listKnowledgeDocs, listWebFactCandidates, rebuildKnowledgeIndex, reviewWebFactCandidate } from './knowledge';
export { createApiError, isApiError, requestJson, toApiError } from './client';
export type {
  ApiError,
  AdminDashboardData,
  AdminDashboardSummary,
  ChatLogDeleteResult,
  ChatLogItem,
  ChatLogQuery,
  KnowledgeDocItem,
  KnowledgeRebuildResult,
  WebFactCandidate,
  WebFactCandidateStatus,
  WebFactReviewAction,
} from '../types/api';
