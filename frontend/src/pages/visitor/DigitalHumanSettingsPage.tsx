import {
  CheckOutlined,
  CustomerServiceOutlined,
  ReloadOutlined,
  SmileOutlined,
  SoundOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Tooltip, message } from 'antd';
import { useMemo, useState } from 'react';
import styles from './DigitalHumanSettingsPage.module.css';

type AppearanceId = 'ling-shiyin' | 'ling-xiaoyu' | 'qingyin';
type VoiceId = 'gentle-female' | 'clear-female';
type PersonalityId = 'gentle' | 'professional' | 'friendly' | 'humorous';

interface AppearanceOption {
  id: AppearanceId;
  name: string;
  style: string;
  image: string;
  imageClassName?: string;
}

const appearanceOptions: AppearanceOption[] = [
  {
    id: 'ling-shiyin',
    name: '灵诗音',
    style: '智能导览',
    image: '/avatar/ling-shiyin-anime-full-v3.png',
    imageClassName: styles.framelessPortrait,
  },
  {
    id: 'ling-xiaoyu',
    name: '灵小语',
    style: '国风导览',
    image: '/avatar/ling-xiaoyu-anime-v2.png',
    imageClassName: styles.framelessPortrait,
  },
  {
    id: 'qingyin',
    name: '晴音',
    style: '沉静讲解',
    image: '/avatar/qingyin-full-v2.png',
    imageClassName: styles.framelessPortrait,
  },
];

const voiceOptions: Array<{ id: VoiceId; label: string; detail: string }> = [
  { id: 'gentle-female', label: '温柔女声', detail: '柔和自然' },
  { id: 'clear-female', label: '清朗女声', detail: '清晰明快' },
];

const personalityOptions: Array<{ id: PersonalityId; label: string; detail: string }> = [
  { id: 'gentle', label: '温柔耐心', detail: '细致解答' },
  { id: 'professional', label: '专业沉稳', detail: '知识讲解' },
  { id: 'friendly', label: '活泼亲切', detail: '轻松互动' },
  { id: 'humorous', label: '幽默风趣', detail: '趣味陪伴' },
];

const defaults = {
  appearance: 'ling-shiyin' as AppearanceId,
  voice: 'gentle-female' as VoiceId,
  personality: 'gentle' as PersonalityId,
};

export default function DigitalHumanSettingsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [appearance, setAppearance] = useState<AppearanceId>(defaults.appearance);
  const [voice, setVoice] = useState<VoiceId>(defaults.voice);
  const [personality, setPersonality] = useState<PersonalityId>(defaults.personality);

  const activeAppearance = useMemo(
    () => appearanceOptions.find((item) => item.id === appearance) ?? appearanceOptions[0],
    [appearance],
  );
  const activeVoice = voiceOptions.find((item) => item.id === voice) ?? voiceOptions[0];
  const activePersonality =
    personalityOptions.find((item) => item.id === personality) ?? personalityOptions[0];

  const resetSettings = () => {
    setAppearance(defaults.appearance);
    setVoice(defaults.voice);
    setPersonality(defaults.personality);
  };

  const applySettings = () => {
    messageApi.success('数字人设置已应用（演示）');
  };

  return (
    <main className={styles.page}>
      {contextHolder}
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>DIGITAL GUIDE</span>
          <h1>数字人设置</h1>
        </div>
        <Tooltip title="恢复默认设置">
          <Button
            className={styles.resetButton}
            type="text"
            icon={<ReloadOutlined />}
            aria-label="恢复默认设置"
            onClick={resetSettings}
          />
        </Tooltip>
      </header>

      <div className={styles.workspace}>
        <section className={styles.preview} aria-label="数字人预览">
          <div className={styles.previewTopline}>
            <span className={styles.previewLabel}>形象预览</span>
            <span className={styles.demoStatus}>DEMO</span>
          </div>

          <div className={styles.figure}>
            <img
              key={activeAppearance.id}
              className={`${styles.previewImage} ${activeAppearance.imageClassName ?? ''}`}
              src={activeAppearance.image}
              alt={activeAppearance.name}
            />
          </div>

          <div className={styles.previewSummary}>
            <div>
              <strong>{activeAppearance.name}</strong>
              <span>{activeAppearance.style}</span>
            </div>
            <dl>
              <div>
                <dt>语音</dt>
                <dd>{activeVoice.label}</dd>
              </div>
              <div>
                <dt>性格</dt>
                <dd>{activePersonality.label}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={styles.settings} aria-label="数字人选项">
          <div className={styles.settingSection}>
            <div className={styles.sectionHeading}>
              <UserOutlined aria-hidden="true" />
              <div>
                <h2>形象选择</h2>
                <span>选择数字人的展示形象</span>
              </div>
            </div>
            <div className={styles.appearanceGrid}>
              {appearanceOptions.map((item) => {
                const selected = item.id === appearance;
                return (
                  <button
                    key={item.id}
                    className={`${styles.appearanceOption} ${selected ? styles.optionSelected : ''}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setAppearance(item.id)}
                  >
                    <span className={styles.appearanceThumb}>
                      <img className={item.imageClassName ?? ''} src={item.image} alt="" />
                    </span>
                    <span className={styles.optionText}>
                      <strong>{item.name}</strong>
                      <span>{item.style}</span>
                    </span>
                    {selected ? <CheckOutlined className={styles.checkIcon} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.settingSection}>
            <div className={styles.sectionHeading}>
              <SoundOutlined aria-hidden="true" />
              <div>
                <h2>语音选择</h2>
                <span>选择讲解时使用的声音</span>
              </div>
            </div>
            <div className={`${styles.choiceGrid} ${styles.voiceGrid}`}>
              {voiceOptions.map((item) => {
                const selected = item.id === voice;
                return (
                  <button
                    key={item.id}
                    className={`${styles.choiceOption} ${selected ? styles.optionSelected : ''}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setVoice(item.id)}
                  >
                    <CustomerServiceOutlined aria-hidden="true" />
                    <span className={styles.optionText}>
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </span>
                    {selected ? <CheckOutlined className={styles.checkIcon} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.settingSection}>
            <div className={styles.sectionHeading}>
              <SmileOutlined aria-hidden="true" />
              <div>
                <h2>性格选择</h2>
                <span>选择数字人的交流风格</span>
              </div>
            </div>
            <div className={styles.choiceGrid}>
              {personalityOptions.map((item) => {
                const selected = item.id === personality;
                return (
                  <button
                    key={item.id}
                    className={`${styles.choiceOption} ${selected ? styles.optionSelected : ''}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPersonality(item.id)}
                  >
                    <SmileOutlined aria-hidden="true" />
                    <span className={styles.optionText}>
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </span>
                    {selected ? <CheckOutlined className={styles.checkIcon} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <footer className={styles.actions}>
            <span>
              当前组合：{activeAppearance.name} · {activeVoice.label} · {activePersonality.label}
            </span>
            <Button type="primary" icon={<CheckOutlined />} onClick={applySettings}>
              应用设置
            </Button>
          </footer>
        </section>
      </div>
    </main>
  );
}
