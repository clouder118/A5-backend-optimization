import { CheckOutlined, DownOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { GuideMode, GuideNarrationDuration, GuideNarrationStyle } from '../../types/scenic';

export const DEFAULT_GUIDE_MODE: GuideMode = {
  style: 'study',
  duration: 'half_minute',
};

const styleOptions: Array<{
  value: GuideNarrationStyle;
  label: string;
  hint: string;
}> = [
  { value: 'children', label: '儿童版', hint: '故事感更强' },
  { value: 'study', label: '研学版', hint: '知识点清楚' },
  { value: 'senior', label: '长者版', hint: '慢一点更稳' },
];

const durationOptions: Array<{
  value: GuideNarrationDuration;
  label: string;
}> = [
  { value: 'half_minute', label: '约半分钟' },
  { value: 'two_minutes', label: '约两分钟' },
];

export function guideModeLabel(mode: GuideMode): string {
  const styleLabel = styleOptions.find((item) => item.value === mode.style)?.label ?? '研学版';
  const durationLabel = durationOptions.find((item) => item.value === mode.duration)?.label ?? '约半分钟';
  return `${styleLabel} · ${durationLabel}`;
}

interface GuideModeSelectorProps {
  value: GuideMode;
  disabled?: boolean;
  onChange: (mode: GuideMode) => void;
}

export default function GuideModeSelector({ value, disabled = false, onChange }: GuideModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const updateStyle = (style: GuideNarrationStyle) => {
    onChange({ ...value, style });
  };

  const updateDuration = (duration: GuideNarrationDuration) => {
    onChange({ ...value, duration });
  };

  return (
    <div ref={rootRef} className="guide-mode-selector">
      <Button
        className="guide-mode-selector__trigger"
        htmlType="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="guide-mode-selector__trigger-label">导游模式</span>
        <small className="guide-mode-selector__trigger-summary">{guideModeLabel(value)}</small>
        <DownOutlined className="guide-mode-selector__chevron" />
      </Button>

      {open ? (
        <div className="guide-mode-selector__panel" role="dialog" aria-label="导游模式设置">
          <section className="guide-mode-selector__group">
            <div className="guide-mode-selector__group-title">讲解风格</div>
            <div className="guide-mode-selector__grid">
              {styleOptions.map((option) => {
                const selected = option.value === value.style;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`guide-mode-selector__option ${selected ? 'guide-mode-selector__option--active' : ''}`}
                    aria-pressed={selected}
                    onClick={() => updateStyle(option.value)}
                  >
                    <span>{option.label}</span>
                    <small>{option.hint}</small>
                    {selected ? <CheckOutlined /> : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="guide-mode-selector__group">
            <div className="guide-mode-selector__group-title">讲解时长</div>
            <div className="guide-mode-selector__duration-row">
              {durationOptions.map((option) => {
                const selected = option.value === value.duration;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`guide-mode-selector__duration ${selected ? 'guide-mode-selector__duration--active' : ''}`}
                    aria-pressed={selected}
                    onClick={() => updateDuration(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
