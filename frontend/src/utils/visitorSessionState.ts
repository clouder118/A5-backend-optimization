import type { ChatMessage, RoutePlan, RoutePreferenceInput } from '../types/scenic';

const STORAGE_PREFIX = 'a5-visitor-login-session:';
const GUIDE_CHAT_KEY = `${STORAGE_PREFIX}guide-chat`;
const ROUTE_RECOMMENDATION_KEY = `${STORAGE_PREFIX}route-recommendation`;
const ROUTE_MAP_KEY = `${STORAGE_PREFIX}route-map`;

export interface GuideChatSessionState {
  messages: ChatMessage[];
  sessionId: string;
  introReady: boolean;
  handledInitialQuestionKey?: string;
}

export interface RouteRecommendationSessionState {
  preference: RoutePreferenceInput;
  routes: RoutePlan[];
  savedAt: number;
}

export interface RouteMapSessionState {
  activeMapId?: RoutePreferenceInput['mapId'];
  activeRouteId?: string;
  activeSpotId?: string;
  savedAt: number;
}

export function loadGuideChatSession(): GuideChatSessionState | undefined {
  return readSessionValue<GuideChatSessionState>(GUIDE_CHAT_KEY, isGuideChatSessionState);
}

export function saveGuideChatSession(state: GuideChatSessionState): void {
  const messages = sanitizeMessages(state.messages);
  if (messages.length === 0 && !state.introReady) return;
  writeSessionValue(GUIDE_CHAT_KEY, {
    ...state,
    messages,
  });
}

export function loadRouteRecommendationSession(): RouteRecommendationSessionState | undefined {
  return readSessionValue<RouteRecommendationSessionState>(
    ROUTE_RECOMMENDATION_KEY,
    isRouteRecommendationSessionState,
  );
}

export function saveRouteRecommendationSession(
  state: Omit<RouteRecommendationSessionState, 'savedAt'>,
): void {
  writeSessionValue(ROUTE_RECOMMENDATION_KEY, {
    ...state,
    savedAt: Date.now(),
  });
}

export function loadRouteMapSession(): RouteMapSessionState | undefined {
  return readSessionValue<RouteMapSessionState>(ROUTE_MAP_KEY, isRouteMapSessionState);
}

export function saveRouteMapSession(state: Omit<RouteMapSessionState, 'savedAt'>): void {
  writeSessionValue(ROUTE_MAP_KEY, {
    ...state,
    savedAt: Date.now(),
  });
}

export function clearVisitorSessionState(): void {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Session memory is a convenience only; auth and API behavior must keep working.
  }
}

function readSessionValue<T>(key: string, guard: (value: unknown) => value is T): T | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeSessionValue(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota or browser privacy settings should not break the demo flow.
  }
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((message) => message.role !== 'assistant' || message.content.trim())
    .slice(-80);
}

function isGuideChatSessionState(value: unknown): value is GuideChatSessionState {
  const candidate = value as GuideChatSessionState;
  return (
    Boolean(candidate) &&
    Array.isArray(candidate.messages) &&
    typeof candidate.sessionId === 'string' &&
    typeof candidate.introReady === 'boolean'
  );
}

function isRouteRecommendationSessionState(value: unknown): value is RouteRecommendationSessionState {
  const candidate = value as RouteRecommendationSessionState;
  return (
    Boolean(candidate) &&
    Boolean(candidate.preference) &&
    Array.isArray(candidate.routes) &&
    typeof candidate.savedAt === 'number'
  );
}

function isRouteMapSessionState(value: unknown): value is RouteMapSessionState {
  const candidate = value as RouteMapSessionState;
  return Boolean(candidate) && typeof candidate.savedAt === 'number';
}
