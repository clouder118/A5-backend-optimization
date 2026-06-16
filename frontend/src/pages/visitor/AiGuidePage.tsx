import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CompassOutlined,
  CustomerServiceOutlined,
  EnvironmentOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import { Alert, Card, Space, Tag, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';
import AvatarGuide from '../../components/guide/AvatarGuide';
import type { AvatarAudioState } from '../../components/guide/AvatarGuide';
import ChatBox from '../../components/guide/ChatBox';
import { initialGuideMessages } from '../../components/guide/welcomeMessage';
import { streamChatWithGuide } from '../../api/chat';
import { getTtsJobStatus } from '../../api/tts';
import type { GuideEmotionCue } from '../../config/live2dGuide';
import { productCopy } from '../../config/product';
import type { ChatMessage, GuideStatus } from '../../types/scenic';
import {
  buildPreferenceGuideQuestion,
  formatVisitorPreference,
  preferenceFromSearchParams,
  saveVisitorPreference,
  visitorTypeLabels,
} from '../../utils/visitorProfile';

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function audioStateFromTtsStatus(status?: ChatMessage['ttsStatus']): AvatarAudioState {
  if (status === 'pending') {
    return 'pending';
  }
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'ready' || status === 'disabled') {
    return 'ready';
  }
  return 'idle';
}

export default function AiGuidePage() {
  const [searchParams] = useSearchParams();
  const profileKey = searchParams.toString();
  const preference = useMemo(() => preferenceFromSearchParams(searchParams), [profileKey]);
  const preferenceText = useMemo(() => formatVisitorPreference(preference), [preference]);
  const [messages, setMessages] = useState<ChatMessage[]>(initialGuideMessages);
  const [status, setStatus] = useState<GuideStatus>('idle');
  const [audioState, setAudioState] = useState<AvatarAudioState>('idle');
  const [emotionCue, setEmotionCue] = useState<GuideEmotionCue>('idle');
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [sessionId, setSessionId] = useState(() => `guide-session-${Date.now()}`);
  const autoAskedRef = useRef(false);

  const spotId = searchParams.get('spotId') ?? undefined;
  const spotName = searchParams.get('spotName') ?? undefined;
  const initialQuestion = searchParams.get('question') ?? undefined;

  useEffect(() => {
    saveVisitorPreference(preference);
  }, [preference]);

  const questionGroups = useMemo(
    () => [
      {
        title: '景点讲解',
        icon: <ReadOutlined />,
        questions: [
          spotName ? `请介绍一下${spotName}的主要看点。` : '灵山大佛有什么看点？',
          '梵宫有什么特色？',
        ],
      },
      {
        title: '路线规划',
        icon: <CompassOutlined />,
        questions: [
          buildPreferenceGuideQuestion(preference),
          `按${visitorTypeLabels[preference.visitorType]}偏好推荐一条路线。`,
        ],
      },
      {
        title: '服务信息',
        icon: <CustomerServiceOutlined />,
        questions: ['带老人来需要注意什么？', '如果想少走路，路线怎么安排？'],
      },
      {
        title: '亲子与拍照',
        icon: <EnvironmentOutlined />,
        questions: ['带小朋友来适合先看哪里？', '哪里比较适合拍照？'],
      },
    ],
    [spotName, preference],
  );

  const sendQuestion = async (question: string) => {
    setChatError('');
    setStatus('thinking');
    setAudioState('idle');
    setEmotionCue('thinking');
    setLoading(true);

    const userMessage: ChatMessage = {
      id: createMessageId('user'),
      role: 'user',
      content: question,
    };
    const assistantMessageId = createMessageId('assistant');
    const streamingAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };

    setMessages((current) => [...current, userMessage, streamingAssistantMessage]);

    let hasDelta = false;
    const response = await streamChatWithGuide(
      {
        question,
        sessionId,
        visitorType: preference.visitorType,
        preference: preferenceText,
        spotId,
        currentSpotName: spotName ?? '灵山大佛',
      },
      {
        onDelta: (chunk) => {
          hasDelta = true;
          setLoading(false);
          setStatus('thinking');
          setEmotionCue('thinking');
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: `${message.content}${chunk}` }
                : message,
            ),
          );
        },
      },
    );

    if (response.sessionId) {
      setSessionId(response.sessionId);
    }
    if (!hasDelta) {
      setLoading(false);
    }

    if (response.isFallback) {
      setChatError('AI 服务暂时不可用，已为你保留基础游览建议。');
    }
    if (response.isFallback) {
      setEmotionCue('fallback');
    } else if (response.sources.length > 0) {
      setEmotionCue('success');
    } else {
      setEmotionCue('idle');
    }
    setAudioState(audioStateFromTtsStatus(response.ttsStatus));

    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: response.answer,
      sources: response.sources,
      audioUrl: response.audioUrl,
      ttsJobId: response.ttsJobId,
      ttsStatus: response.ttsStatus,
      isFallback: response.isFallback,
      metrics: response.metrics,
    };

    setMessages((current) =>
      current.map((message) =>
        message.id === assistantMessageId ? assistantMessage : message,
      ),
    );
    setStatus('idle');
    window.setTimeout(() => {
      setEmotionCue((current) =>
        current === 'success' || current === 'fallback' ? 'idle' : current,
      );
    }, 1300);
    if (response.ttsJobId && response.ttsStatus === 'pending') {
      setAudioState('pending');
      void pollTtsJob(response.ttsJobId, assistantMessage.id);
    }
  };

  useEffect(() => {
    if (!initialQuestion || autoAskedRef.current) {
      return;
    }
    autoAskedRef.current = true;
    void sendQuestion(initialQuestion);
  }, [initialQuestion]);

  const pollTtsJob = async (jobId: string, messageId: string) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      const ttsStatus = await getTtsJobStatus(jobId);
      if (ttsStatus.status === 'pending') {
        setAudioState('pending');
        continue;
      }
      setAudioState(audioStateFromTtsStatus(ttsStatus.status));
      if (ttsStatus.status === 'failed') {
        setEmotionCue('fallback');
      } else if (ttsStatus.status === 'ready') {
        setEmotionCue('success');
      }
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, audioUrl: ttsStatus.audioUrl, ttsStatus: ttsStatus.status }
            : message,
        ),
      );
      return;
    }
  };

  const sendPresetQuestion = (question: string) => {
    if (!loading) {
      void sendQuestion(question);
    }
  };

  return (
    <div className="page-stack">
      <Space direction="vertical" size={6}>
        <Typography.Title level={1} style={{ margin: 0 }}>
          {productCopy.guideName}
        </Typography.Title>
      </Space>

      {spotName ? (
        <Alert
          type="info"
          showIcon
          message={`当前咨询景点：${spotName}`}
          description="AI 导游会优先结合该景点上下文组织回答；你也可以继续追问路线、亲子游和服务信息。"
        />
      ) : null}

      <div className="chat-shell">
        <Card className="guide-console">
          <AvatarGuide
            status={status}
            variant="stage"
            profileText={preferenceText}
            audioState={audioState}
            emotionCue={emotionCue}
            stageMode="guide"
            title={loading ? '正在检索与组织回答' : undefined}
            detail=""
          />
          <div className="question-groups">
            {questionGroups.map((group) => (
              <div className="question-group" key={group.title}>
                <Typography.Text strong>
                  {group.icon} {group.title}
                </Typography.Text>
                <div className="meta-line">
                  {group.questions.map((question) => (
                    <Tag
                      color="green"
                      key={question}
                      onClick={() => sendPresetQuestion(question)}
                      style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                    >
                      {question}
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <ChatBox
          messages={messages}
          loading={loading}
          error={chatError}
          enableSpeechInput
          placeholder={`按${visitorTypeLabels[preference.visitorType]}偏好继续问 AI 导游`}
          onSend={(question) => void sendQuestion(question)}
          onSpeakStart={() => {
            setStatus('speaking');
            setAudioState('playing');
            setEmotionCue('speaking');
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
        />
      </div>
    </div>
  );
}
