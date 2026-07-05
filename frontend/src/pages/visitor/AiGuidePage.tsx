import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { streamChatWithGuide } from '../../api/chat';
import { createRouteDraft } from '../../api/routeDrafts';
import { createTour } from '../../api/tours';
import { getTtsJobStatus } from '../../api/tts';
import AvatarGuide from '../../components/guide/AvatarGuide';
import type { AvatarAudioState } from '../../components/guide/AvatarGuide';
import ChatBox from '../../components/guide/ChatBox';
import GuideEntryLoader from '../../components/guide/GuideEntryLoader';
import GuideQuickPrompts from '../../components/guide/GuideQuickPrompts';
import type { GuideQuickPrompt } from '../../components/guide/GuideQuickPrompts';
import { WELCOME_MESSAGE_AUDIO_URL, WELCOME_MESSAGE_TEXT } from '../../components/guide/welcomeMessage';
import { avatar151Guide } from '../../config/avatar151Guide';
import type { GuideEmotionCue } from '../../config/avatar151Guide';
import { productCopy } from '../../config/product';
import type { ChatMessage, GuideStatus } from '../../types/scenic';
import {
  buildPreferenceGuideQuestion,
  formatVisitorPreference,
  preferenceFromSearchParams,
  preferenceToSearchParams,
  saveVisitorPreference,
} from '../../utils/visitorProfile';
import {
  loadGuideChatSession,
  saveGuideChatSession,
  saveRouteMapSession,
  saveRouteRecommendationSession,
} from '../../utils/visitorSessionState';

const INITIAL_MESSAGE_DELAY_MS = 100;

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sourceDelay() {
  return 1_000 + Math.random() * 2_000;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function audioStateFromTtsStatus(status?: ChatMessage['ttsStatus']): AvatarAudioState {
  if (status === 'pending') return 'pending';
  if (status === 'failed') return 'failed';
  if (status === 'ready' || status === 'disabled') return 'ready';
  return 'idle';
}

function audioStateFromMessages(messages?: ChatMessage[]): AvatarAudioState {
  if (!messages?.length) return 'idle';
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant') return audioStateFromTtsStatus(message.ttsStatus);
  }
  return 'idle';
}

export default function AiGuidePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const profileKey = searchParams.toString();
  const preference = useMemo(() => preferenceFromSearchParams(searchParams), [profileKey]);
  const preferenceText = useMemo(() => formatVisitorPreference(preference), [preference]);
  const [initialGuideSession] = useState(() => loadGuideChatSession());
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialGuideSession?.messages ?? []);
  const [status, setStatus] = useState<GuideStatus>('idle');
  const [audioState, setAudioState] = useState<AvatarAudioState>(() =>
    audioStateFromMessages(initialGuideSession?.messages),
  );
  const [emotionCue, setEmotionCue] = useState<GuideEmotionCue>('idle');
  const [avatarSpeechText, setAvatarSpeechText] = useState('');
  const [avatarSpeechNonce, setAvatarSpeechNonce] = useState(0);
  const [loading, setLoading] = useState(() => !initialGuideSession?.introReady);
  const [chatError, setChatError] = useState('');
  const [sessionId, setSessionId] = useState(() => initialGuideSession?.sessionId ?? `guide-session-${Date.now()}`);
  const [introReady, setIntroReady] = useState(() => Boolean(initialGuideSession?.introReady));
  const [showEntryLoader, setShowEntryLoader] = useState(true);
  const handledInitialQuestionKeyRef = useRef(initialGuideSession?.handledInitialQuestionKey);

  const spotId = searchParams.get('spotId') ?? undefined;
  const spotName = searchParams.get('spotName') ?? undefined;
  const initialQuestion = searchParams.get('question') ?? undefined;
  const initialQuestionKey = useMemo(
    () => (initialQuestion ? `${profileKey}|${spotId ?? ''}|${spotName ?? ''}|${initialQuestion}` : ''),
    [initialQuestion, profileKey, spotId, spotName],
  );

  useLayoutEffect(() => {
    document.body.classList.add('guide-workbench-active');
    return () => {
      document.body.classList.remove('guide-workbench-active');
    };
  }, []);

  useLayoutEffect(() => {
    setShowEntryLoader(true);
  }, [location.key]);

  const finishEntryLoader = useCallback(() => {
    setShowEntryLoader(false);
  }, []);

  useEffect(() => {
    saveVisitorPreference(preference);
  }, [preference]);

  const quickPrompts = useMemo<GuideQuickPrompt[]>(
    () => [
      {
        id: 'spot',
        category: '景点讲解',
        question: spotName ? `请介绍一下${spotName}的主要看点。` : '灵山大佛有什么看点？',
      },
      {
        id: 'route',
        category: '路线规划',
        question: buildPreferenceGuideQuestion(preference),
      },
      {
        id: 'service',
        category: '服务信息',
        question: '带老人来需要注意什么？',
      },
    ],
    [spotName, preference],
  );

  useEffect(() => {
    if (introReady || messages.length > 0) {
      setLoading(false);
      if (!introReady) setIntroReady(true);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      const typingId = createMessageId('assistant-typing');
      setMessages([{ id: typingId, role: 'assistant', content: '', createdAt: Date.now() }]);
      void wait(sourceDelay()).then(() => {
        if (cancelled) return;
        setMessages([
          {
            id: 'assistant-welcome',
            role: 'assistant',
            content: WELCOME_MESSAGE_TEXT,
            audioUrl: WELCOME_MESSAGE_AUDIO_URL,
            ttsStatus: 'ready',
            createdAt: Date.now(),
          },
        ]);
        setAudioState('ready');
        setLoading(false);
        setIntroReady(true);
      });
    }, INITIAL_MESSAGE_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    saveGuideChatSession({
      messages,
      sessionId,
      introReady,
      handledInitialQuestionKey: handledInitialQuestionKeyRef.current,
    });
  }, [introReady, messages, sessionId]);

  const sendQuestion = async (question: string) => {
    setChatError('');
    setStatus('thinking');
    setAudioState('idle');
    setEmotionCue('thinking');
    setAvatarSpeechText('');
    setLoading(true);

    const userMessage: ChatMessage = {
      id: createMessageId('user'),
      role: 'user',
      content: question,
      createdAt: Date.now(),
    };
    const typingMessageId = createMessageId('assistant-typing');
    let streamedAnswer = '';
    setMessages((current) => [
      ...current,
      userMessage,
      { id: typingMessageId, role: 'assistant', content: '', createdAt: Date.now() },
    ]);

    const response = await streamChatWithGuide({
      question,
      sessionId,
      preference: preferenceText,
      routePreference: preference,
      spotId,
      currentSpotName: spotName ?? '灵山大佛',
    }, {
      onDelta: (text) => {
        if (!text) return;
        streamedAnswer += text;
        setStatus('idle');
        setEmotionCue('idle');
        setAvatarSpeechText('');
        setMessages((current) =>
          current.map((message) =>
            message.id === typingMessageId ? { ...message, content: streamedAnswer } : message,
          ),
        );
      },
    });
    if (response.sessionId) setSessionId(response.sessionId);

    if (response.isFallback) {
      setChatError('AI 服务暂时不可用，已为你保留基础游览建议。');
      setEmotionCue('fallback');
    } else if (response.sources.length > 0 && response.ttsStatus !== 'pending') {
      setEmotionCue('success');
    } else {
      setEmotionCue('idle');
    }
    setAudioState(audioStateFromTtsStatus(response.ttsStatus));

    const assistantMessage: ChatMessage = {
      id: createMessageId('assistant'),
      role: 'assistant',
      content: response.answer || streamedAnswer,
      sources: response.sources,
      audioUrl: response.audioUrl,
      ttsJobId: response.ttsJobId,
      ttsStatus: response.ttsStatus,
      isFallback: response.isFallback,
      metrics: response.metrics,
      guideAction: response.guideAction,
      routePlan: response.guideAction?.type === 'route_recommendation' ? response.guideAction.route : undefined,
      routePreference:
        response.guideAction?.type === 'route_recommendation' ? response.guideAction.preference ?? preference : preference,
      emotionCue: response.emotionCue,
      createdAt: Date.now(),
    };
    setAvatarSpeechText(assistantMessage.content);

    setMessages((current) =>
      current.map((message) => (message.id === typingMessageId ? assistantMessage : message)),
    );
    setStatus('idle');
    setLoading(false);
    window.setTimeout(() => {
      setEmotionCue((current) => (current === 'success' || current === 'fallback' ? 'idle' : current));
    }, 2400);

    if (response.ttsJobId && response.ttsStatus === 'pending') {
      setAudioState('pending');
      void pollTtsJob(response.ttsJobId, assistantMessage.id);
    }
  };

  useEffect(() => {
    if (!initialQuestion || !introReady || !initialQuestionKey) return;
    if (handledInitialQuestionKeyRef.current === initialQuestionKey) return;
    handledInitialQuestionKeyRef.current = initialQuestionKey;
    void sendQuestion(initialQuestion);
  }, [initialQuestion, initialQuestionKey, introReady]);

  const pollTtsJob = async (jobId: string, messageId: string) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await wait(1200);
      const ttsStatus = await getTtsJobStatus(jobId);
      if (ttsStatus.status === 'pending') {
        setAudioState('pending');
        continue;
      }
      setAudioState(audioStateFromTtsStatus(ttsStatus.status));
      if (ttsStatus.status === 'failed') setEmotionCue('fallback');
      if (ttsStatus.status === 'ready') setEmotionCue('idle');
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, audioUrl: ttsStatus.audioUrl, ttsStatus: ttsStatus.status } : message,
        ),
      );
      return;
    }
  };

  const sendPresetQuestion = (question: string) => {
    if (!loading && introReady) void sendQuestion(question);
  };

  const viewRouteOnMap = (message: ChatMessage) => {
    const routePreference = message.routePreference ?? preference;
    const nextPreference = {
      ...routePreference,
      mapId: message.routePlan?.mapId ?? routePreference.mapId,
    };
    if (message.routePlan) {
      saveRouteRecommendationSession({
        preference: nextPreference,
        routes: [message.routePlan],
      });
      saveRouteMapSession({
        activeMapId: message.routePlan.mapId,
        activeRouteId: message.routePlan.id,
        activeSpotId: message.routePlan.spots[0]?.spotId,
      });
    }
    const params = preferenceToSearchParams(nextPreference);
    navigate(`/routes?${params.toString()}`);
  };

  const editRouteFromMessage = async (message: ChatMessage) => {
    if (!message.routePlan) return;
    setChatError('');
    try {
      const routePreference = message.routePreference ?? preference;
      const draft = await createRouteDraft(message.routePlan, {
        ...routePreference,
        mapId: message.routePlan.mapId,
      });
      navigate(`/route-drafts/${draft.id}`);
    } catch {
      setChatError('路线草稿创建失败，请稍后重试。');
      setEmotionCue('fallback');
    }
  };

  const startTourFromMessage = async (message: ChatMessage) => {
    if (!message.routePlan) return;
    setChatError('');
    try {
      const routePreference = message.routePreference ?? preference;
      const draft = await createRouteDraft(message.routePlan, {
        ...routePreference,
        mapId: message.routePlan.mapId,
      });
      const tour = await createTour(draft.id, message.routePlan.mapId);
      navigate(`/tour/${tour.id}`);
    } catch {
      setChatError('开始游览失败，请稍后重试。');
      setEmotionCue('fallback');
    }
  };

  return (
    <>
      <div
        className={`ai-guide-page ai-guide-page--chat guide-entry-content ${
          showEntryLoader ? 'guide-entry-content--waiting' : 'guide-entry-content--ready'
        }`}
        aria-hidden={showEntryLoader}
      >
      <div className="ai-guide-workbench" data-testid="ai-guide-workbench">
        <aside className="ai-guide-workbench__avatar luxury-avatar-stage" aria-label="AI 数字人导游">
          <AvatarGuide
            status={status}
            variant="stage"
            presentation="bare"
            showStatus={false}
            showStateBadge
            audioState={audioState}
            emotionCue={emotionCue}
            stageMode="guide"
            speechText={avatarSpeechText}
            speechNonce={avatarSpeechNonce}
          />
        </aside>

        <ChatBox
          messages={messages}
          loading={loading}
          error={chatError}
          enableSpeechInput
          assistant={{
            name: productCopy.guideName,
            subtitle: '在线智能导览',
            avatarSrc: avatar151Guide.chatAvatarUrl,
            avatarAlt: '灵山胜境 AI 导游头像',
          }}
          onSend={(question) => void sendQuestion(question)}
          onSpeakStart={(message) => {
            setStatus('speaking');
            setAudioState('playing');
            setEmotionCue('speaking');
            setAvatarSpeechText(message.content);
            setAvatarSpeechNonce((current) => current + 1);
          }}
          onSpeakEnd={() => {
            setStatus('idle');
            setAudioState('ready');
            setEmotionCue('idle');
          }}
          onSpeakError={(message) => {
            setStatus('idle');
            setAudioState('failed');
            setEmotionCue('fallback');
            console.warn('[AiGuidePage] audio playback failed:', message);
          }}
          onViewRoute={viewRouteOnMap}
          onEditRoute={(message) => void editRouteFromMessage(message)}
          onStartTour={(message) => void startTourFromMessage(message)}
        />

        <GuideQuickPrompts prompts={quickPrompts} disabled={loading || !introReady} onSelect={sendPresetQuestion} />
      </div>
      </div>
      {showEntryLoader ? <GuideEntryLoader preserveHeader onComplete={finishEntryLoader} /> : null}
    </>
  );
}
