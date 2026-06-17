import { EnvironmentOutlined, MessageOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import Snap from 'lenis/snap';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import AvatarGuide from '../../components/guide/AvatarGuide';

const heroScenes = [
  {
    key: 'buddha',
    eyebrow: 'Ling Shan Grand Buddha',
    title: '灵山胜境导览',
    subtitle: '以数字人导游陪你看见山水、佛韵与游线之间的秩序。',
    image: '/scenic/spots/photos/NH-001_拈花广场/2.jpg',
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
] as const;

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
      lerp: 0.08,
      wheelMultiplier: 0.9,
    });
    const snap = new Snap(lenis, {
      type: 'mandatory',
      debounce: 420,
      duration: 0.9,
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
      const marquee = document.querySelector('.luxury-marquee-track');
      if (marquee) {
        gsap.fromTo(
          marquee,
          { xPercent: 0 },
          {
            xPercent: -50,
            duration: 18,
            ease: 'none',
            repeat: -1,
          },
        );
      }

      wrapper.querySelectorAll<HTMLElement>('.luxury-hero-panel').forEach((panel) => {
        const art = panel.querySelector('.luxury-scenic-art');
        const copy = panel.querySelector('.luxury-scene-copy');
        const meta = panel.querySelector('.luxury-scene-meta');

        if (art) {
          gsap.fromTo(
            art,
            { yPercent: -18, scale: 1.12 },
            {
              yPercent: 18,
              scale: 1,
              ease: 'none',
              scrollTrigger: {
                scroller: wrapper,
                trigger: panel,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
                fastScrollEnd: true,
              },
            },
          );
        }

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

  useEffect(() => {
    const home = wrapperRef.current?.closest<HTMLElement>('.luxury-home');
    if (!home) {
      return undefined;
    }

    let animationFrame = 0;
    const updateHintPosition = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') {
        return;
      }
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        home.style.setProperty('--scroll-hint-x', `${event.clientX}px`);
        home.style.setProperty('--scroll-hint-y', `${event.clientY}px`);
        home.classList.add('has-pointer-hint');
      });
    };

    window.addEventListener('pointermove', updateHintPosition, { passive: true });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('pointermove', updateHintPosition);
    };
  }, []);

  return (
    <div className="luxury-home">
      <div className="luxury-scroll-wrapper" ref={wrapperRef}>
        <div className="luxury-scroll-content" ref={contentRef}>
          {heroScenes.map((scene, index) => (
            <section className={`luxury-hero-panel tone-${scene.tone}`} key={scene.key} data-cue="[ SCENE ]">
              <div className="luxury-scene-backdrop">
                <img className="luxury-scenic-art" src={scene.image} alt="" aria-hidden="true" />
              </div>
              <div className="luxury-scene-copy">
                <span className="luxury-eyebrow">{scene.eyebrow}</span>
                <Typography.Title className="luxury-hero-title">{scene.title}</Typography.Title>
                <Typography.Paragraph className="luxury-hero-subtitle">{scene.subtitle}</Typography.Paragraph>
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
          <div className="luxury-marquee-track">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index}>灵山胜境导览</span>
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
