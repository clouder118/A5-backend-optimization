import { SendOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Input, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../types/scenic';
import AudioButton from './AudioButton';
import SourceCard from './SourceCard';
import SpeechInputButton from './SpeechInputButton';

export interface ChatBoxProps {
  messages?: ChatMessage[];
  loading?: boolean;
  error?: string;
  emptyText?: string;
  placeholder?: string;
  submitLabel?: string;
  enableSpeechInput?: boolean;
  onSend: (question: string) => void;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
  onSpeakError?: (message: string) => void;
}

export default function ChatBox({
  messages = [],
  loading = false,
  error,
  emptyText = '还没有对话，先问 AI 导游一个问题吧。',
  placeholder = '试试：灵山大佛有什么看点？',
  submitLabel = '发送',
  enableSpeechInput = false,
  onSend,
  onSpeakStart,
  onSpeakEnd,
  onSpeakError,
}: ChatBoxProps) {
  const [draft, setDraft] = useState('');
  const [speechError, setSpeechError] = useState('');
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, loading]);

  const submit = () => {
    const question = draft.trim();
    if (!question || loading) {
      return;
    }
    setDraft('');
    onSend(question);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    event.preventDefault();
    submit();
  };

  return (
    <Card className="chat-panel" title="AI 导游问答">
      {error ? (
        <Alert type="warning" showIcon message="问答服务异常" description={error} style={{ marginBottom: 12 }} />
      ) : null}
      {speechError ? (
        <Alert
          type="info"
          showIcon
          message="语音输入提示"
          description={speechError}
          style={{ marginBottom: 12 }}
        />
      ) : null}
      <div className="message-list">
        {messages.length === 0 && !loading ? <Empty description={emptyText} /> : null}
        {messages.map((item) => (
          <div key={item.id} className={`chat-bubble ${item.role}`}>
            <Typography.Paragraph style={{ marginBottom: item.sources?.length ? 8 : 0 }}>
              {item.content}
            </Typography.Paragraph>
            {item.isFallback ? (
              <Tag color="gold" style={{ marginBottom: 8 }}>
                兜底回答
              </Tag>
            ) : null}
            {hasWebSource(item) && !item.isFallback ? (
              <Tag color="blue" style={{ marginBottom: 8 }}>
                联网补充
              </Tag>
            ) : null}
            {hasSourceConflict(item) ? (
              <Alert
                type="warning"
                showIcon
                message="来源存在差异"
                description="当前回答已按数据库优先原则处理，涉及实时信息请以官方公告或现场说明为准。"
                style={{ marginBottom: 8 }}
              />
            ) : null}
            {item.role === 'assistant' ? (
              <Space size={8} wrap>
                <AudioButton
                  text={item.content}
                  audioUrl={item.audioUrl}
                  label={item.ttsStatus === 'pending' ? '语音生成中' : '播放讲解'}
                  loading={item.ttsStatus === 'pending'}
                  disabled={item.ttsStatus === 'pending'}
                  onStart={onSpeakStart}
                  onEnd={onSpeakEnd}
                  onError={() => onSpeakError?.('语音播放暂时不可用，已保留文字讲解。')}
                />
                {item.ttsStatus === 'failed' ? <Tag color="orange">语音暂不可用</Tag> : null}
              </Space>
            ) : null}
            {item.sources?.length ? (
              <div className="source-list">
                {item.sources.map((source) => (
                  <SourceCard key={source.id} source={source} />
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {loading ? (
          <div className="chat-bubble assistant">
            <Spin size="small" /> 正在检索景区资料并组织回答...
          </div>
        ) : null}
        <div ref={messageEndRef} />
      </div>
      <div className="chat-input-row">
        {enableSpeechInput ? (
          <SpeechInputButton
            disabled={loading}
            onTranscript={(text) => {
              setSpeechError('');
              setDraft(text);
            }}
            onError={setSpeechError}
          />
        ) : null}
        <Input.TextArea
          size="large"
          value={draft}
          placeholder={placeholder}
          disabled={loading}
          autoSize={{ minRows: 1, maxRows: 4 }}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleInputKeyDown}
        />
        <Button type="primary" size="large" icon={<SendOutlined />} loading={loading} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </Card>
  );
}

function hasWebSource(message: ChatMessage) {
  return message.sources?.some((source) => ['approved_web', 'realtime_web'].includes(source.sourceType ?? ''));
}

function hasSourceConflict(message: ChatMessage) {
  const sourceTypes = new Set(message.sources?.map((source) => source.sourceType));
  const hasDatabase = sourceTypes.has('database');
  const hasWeb = sourceTypes.has('approved_web') || sourceTypes.has('realtime_web');
  return hasDatabase && hasWeb && /冲突|差异|不同来源/.test(message.content);
}
