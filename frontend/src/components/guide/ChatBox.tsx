import { SendOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../types/scenic';
import AudioButton from './AudioButton';
import SourceCard from './SourceCard';
import SpeechInputButton from './SpeechInputButton';

export interface GuideAssistantIdentity {
  name: string;
  subtitle: string;
  avatarSrc: string;
  avatarAlt: string;
}

export interface ChatBoxProps {
  messages?: ChatMessage[];
  loading?: boolean;
  error?: string;
  enableSpeechInput?: boolean;
  assistant?: GuideAssistantIdentity;
  onSend: (question: string) => void;
  onSpeakStart?: (message: ChatMessage) => void;
  onSpeakEnd?: () => void;
  onSpeakError?: (message: string) => void;
  onViewRoute?: (message: ChatMessage) => void;
  onEditRoute?: (message: ChatMessage) => void;
  onStartTour?: (message: ChatMessage) => void;
}

const defaultAssistant: GuideAssistantIdentity = {
  name: '灵山胜境 AI 导游',
  subtitle: '在线智能导览',
  avatarSrc: '/avatar/uketsukejou151/avatar-151-head.png',
  avatarAlt: '灵山胜境 AI 导游头像',
};

export default function ChatBox({
  messages = [],
  loading = false,
  error,
  enableSpeechInput = false,
  assistant = defaultAssistant,
  onSend,
  onSpeakStart,
  onSpeakEnd,
  onSpeakError,
  onViewRoute,
  onEditRoute,
  onStartTour,
}: ChatBoxProps) {
  const [draft, setDraft] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const chatRootRef = useRef<HTMLElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'end' });
  }, [expandedSources, messages]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const nextHeight = Math.min(input.scrollHeight, 72);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > 72 ? 'auto' : 'hidden';
  }, [draft]);

  useEffect(() => {
    const forwardCoveredAudioClick = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const root = chatRootRef.current;
      if (!root) return;
      const target = event.target;
      if (target instanceof Element && target.closest('.message-play')) return;

      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.message-play'));
      const matchedButton = buttons.find((button) => {
        if (button.disabled) return false;
        const rect = button.getBoundingClientRect();
        return (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        );
      });

      if (!matchedButton) return;
      event.preventDefault();
      event.stopPropagation();
      matchedButton.click();
    };

    document.addEventListener('pointerdown', forwardCoveredAudioClick, true);
    return () => document.removeEventListener('pointerdown', forwardCoveredAudioClick, true);
  }, []);

  const submit = () => {
    const question = draft.trim();
    if (!question || loading) return;
    setDraft('');
    if (inputRef.current) inputRef.current.style.height = '22px';
    onSend(question);
  };

  const toggleSources = (messageId: string) => {
    setExpandedSources((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <section ref={chatRootRef} className="guide-aichat" data-testid="guide-chat-window" aria-label="AI 导游对话">
      <div className="bg" aria-hidden="true" />
      <div className="chat ai-chat chat-panel">
        <div className="chat-title">
          <h1>{assistant.name}</h1>
          <h2>{assistant.subtitle}</h2>
          <figure className="avatar">
            <img src={assistant.avatarSrc} alt={assistant.avatarAlt} data-testid="guide-chat-avatar" />
          </figure>
        </div>

        <div className="messages">
          <div className="messages-content">
            {messages.map((item, index) => {
              const isAssistant = item.role === 'assistant';
              const isTyping = isAssistant && !item.content;
              const sourceExpanded = expandedSources.has(item.id);

              if (isTyping) {
                return (
                  <div className="message loading new" data-testid="guide-typing-message" key={item.id}>
                    <figure className="avatar" aria-hidden="true">
                      <img src={assistant.avatarSrc} alt="" />
                    </figure>
                    <span />
                  </div>
                );
              }

              return (
                <div className="guide-aichat__message-block" key={item.id}>
                  <article className={`message ${isAssistant ? '' : 'message-personal'} new chat-bubble ${item.role}`}>
                    {isAssistant ? (
                      <figure className="avatar" aria-hidden="true">
                        <img src={assistant.avatarSrc} alt="" />
                      </figure>
                    ) : null}
                    <p>{item.content}</p>
                    {isAssistant ? (
                      <AudioButton
                        variant="minimal"
                        text={item.content}
                        audioUrl={item.audioUrl}
                        loading={item.ttsStatus === 'pending'}
                        disabled={item.ttsStatus === 'pending'}
                        onStart={() => onSpeakStart?.(item)}
                        onEnd={onSpeakEnd}
                        onError={() => onSpeakError?.('语音播放暂时不可用，已保留文字回答。')}
                      />
                    ) : null}
                    {shouldShowTimestamp(messages, index) ? <span className="timestamp">{formatTime(item.createdAt)}</span> : null}
                  </article>

                  {isAssistant && item.sources?.length ? (
                    <div className="guide-aichat__sources">
                      <button
                        type="button"
                        className="guide-aichat__source-toggle"
                        data-testid="guide-source-toggle"
                        aria-expanded={sourceExpanded}
                        onClick={() => toggleSources(item.id)}
                      >
                        资料来源
                      </button>
                      {sourceExpanded ? (
                        <div className="source-list">
                          {item.sources.map((source) => (
                            <SourceCard key={source.id} source={source} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isAssistant && item.guideAction?.type === 'route_recommendation' && item.routePlan ? (
                    <div className="guide-route-card" data-testid="guide-route-card">
                      <div className="guide-route-card__header">
                        <span>{item.routePlan.mapId === 'nianhua-bay' ? '拈花湾路线' : '灵山胜境路线'}</span>
                        <strong>{item.routePlan.name}</strong>
                      </div>
                      <div className="guide-route-card__meta">
                        <span>总计约 {item.routePlan.durationMinutes} 分钟</span>
                        <span>步行约 {item.routePlan.estimatedWalkMinutes ?? 0} 分钟</span>
                        <span>{item.routePlan.spots.length} 个点位</span>
                      </div>
                      <ol className="guide-route-card__spots">
                        {item.routePlan.spots.slice(0, 7).map((spot) => (
                          <li key={spot.spotId}>{spot.name}</li>
                        ))}
                      </ol>
                      <div className="guide-route-card__actions">
                        <Button size="small" onClick={() => onViewRoute?.(item)}>
                          查看地图
                        </Button>
                        <Button size="small" onClick={() => onEditRoute?.(item)}>
                          编辑路线
                        </Button>
                        <Button size="small" type="primary" onClick={() => onStartTour?.(item)}>
                          开始游览
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>
        </div>

        <form
          className="message-box chat-input-row"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <textarea
            ref={inputRef}
            className="message-input"
            value={draft}
            placeholder="……"
            disabled={loading}
            rows={1}
            aria-label="输入问题"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <div className="guide-aichat__input-actions">
            {enableSpeechInput ? (
              <SpeechInputButton
                className="message-voice"
                iconOnly
                disabled={loading}
                onTranscript={(text) => {
                  setSpeechError('');
                  setDraft(text);
                }}
                onError={setSpeechError}
              />
            ) : null}
            <Button
              className="message-submit"
              data-testid="guide-send"
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              aria-label="发送问题"
              disabled={!draft.trim() || loading}
            />
          </div>
        </form>
      </div>
      <span className="guide-aichat__sr-status" aria-live="polite">
        {speechError || error || ''}
      </span>
    </section>
  );
}

function shouldShowTimestamp(messages: ChatMessage[], index: number) {
  const current = messages[index]?.createdAt;
  if (!current) return false;
  const previous = messages[index - 1]?.createdAt;
  if (!previous) return true;
  return Math.floor(current / 60_000) !== Math.floor(previous / 60_000);
}

function formatTime(timestamp?: number) {
  const date = new Date(timestamp ?? Date.now());
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}
