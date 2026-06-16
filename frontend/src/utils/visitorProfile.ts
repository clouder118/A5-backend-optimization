import type { PhysicalLevel, RoutePreferenceInput, VisitorPreference } from '../types/scenic';

const STORAGE_KEY = 'a5-ai-guide-visitor-profile';

type RawPreference = {
  visitorType?: unknown;
  durationMinutes?: unknown;
  physicalLevel?: unknown;
  interestTags?: unknown;
};

export const defaultVisitorPreference: RoutePreferenceInput = {
  visitorType: 'culture',
  durationMinutes: 120,
  physicalLevel: 'medium',
  interestTags: ['历史', '建筑'],
};

export const visitorTypeLabels: Record<VisitorPreference, string> = {
  family: '亲子游',
  culture: '历史文化游',
  relax: '轻松游',
  photo: '摄影游',
};

export const physicalLevelLabels: Record<PhysicalLevel, string> = {
  low: '低强度',
  medium: '中等强度',
  high: '高强度',
};

export function loadVisitorPreference(): RoutePreferenceInput {
  if (typeof window === 'undefined') {
    return defaultVisitorPreference;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultVisitorPreference;
    }
    return normalizePreference(JSON.parse(raw));
  } catch {
    return defaultVisitorPreference;
  }
}

export function saveVisitorPreference(preference: RoutePreferenceInput) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePreference(preference)));
}

export function preferenceFromSearchParams(params: URLSearchParams): RoutePreferenceInput {
  const stored = loadVisitorPreference();
  return normalizePreference({
    ...stored,
    visitorType: params.get('visitorType') ?? stored.visitorType,
    durationMinutes: Number(params.get('durationMinutes') ?? stored.durationMinutes),
    physicalLevel: params.get('physicalLevel') ?? stored.physicalLevel,
    interestTags: params.get('interestTags')?.split(',').filter(Boolean) ?? stored.interestTags,
  });
}

export function preferenceToSearchParams(preference: RoutePreferenceInput) {
  const normalized = normalizePreference(preference);
  const params = new URLSearchParams();
  params.set('visitorType', normalized.visitorType);
  params.set('durationMinutes', String(normalized.durationMinutes));
  params.set('physicalLevel', normalized.physicalLevel);
  params.set('interestTags', normalized.interestTags.join(','));
  return params;
}

export function formatVisitorPreference(preference: RoutePreferenceInput) {
  const label = visitorTypeLabels[preference.visitorType];
  const physical = physicalLevelLabels[preference.physicalLevel];
  const interests = preference.interestTags.length ? preference.interestTags.join('、') : '暂无特别兴趣';
  return `${label}；可游览 ${preference.durationMinutes} 分钟；步行强度 ${physical}；兴趣：${interests}`;
}

export function buildPreferenceGuideQuestion(preference: RoutePreferenceInput) {
  return `我是${formatVisitorPreference(preference)}，请按这个偏好帮我安排灵山胜境游览路线。`;
}

function normalizePreference(value: RawPreference): RoutePreferenceInput {
  const visitorType = isVisitorPreference(value.visitorType) ? value.visitorType : defaultVisitorPreference.visitorType;
  const physicalLevel = isPhysicalLevel(value.physicalLevel) ? value.physicalLevel : defaultVisitorPreference.physicalLevel;
  const durationMinutes = Number.isFinite(Number(value.durationMinutes)) && Number(value.durationMinutes) > 0
    ? Number(value.durationMinutes)
    : defaultVisitorPreference.durationMinutes;
  const interestTags = Array.isArray(value.interestTags)
    ? value.interestTags.map(String).filter(Boolean)
    : defaultVisitorPreference.interestTags;

  return {
    visitorType,
    durationMinutes,
    physicalLevel,
    interestTags,
  };
}

function isVisitorPreference(value: unknown): value is VisitorPreference {
  return ['family', 'culture', 'relax', 'photo'].includes(String(value));
}

function isPhysicalLevel(value: unknown): value is PhysicalLevel {
  return ['low', 'medium', 'high'].includes(String(value));
}
