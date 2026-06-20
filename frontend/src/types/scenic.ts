import type { ApiError } from './api';

export type GuideStatus = 'idle' | 'thinking' | 'speaking';

export type VisitorPreference = 'family' | 'culture' | 'relax' | 'photo';

export type PhysicalLevel = 'low' | 'medium' | 'high';

export type SpotTone = 'water' | 'culture' | 'garden' | 'service';

export interface ScenicSpot {
  id: string;
  name: string;
  subtitle: string;
  summary: string;
  story: string;
  tags: string[];
  crowdTypes: string[];
  durationMinutes: number;
  openInfo: string;
  serviceHint: string;
  coverTone: SpotTone;
  imageUrl?: string;
  highlights: string[];
}

export interface SpotCollectionStats {
  listedSpotCount: number;
  collectedSpotCount: number;
}

export interface RouteSpot {
  spotId: string;
  name: string;
  stayMinutes: number;
  reason: string;
}

export interface RoutePlan {
  id: string;
  name: string;
  theme: string;
  durationMinutes: number;
  suitableCrowd: string[];
  description: string;
  reason: string;
  spots: RouteSpot[];
}

export interface RoutePreferenceInput {
  visitorType: VisitorPreference;
  durationMinutes: number;
  physicalLevel: PhysicalLevel;
  interestTags: string[];
}

export interface ChatSource {
  id: string;
  title: string;
  spotName: string;
  snippet: string;
  section?: string;
  sourceType?: 'database' | 'approved_web' | 'realtime_web' | 'document' | string;
  sourceUrl?: string;
  sourceLevel?: string;
}

export interface ChatMetrics {
  retrievalMs: number;
  llmMs: number;
  ttsMs: number;
  totalMs: number;
  cacheHit: boolean;
  degraded: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: number;
  sources?: ChatSource[];
  audioUrl?: string;
  ttsJobId?: string;
  ttsStatus?: 'pending' | 'ready' | 'failed' | 'disabled';
  isFallback?: boolean;
  metrics?: ChatMetrics;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  audioUrl?: string;
  ttsJobId?: string;
  ttsStatus?: 'pending' | 'ready' | 'failed' | 'disabled';
  sessionId?: string;
  isFallback?: boolean;
  metrics?: ChatMetrics;
  error?: ApiError;
}

export interface ChatRequest {
  question: string;
  sessionId?: string;
  visitorType?: VisitorPreference;
  preference?: string;
  spotId?: string;
  currentSpotName?: string;
}
