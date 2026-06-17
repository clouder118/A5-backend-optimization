import { EnvironmentOutlined, MessageOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import Snap from 'lenis/snap';
import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import AvatarGuide from '../../components/guide/AvatarGuide';

type HeroScene = {
  key: string;
  eyebrow: string;
  title: string;
  titleLines?: string[];
  englishText?: string;
  subtitle: string;
  image: string;
  tone: 'jade' | 'amber' | 'water';
  fontSize?: number;
  lineHeight?: number;
  titleX?: number;
  titleY?: number;
  titleWidth?: number;
  titleColor?: string;
  englishFontSize?: number;
  englishX?: number;
  englishY?: number;
  imageScale?: number;
  imageX?: number;
  imageY?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  overlayOpacity?: number;
};

const heroScenes: HeroScene[] = [
  {
    key: 'buddha',
    eyebrow: '',
    title: '灵山胜景',
    titleLines: ['  灵山', '胜     景'],
    englishText: 'Sacred Mountain\n Scenic Spot',
    subtitle: '以数字人导游陪你看见山水、佛韵与游线之间的秩序。',
    image: '/scenic/spots/photos/NH-001_拈花广场/1.jpg',
    fontSize: 110,
    lineHeight: 0.9,
    titleX: 43,
    titleY: 47,
    titleWidth: 58,
    titleColor: '#c7f0d3',
    englishFontSize: 21,
    englishX: 36,
    englishY: 50,
    imageScale: 1,
    imageX: 28,
    imageY: 40,
    brightness: 130,
    contrast: 116,
    saturation: 101,
    overlayOpacity: 0,
    tone: 'jade',
  },
  {
    key: 'palace',
    eyebrow: 'Brahma Palace',
    title: '梵宫典藏',
    subtitle: '用更安静的节奏收起复杂信息，让景点故事在需要时展开。',
    image: '/scenic/spots/photos/NH-003_香月花街/2.jpg',
    tone: 'amber',
  },
  {
    key: 'water',
    eyebrow: 'Nine Dragons Bathing',
    title: '礼宾路线',
    subtitle: '从亲子、长者、摄影到文化游，把路线建议做成从容的抵达。',
    image: '/scenic/spots/photos/NH-004_拈花堂/2.jpg',
    tone: 'water',
  },
];

const marqueeItems = ['灵山胜景', 'Sacred Mountain', '灵山胜景', 'Scenic Spot'];

function getSceneStyle(scene: HeroScene) {
  return {
    '--hero-image-scale': scene.imageScale ?? 1,
    '--hero-image-x': `${scene.imageX ?? 50}%`,
    '--hero-image-y': `${scene.imageY ?? 50}%`,
    '--hero-brightness': `${scene.brightness ?? 72}%`,
    '--hero-contrast': `${scene.contrast ?? 112}%`,
    '--hero-saturation': `${scene.saturation ?? 86}%`,
    '--hero-overlay-opacity': scene.overlayOpacity ?? 0.34,
    '--poster-title-size': `${scene.fontSize ?? 112}px`,
    '--poster-line-height': scene.lineHeight ?? 0.9,
    '--poster-title-x': `${scene.titleX ?? 43}%`,
    '--poster-title-y': `${scene.titleY ?? 47}%`,
    '--poster-title-width': `${scene.titleWidth ?? 58}%`,
    '--poster-title-color': scene.titleColor ?? '#f2f0e9',
    '--poster-english-size': `${scene.englishFontSize ?? 24}px`,
    '--poster-english-x': `${scene.englishX ?? 50}%`,
    '--poster-english-y': `${scene.englishY ?? 52}%`,
  } as CSSProperties;
}

function HeroTitleGroup({ scene }: { scene: HeroScene }) {
  if (scene.titleLines) {
    return (
      <>
        {scene.eyebrow ? <span className="luxury-eyebrow poster-eyebrow">{scene.eyebrow}</span> : null}
        <h1 className="poster-title-group" aria-label={scene.title}>
          {scene.titleLines.map((line) => (
            <span className="poster-title-line" key={line}>
              {line}
            </span>
          ))}
        </h1>
        <div className="poster-title-en">{scene.englishText}</div>
        <p className="poster-title-subtitle">{scene.subtitle}</p>
      </>
    );
  }

  return (
    <>
      <span className="luxury-eyebrow">{scene.eyebrow}</span>
      <h1 className="luxury-hero-title">{scene.title}</h1>
      <p className="luxury-hero-subtitle">{scene.subtitle}</p>
    </>
  );
}

export default function HomePage() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) {
      return undefined;
    }

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      wrapper,
      content,
      infinite: true,
      syncTouch: true,
      lerp: 0.07,
      wheelMultiplier: 0.55,
    });
    const snap = new Snap(lenis, {
      type: 'proximity',
      distanceThreshold: '45%',
      debounce: 120,
      duration: 0.82,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
    });
    snap.addElements(Array.from(wrapper.querySelectorAll<HTMLElement>('.luxury-hero-panel')), {
      align: 'start',
    });

    ScrollTrigger.scrollerProxy(wrapper, {
      scrollTop(value?: number) {
        if (typeof value === 'number') {
          lenis.scrollTo(value, { immediate: true });
        }
        return lenis.scroll;
      },
      getBoundingClientRect() {
        return {
          top: 0,
          left: 0,
          width: wrapper.clientWidth,
          height: wrapper.clientHeight,
        };
      },
      pinType: 'transform',
    });

    const ctx = gsap.context(() => {
      wrapper.querySelectorAll<HTMLElement>('.luxury-hero-panel').forEach((panel) => {
        const copy = panel.querySelector('.luxury-scene-copy');
        const meta = panel.querySelector('.luxury-scene-meta');

        const animatedText = [copy, meta].filter(Boolean);
        if (animatedText.length > 0) {
          gsap.fromTo(
            animatedText,
            { opacity: 0.42, y: 38 },
            {
              opacity: 1,
              y: 0,
              ease: 'power2.out',
              scrollTrigger: {
                scroller: wrapper,
                trigger: panel,
                start: 'top 72%',
                end: 'top 28%',
                scrub: true,
              },
            },
          );
        }
      });
    }, wrapper);

    const update = (time: number) => {
      lenis.raf(time * 1000);
    };
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();

    return () => {
      ctx.revert();
      snap.destroy();
      lenis.destroy();
      gsap.ticker.remove(update);
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      ScrollTrigger.clearScrollMemory();
    };
  }, []);

  return (
    <div className="luxury-home">
      <div className="luxury-scroll-wrapper" ref={wrapperRef}>
        <div className="luxury-scroll-content" ref={contentRef}>
          {heroScenes.map((scene, index) => (
            <section
              className={`luxury-hero-panel tone-${scene.tone}`}
              key={scene.key}
              style={getSceneStyle(scene)}
              data-cue="[ SCENE ]"
            >
              <div className="luxury-scene-backdrop">
                <img className="luxury-scenic-art" src={scene.image} alt="" aria-hidden="true" />
              </div>
              <div className={`luxury-scene-copy ${'titleLines' in scene ? 'is-poster' : ''}`}>
                <HeroTitleGroup scene={scene} />
              </div>
              <div className="luxury-scene-meta">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <i />
                <span>{scene.key.toUpperCase()}</span>
              </div>
            </section>
          ))}
          <section className="luxury-hero-panel tone-jade" aria-hidden="true">
            <div className="luxury-scene-backdrop">
              <img className="luxury-scenic-art" src={heroScenes[0].image} alt="" aria-hidden="true" />
            </div>
          </section>
        </div>
      </div>

      <div className="luxury-fixed-layer">
        <div className="luxury-marquee" aria-hidden="true">
          <div className="luxury-marquee-orbit">
            {Array.from({ length: 12 }).map((_, index) => (
              <span key={index} style={{ '--item-index': index } as CSSProperties}>
                {marqueeItems[index % marqueeItems.length]}
              </span>
            ))}
          </div>
        </div>

        <div className="luxury-avatar-stage">
          <AvatarGuide status="idle" variant="stage" emotionCue="idle" stageMode="home" title="待命中" detail="" />
        </div>

        <div className="video-scroll-hint">[SCROLL DOWN]</div>

        <div className="luxury-quick-links">
          <Link to="/guide">
            <Button type="primary" icon={<MessageOutlined />} data-cue="[ GUIDE ]">
              [ GUIDE ]
            </Button>
          </Link>
          <Link to="/spots">
            <Button icon={<EnvironmentOutlined />} data-cue="[ SPOTS ]">
              [ SPOTS ]
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
