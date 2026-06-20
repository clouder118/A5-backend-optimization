import { AudioOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { useMemo, useRef, useState } from 'react';

type SpeechInputStatus = 'idle' | 'requesting' | 'listening' | 'unsupported' | 'error' | 'recognized';

interface SpeechRecognitionEventLike extends Event {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface SpeechInputButtonProps {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

const statusText: Record<SpeechInputStatus, string> = {
  idle: '点击后开始语音输入',
  requesting: '正在等待浏览器麦克风授权',
  listening: '正在识别，请说出你的问题',
  unsupported: '当前浏览器不支持语音输入，请使用键盘输入',
  error: '语音识别失败，可继续键盘输入',
  recognized: '已识别语音，确认后发送',
};

export default function SpeechInputButton({
  disabled = false,
  onTranscript,
  onError,
}: SpeechInputButtonProps) {
  const [status, setStatus] = useState<SpeechInputStatus>('idle');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const Recognition = useMemo(
    () =>
      typeof window === 'undefined'
        ? undefined
        : window.SpeechRecognition ?? window.webkitSpeechRecognition,
    [],
  );

  const supported = Boolean(Recognition);
  const listening = status === 'listening' || status === 'requesting';

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const startListening = () => {
    if (!Recognition) {
      setStatus('unsupported');
      onError?.('当前浏览器不支持语音输入，请使用 Chrome 或 Edge 演示。');
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setStatus('listening');
      recognition.onend = () => {
        setStatus((current) => (current === 'listening' || current === 'requesting' ? 'idle' : current));
      };
      recognition.onerror = (event) => {
        setStatus('error');
        const message =
          event.error === 'not-allowed'
            ? '浏览器没有获得麦克风权限，请允许后再试。'
            : '语音识别暂时不可用，请改用键盘输入。';
        onError?.(message);
      };
      recognition.onresult = (event) => {
        const transcript = Array.from({ length: event.results.length })
          .map((_, index) => event.results[index][0]?.transcript ?? '')
          .join('')
          .trim();
        if (transcript) {
          onTranscript(transcript);
          setStatus('recognized');
        }
      };
      recognitionRef.current = recognition;
      setStatus('requesting');
      recognition.start();
    } catch {
      setStatus('error');
      onError?.('语音输入启动失败，请检查浏览器麦克风权限。');
    }
  };

  return (
    <Tooltip title={supported ? statusText[status] : statusText.unsupported}>
      <Button
        aria-label="语音输入"
        icon={<AudioOutlined />}
        disabled={disabled || !supported}
        loading={status === 'requesting'}
        danger={listening}
        onClick={listening ? stopListening : startListening}
        data-cue={listening ? '[ STOP ]' : '[ VOICE ]'}
      >
        {listening ? '[ STOP ]' : '[ VOICE ]'}
      </Button>
    </Tooltip>
  );
}
