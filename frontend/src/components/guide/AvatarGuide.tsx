import { Alert, Badge, Skeleton, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { haruGuide } from '../../config/live2dGuide';
import type { GuideEmotionCue, GuideStageMode } from '../../config/live2dGuide';
import type { GuideStatus } from '../../types/scenic';
import Live2DGuideStage from './Live2DGuideStage';

export type AvatarAudioState = 'idle' | 'pending' | 'ready' | 'playing' | 'failed';
export type AvatarGuideVariant = 'compact' | 'stage';

export interface AvatarGuideProps {
  status: GuideStatus;
  loading?: boolean;
  error?: string;
  title?: string;
  detail?: string;
  profileText?: string;
  audioState?: AvatarAudioState;
  emotionCue?: GuideEmotionCue;
  stageMode?: GuideStageMode;
  variant?: AvatarGuideVariant;
  modelUrl?: string;
  fallbackImageUrl?: string;
  enableLive2D?: boolean;
}

const statusText: Record<GuideStatus, { label: string; detail: string; badge: 'default' | 'processing' | 'success' }> = {
  idle: {
    label: '待命中',
    detail: '可以询问景点故事、路线建议和游览提醒。',
    badge: 'default',
  },
  thinking: {
    label: '检索资料中',
    detail: '正在从景区资料知识库里查找依据。',
    badge: 'processing',
  },
  speaking: {
    label: '正在讲解',
    detail: '回答已生成，可点语音播放听取讲解。',
    badge: 'success',
  },
};

const audioStateText: Record<AvatarAudioState, { label: string; color: 'default' | 'processing' | 'success' | 'warning' }> = {
  idle: { label: '语音待命', color: 'default' },
  pending: { label: '语音生成中', color: 'processing' },
  ready: { label: '语音可播放', color: 'success' },
  playing: { label: '正在播报', color: 'success' },
  failed: { label: '语音兜底', color: 'warning' },
};

const defaultModelUrl = haruGuide.modelUrl;
const defaultFallbackImageUrl = haruGuide.fallbackImageUrl;

export default function AvatarGuide({
  status,
  loading = false,
  error,
  title,
  detail,
  profileText,
  audioState = 'idle',
  emotionCue,
  stageMode = 'guide',
  variant = 'compact',
  modelUrl = defaultModelUrl,
  fallbackImageUrl = defaultFallbackImageUrl,
  enableLive2D = true,
}: AvatarGuideProps) {
  const current = statusText[status];
  const audio = audioStateText[audioState];
  const statusDetail = detail ?? current.detail;
  const [imageFailed, setImageFailed] = useState(false);
  const [live2dError, setLive2dError] = useState('');
  const [live2dCanLoad, setLive2dCanLoad] = useState(stageMode === 'guide');
  const [sleeping, setSleeping] = useState(false);
  const [ambientCue, setAmbientCue] = useState<GuideEmotionCue>('idle');
  const lastActivityAtRef = useRef(Date.now());
  const shouldUseLive2D = variant === 'stage' && enableLive2D && !live2dError && live2dCanLoad;
  const explicitEmotionCue = emotionCue && emotionCue !== 'idle' ? emotionCue : undefined;
  const resolvedEmotionCue = useMemo<GuideEmotionCue>(() => {
    if (
      sleeping &&
      status === 'idle' &&
      audioState !== 'playing' &&
      audioState !== 'pending' &&
      !explicitEmotionCue
    ) return 'sleep';
    if (explicitEmotionCue) return explicitEmotionCue;
    if (ambientCue !== 'idle') return ambientCue;
    if (status === 'thinking') return 'thinking';
    if (audioState === 'playing') return 'speaking';
    return 'idle';
  }, [ambientCue, audioState, explicitEmotionCue, sleeping, status]);

  useEffect(() => {
    if (variant !== 'stage' || !enableLive2D) return undefined;
    setLive2dCanLoad(false);
    const delay = haruGuide.stages[stageMode].live2dDelayMs;
    const timer = window.setTimeout(() => setLive2dCanLoad(true), delay);
    return () => window.clearTimeout(timer);
  }, [enableLive2D, stageMode, variant]);

  const registerActivity = () => {
    lastActivityAtRef.current = Date.now();
    if (sleeping) {
      setSleeping(false);
      setAmbientCue('wake');
      window.setTimeout(() => setAmbientCue('idle'), 2200);
    }
  };

  useEffect(() => {
    registerActivity();
    if (status !== 'idle' || audioState === 'playing' || audioState === 'pending' || explicitEmotionCue) {
      setSleeping(false);
    }
  }, [audioState, explicitEmotionCue, status]);

  useEffect(() => {
    if (variant !== 'stage') return undefined;
    const onActivity = () => registerActivity();
    window.addEventListener('pointermove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    const timer = window.setInterval(() => {
      if (status !== 'idle' || audioState === 'playing' || audioState === 'pending') return;
      if (Date.now() - lastActivityAtRef.current >= haruGuide.idleTimeoutMs) {
        setSleeping(true);
      }
    }, 2000);
    return () => {
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.clearInterval(timer);
    };
  }, [audioState, sleeping, status, variant]);

  if (loading) {
    return (
      <div className={`avatar-guide avatar-guide-${variant}`}>
        <Skeleton.Image active className="avatar-skeleton" />
        <div className="avatar-status">
          <Skeleton active paragraph={{ rows: 2 }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`avatar-guide avatar-guide-${variant} avatar-guide-${stageMode} is-${status} audio-${audioState}`}>
      <div
        className={`avatar-stage-shell ${
          shouldUseLive2D ? 'has-live2d' : imageFailed ? 'has-fallback' : 'has-image'
        }`}
        aria-label="AI 数字人导游"
      >
        <div className="avatar-aura" />
        <div className="avatar-scan-ring" />
        <div className="avatar-light-dots">
          <span />
          <span />
          <span />
        </div>

        {shouldUseLive2D ? (
          <Live2DGuideStage
            status={status}
            audioState={audioState}
            emotionCue={resolvedEmotionCue}
            modelUrl={modelUrl}
            onInteract={registerActivity}
            onError={(message) => setLive2dError(message)}
          />
        ) : (
          <>
            <img
              className="avatar-character"
              src={fallbackImageUrl}
              alt="灵山胜境 AI 数字人导游"
              draggable={false}
              onError={() => setImageFailed(true)}
            />
            <div className="avatar-css-fallback" aria-hidden="true">
              <div className="avatar-fallback-hair" />
              <div className="avatar-fallback-face">
                <span className="avatar-fallback-mouth" />
              </div>
              <div className="avatar-fallback-body" />
            </div>
          </>
        )}

        <div className="avatar-speech-wave" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="avatar-status">
        {error ? (
          <Alert type="warning" showIcon message="数字人状态异常" description={error} />
        ) : (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Space size={8} wrap>
              <Badge status={current.badge} text={title ?? current.label} />
              <Tag color={audio.color}>{audio.label}</Tag>
              {live2dError ? <Tag color="orange">Live2D 兜底</Tag> : null}
            </Space>
            {statusDetail ? (
              <Typography.Text type="secondary">
                {status === 'thinking' ? <Spin size="small" style={{ marginRight: 8 }} /> : null}
                {statusDetail}
              </Typography.Text>
            ) : null}
            {live2dError ? (
              <Typography.Text
                type="secondary"
                className="avatar-live2d-error"
                title={live2dError}
                data-live2d-error={live2dError}
              >
                Live2D 资源未就绪，已使用静态数字人兜底。
              </Typography.Text>
            ) : null}
            {profileText ? (
              <Typography.Text className="avatar-profile-text">{profileText}</Typography.Text>
            ) : null}
          </Space>
        )}
      </div>
    </div>
  );
}
