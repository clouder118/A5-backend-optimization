import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './HydraRouteLoader.module.css';

const maxCharacters = 24;
const spinnerFrames = ['/', '-', '\\', '|'];
const progressIntervalMs = 58;
const spinnerIntervalMs = 96;
const successHoldMs = 760;
const exitMs = 460;

type LoaderStage = 'booting' | 'success' | 'exiting';

interface HydraRouteLoaderProps {
  onComplete: () => void;
}

export default function HydraRouteLoader({ onComplete }: HydraRouteLoaderProps) {
  const [loadedCharacters, setLoadedCharacters] = useState(0);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [stage, setStage] = useState<LoaderStage>('booting');

  useEffect(() => {
    const timers = new Set<number>();
    let progressInterval: number | undefined;
    let spinnerInterval: number | undefined;

    const schedule = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
      return timer;
    };

    spinnerInterval = window.setInterval(() => {
      setSpinnerFrame((current) => current + 1);
    }, spinnerIntervalMs);

    progressInterval = window.setInterval(() => {
      setLoadedCharacters((current) => {
        const next = Math.min(current + 1, maxCharacters);
        if (next === maxCharacters) {
          if (progressInterval !== undefined) {
            window.clearInterval(progressInterval);
            progressInterval = undefined;
          }
          if (spinnerInterval !== undefined) {
            window.clearInterval(spinnerInterval);
            spinnerInterval = undefined;
          }
          schedule(() => setStage('success'), progressIntervalMs);
          schedule(() => setStage('exiting'), progressIntervalMs + successHoldMs);
          schedule(onComplete, progressIntervalMs + successHoldMs + exitMs);
        }
        return next;
      });
    }, progressIntervalMs);

    return () => {
      if (progressInterval !== undefined) window.clearInterval(progressInterval);
      if (spinnerInterval !== undefined) window.clearInterval(spinnerInterval);
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, [onComplete]);

  const loadingBar = useMemo(() => {
    const loaded = '#'.repeat(loadedCharacters);
    const unloaded = '.'.repeat(maxCharacters - loadedCharacters);
    return { loaded, unloaded };
  }, [loadedCharacters]);
  const loadingPercent = Math.floor((loadedCharacters / maxCharacters) * 100);
  const spinner = `[${spinnerFrames[spinnerFrame % spinnerFrames.length]}]`;
  const isBooting = stage === 'booting';

  const loader = (
    <div
      className={[styles.overlay, stage === 'exiting' ? styles.overlayExiting : '']
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
      aria-label="HYDRA route loading"
      data-testid="route-hydra-loader"
    >
      <HydraTerminal
        ariaHidden={false}
        className={styles.terminal}
        isBooting={isBooting}
        loadingBar={loadingBar}
        loadingPercent={loadingPercent}
        spinner={spinner}
      />
      <HydraTerminal
        ariaHidden
        className={`${styles.terminal} ${styles.glitchClone} ${styles.glitchBottom}`}
        isBooting={isBooting}
        loadingBar={loadingBar}
        loadingPercent={loadingPercent}
        spinner={spinner}
      />
      <HydraTerminal
        ariaHidden
        className={`${styles.terminal} ${styles.glitchClone} ${styles.glitchTop}`}
        isBooting={isBooting}
        loadingBar={loadingBar}
        loadingPercent={loadingPercent}
        spinner={spinner}
      />
    </div>
  );

  return createPortal(loader, document.body);
}

interface HydraTerminalProps {
  ariaHidden: boolean;
  className: string;
  isBooting: boolean;
  loadingBar: {
    loaded: string;
    unloaded: string;
  };
  loadingPercent: number;
  spinner: string;
}

function HydraTerminal({
  ariaHidden,
  className,
  isBooting,
  loadingBar,
  loadingPercent,
  spinner,
}: HydraTerminalProps) {
  return (
    <div
      className={[className, isBooting ? styles.glitch : ''].filter(Boolean).join(' ')}
      aria-hidden={ariaHidden}
    >
      <div className={styles.scanline} />
      {isBooting ? <p className={styles.spinner}>{spinner}</p> : null}
      <div className={[styles.hydra, isBooting ? '' : styles.hydraSuccess].filter(Boolean).join(' ')}>
        {isBooting ? (
          <div>
            <p>&lt; SYSTEM REBOOTING &gt;</p>
            <p className={styles.textSmall}>HYDRA VER 2.1 SYS RECOVERY</p>
            <p className={styles.textSmall}>
              PROCESS: <span>{loadingPercent}</span>%
            </p>
            <p className={styles.loadingBar} aria-label={`Process ${loadingPercent}%`}>
              ({loadingBar.loaded}
              <span className={styles.loadingBarUnloaded}>{loadingBar.unloaded}</span>)
            </p>
          </div>
        ) : (
          <div>
            <p>REBOOTING SUCCESSFUL</p>
          </div>
        )}
      </div>
    </div>
  );
}
