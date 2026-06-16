import type { AvatarAudioState } from '../components/guide/AvatarGuide';
import type { GuideEmotionCue } from '../config/live2dGuide';
import type { GuideStatus } from '../types/scenic';
import { loadCubismCore } from './minimalCubismRenderer';

type CubismModules = {
  CubismFramework: typeof import('../vendor/live2d/src/live2dcubismframework').CubismFramework;
  LogLevel: typeof import('../vendor/live2d/src/live2dcubismframework').LogLevel;
  Option: typeof import('../vendor/live2d/src/live2dcubismframework').Option;
  CubismMatrix44: typeof import('../vendor/live2d/src/math/cubismmatrix44').CubismMatrix44;
  CubismModelMatrix: typeof import('../vendor/live2d/src/math/cubismmodelmatrix').CubismModelMatrix;
  CubismMoc: typeof import('../vendor/live2d/src/model/cubismmoc').CubismMoc;
  CubismRenderer_WebGL: typeof import('../vendor/live2d/src/rendering/cubismrenderer_webgl').CubismRenderer_WebGL;
  CubismPose: typeof import('../vendor/live2d/src/effect/cubismpose').CubismPose;
  CubismPhysics: typeof import('../vendor/live2d/src/physics/cubismphysics').CubismPhysics;
};

type ModelSettings = {
  FileReferences: {
    Moc: string;
    Textures: string[];
    Pose?: string;
    Physics?: string;
    Expressions?: Array<{ Name: string; File: string }>;
    Motions?: Record<string, Array<{ File: string }>>;
  };
  Groups?: Array<{ Target: string; Name: string; Ids: string[] }>;
};

type MotionCurve = {
  Target: string;
  Id: string;
  Segments: number[];
};

type MotionData = {
  Meta: { Duration: number; Loop?: boolean };
  Curves: MotionCurve[];
};

type ExpressionData = {
  Parameters?: Array<{
    Id: string;
    Value: number;
    Blend?: 'Add' | 'Multiply' | 'Overwrite';
  }>;
};

type RendererOptions = {
  canvas: HTMLCanvasElement;
  modelUrl: string;
  coreScriptUrl: string;
};

type ActiveExpression = {
  name: string;
  startedAt: number;
  durationMs: number;
  priority: number;
  boost: number;
};

let frameworkStarted = false;
let frameworkModulesPromise: Promise<CubismModules> | undefined;

export class OfficialCubismRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly modelUrl: string;
  private readonly coreScriptUrl: string;
  private modules?: CubismModules;
  private gl?: WebGLRenderingContext;
  private renderer?: InstanceType<CubismModules['CubismRenderer_WebGL']>;
  private model?: any;
  private moc?: any;
  private pose?: any;
  private physics?: any;
  private textures: WebGLTexture[] = [];
  private lipSyncIds: string[] = ['ParamMouthOpenY', 'ParamA'];
  private eyeBlinkIds: string[] = ['ParamEyeLOpen', 'ParamEyeROpen'];
  private motions = new Map<string, MotionData[]>();
  private expressions = new Map<string, ExpressionData>();
  private expressionParameterIds = new Set<string>();
  private sleepParameterIds = new Set<string>();
  private frameId = 0;
  private startedAt = performance.now();
  private motionStartedAt = performance.now();
  private motionFadeDurationMs = 520;
  private currentMotionName = '';
  private currentMotionIndex = 0;
  private temporaryMotionName = '';
  private temporaryMotionIndex = 0;
  private temporaryMotionUntil = 0;
  private motionGroupIndexes = new Map<string, number>();
  private activeExpressions: ActiveExpression[] = [];
  private lastEmotionCue: GuideEmotionCue | undefined;
  private pointerX = 0;
  private pointerY = 0;
  private blinkStartedAt = 0;
  private nextBlinkAt = performance.now() + 1800;
  private tapStartedAt = 0;
  private lastFrameAt = performance.now();
  private lastCanvasCssWidth = 0;
  private lastCanvasCssHeight = 0;
  private lastCanvasDpr = 0;
  private status: GuideStatus = 'idle';
  private audioState: AvatarAudioState = 'idle';
  private destroyed = false;

  constructor(options: RendererOptions) {
    this.canvas = options.canvas;
    this.modelUrl = options.modelUrl;
    this.coreScriptUrl = options.coreScriptUrl;
  }

  async initialize() {
    this.modules = await loadFrameworkModules(this.coreScriptUrl);
    startFramework(this.modules);

    const settingsText = await fetchText(this.modelUrl);
    const settings = JSON.parse(settingsText) as ModelSettings;
    const baseUrl = new URL('.', new URL(this.modelUrl, window.location.href)).toString();
    const mocBytes = await fetchArrayBuffer(new URL(settings.FileReferences.Moc, baseUrl).toString());
    const moc = this.modules.CubismMoc.create(mocBytes, false);
    if (!moc) {
      throw new Error('Cubism Framework could not create Moc data.');
    }
    const model = moc.createModel();
    if (!model) {
      this.modules.CubismMoc.delete(moc);
      throw new Error('Cubism Framework could not create model.');
    }

    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) {
      throw new Error('This browser does not provide WebGL for Live2D.');
    }

    this.gl = gl;
    this.moc = moc;
    this.model = model;
    this.renderer = new this.modules.CubismRenderer_WebGL();
    this.renderer.initialize(model);
    this.renderer.startUp(gl);
    this.renderer.setIsPremultipliedAlpha(true);
    this.registerLipSyncIds(settings);
    await this.loadMotions(settings, baseUrl);
    await this.loadExpressions(settings, baseUrl);
    await this.loadTextures(settings, baseUrl);
    await this.loadPhysics(settings, baseUrl);
    await this.loadPose(settings, baseUrl);
    this.resize();
    window.addEventListener('resize', this.resize);
    this.loop();
  }

  setGuideState(status: GuideStatus, audioState: AvatarAudioState) {
    this.status = status;
    this.audioState = audioState;
    if (status !== 'idle' || audioState === 'playing') {
      this.wakeFromSleep();
    }
  }

  setPointerTarget(x: number, y: number) {
    this.pointerX = Math.max(-1, Math.min(1, x));
    this.pointerY = Math.max(-1, Math.min(1, y));
  }

  setEmotionCue(cue: GuideEmotionCue | undefined) {
    if (!cue) return;
    if (cue === this.lastEmotionCue && cue !== 'tap') return;
    this.lastEmotionCue = cue;

    if (cue !== 'sleep') {
      this.wakeFromSleep();
    }

    if (cue === 'idle') {
      return;
    }

    if (cue === 'thinking') {
      return;
    }
    if (cue === 'speaking') {
      return;
    }
    if (cue === 'success') {
      this.playTemporaryMotion('Success');
      return;
    }
    if (cue === 'fallback') {
      this.playTemporaryMotion('Fallback');
      return;
    }
    if (cue === 'tap') {
      this.tapStartedAt = performance.now();
      this.playTemporaryMotion('Tap');
      return;
    }
    if (cue === 'sleep') {
      this.playTemporaryMotion('Sleep', Number.POSITIVE_INFINITY);
      return;
    }
    if (cue === 'wake') {
      this.playTemporaryMotion('Success');
    }
  }

  triggerExpression(
    name: string,
    durationMs = 1800,
    priority = 1,
    options: { boost?: number } = {},
  ) {
    if (!this.expressions.has(name)) return;
    const now = performance.now();
    this.activeExpressions = this.activeExpressions.filter((item) => {
      const stillActive = now - item.startedAt <= item.durationMs;
      if (!stillActive) return false;
      return item.priority > priority && item.name !== name;
    });
    this.activeExpressions.push({
      name,
      startedAt: now,
      durationMs,
      priority,
      boost: options.boost ?? 1,
    });
  }

  previewMotion(groupName: string, index = 0, durationMs?: number) {
    const motions = this.motions.get(groupName);
    if (!motions?.length) return false;
    if (groupName !== 'Sleep') {
      this.wakeFromSleep();
    }
    const boundedIndex = Math.max(0, Math.min(motions.length - 1, index));
    const motion = motions[boundedIndex];
    const now = performance.now();
    this.temporaryMotionName = groupName;
    this.temporaryMotionIndex = boundedIndex;
    this.temporaryMotionUntil = now + (durationMs ?? Math.max(1200, motion.Meta.Duration * 1000));
    this.currentMotionName = '';
    this.motionStartedAt = now;
    this.motionFadeDurationMs = transitionDurationForMotion(groupName);
    return true;
  }

  getMotionGroupSize(groupName: string) {
    return this.motions.get(groupName)?.length ?? 0;
  }

  private playTemporaryMotion(groupName: string, durationOverrideMs?: number) {
    const motions = this.motions.get(groupName);
    if (!motions?.length) return;
    const index = this.nextMotionIndex(groupName);
    const motion = motions[index];
    const now = performance.now();
    this.temporaryMotionName = groupName;
    this.temporaryMotionIndex = index;
    this.temporaryMotionUntil =
      durationOverrideMs === Number.POSITIVE_INFINITY
        ? Number.POSITIVE_INFINITY
        : now + (durationOverrideMs ?? Math.max(900, motion.Meta.Duration * 1000));
    this.currentMotionName = '';
    this.motionStartedAt = now;
    this.motionFadeDurationMs = transitionDurationForMotion(groupName);
  }

  destroy() {
    this.destroyed = true;
    window.removeEventListener('resize', this.resize);
    if (this.frameId) cancelAnimationFrame(this.frameId);
    const gl = this.gl;
    if (gl) {
      this.textures.forEach((texture) => gl.deleteTexture(texture));
    }
    if (this.moc && this.model) {
      this.moc.deleteModel(this.model);
    }
    if (this.pose) {
      this.modules?.CubismPose.delete(this.pose);
    }
    if (this.physics) {
      this.modules?.CubismPhysics.delete(this.physics);
    }
    if (this.moc) {
      this.modules?.CubismMoc.delete(this.moc);
    }
  }

  private registerLipSyncIds(settings: ModelSettings) {
    const group = settings.Groups?.find((item) => item.Target === 'Parameter' && item.Name === 'LipSync');
    if (group?.Ids.length) {
      this.lipSyncIds = group.Ids;
    }
    const eyeGroup = settings.Groups?.find((item) => item.Target === 'Parameter' && item.Name === 'EyeBlink');
    if (eyeGroup?.Ids.length) {
      this.eyeBlinkIds = eyeGroup.Ids;
    }
  }

  private async loadTextures(settings: ModelSettings, baseUrl: string) {
    const gl = this.ensureGl();
    const textures: WebGLTexture[] = [];
    const textureFiles = settings.FileReferences.Textures ?? [];
    for (let index = 0; index < textureFiles.length; index += 1) {
      const image = await loadImage(new URL(textureFiles[index], baseUrl).toString());
      const texture = gl.createTexture();
      if (!texture) throw new Error('WebGL texture creation failed.');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.renderer?.bindTexture(index, texture);
      textures.push(texture);
    }
    this.textures = textures;
  }

  private async loadMotions(settings: ModelSettings, baseUrl: string) {
    const motionGroups = settings.FileReferences.Motions ?? {};
    const entries = await Promise.all(
      Object.entries(motionGroups).map(async ([groupName, files]) => {
        const motions = await Promise.all(
          files.map((item) => fetchJson<MotionData>(new URL(item.File, baseUrl).toString())),
        );
        return [groupName, motions] as const;
      }),
    );
    this.motions = new Map(entries);
    this.sleepParameterIds = collectParameterIds(this.motions.get('Sleep') ?? []);
  }

  private async loadExpressions(settings: ModelSettings, baseUrl: string) {
    const entries = await Promise.all(
      (settings.FileReferences.Expressions ?? []).map(async (item) => {
        const expression = await fetchJson<ExpressionData>(new URL(item.File, baseUrl).toString());
        return [item.Name, expression] as const;
      }),
    );
    this.expressions = new Map(entries);
    this.expressionParameterIds = collectExpressionParameterIds(this.expressions);
  }

  private async loadPhysics(settings: ModelSettings, baseUrl: string) {
    const physicsFile = settings.FileReferences.Physics;
    if (!physicsFile || !this.modules) return;
    const physicsBytes = await fetchArrayBuffer(new URL(physicsFile, baseUrl).toString());
    this.physics = this.modules.CubismPhysics.create(physicsBytes, physicsBytes.byteLength);
  }

  private async loadPose(settings: ModelSettings, baseUrl: string) {
    const poseFile = settings.FileReferences.Pose;
    if (!poseFile || !this.modules) return;
    const poseBytes = await fetchArrayBuffer(new URL(poseFile, baseUrl).toString());
    this.pose = this.modules.CubismPose.create(poseBytes, poseBytes.byteLength);
  }

  private readonly resize = () => {
    const gl = this.gl;
    const parentRect = this.canvas.parentElement?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    const width = Math.max(parentRect.width, canvasRect.width);
    const height = Math.max(parentRect.height, canvasRect.height);
    if (!gl || width <= 0 || height <= 0) return;
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2);
    if (
      Math.abs(width - this.lastCanvasCssWidth) < 1 &&
      Math.abs(height - this.lastCanvasCssHeight) < 1 &&
      Math.abs(dpr - this.lastCanvasDpr) < 0.01
    ) {
      return;
    }
    this.lastCanvasCssWidth = width;
    this.lastCanvasCssHeight = height;
    this.lastCanvasDpr = dpr;
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  };

  private loop = () => {
    if (this.destroyed) return;
    this.updateParameters(performance.now());
    this.draw();
    this.frameId = requestAnimationFrame(this.loop);
  };

  private updateParameters(now: number) {
    const model = this.model;
    if (!model) return;
    const deltaSeconds = Math.max(0, Math.min(0.033, (now - this.lastFrameAt) / 1000));
    this.lastFrameAt = now;

    const motion = this.resolveMotion(now);
    if (motion) {
      const elapsed = (now - this.motionStartedAt) / 1000;
      const time = motion.Meta.Loop === false ? Math.min(elapsed, motion.Meta.Duration) : elapsed % motion.Meta.Duration;
      const motionWeight = this.motionWeight(now);
      for (const curve of motion.Curves) {
        if (curve.Target === 'Parameter') {
          this.setParameter(curve.Id, evaluateCurve(curve, time), motionWeight);
        }
      }
    }
    this.resetSleepParameters();
    this.applyStateParameters(now);
    this.applySleepParameters();
    this.applyBlink(now);
    this.resetExpressionParameters();
    this.applyExpression(now);
    this.physics?.evaluate(model, deltaSeconds);
    this.pose?.updateParameters(model, deltaSeconds);
    model.update();
  }

  private resolveMotion(now: number): MotionData | undefined {
    let requestedName = this.motionNameForState(now);
    if (this.shouldHoldCurrentMotion(requestedName, now)) {
      requestedName = this.currentMotionName;
    }
    const requestedMotions = this.motions.get(requestedName) ?? this.motions.get('Idle');
    if (!requestedMotions?.length) return undefined;

    if (requestedName !== this.currentMotionName) {
      this.currentMotionName = requestedName;
      this.currentMotionIndex =
        this.temporaryMotionName === requestedName
          ? this.temporaryMotionIndex
          : this.nextMotionIndex(requestedName);
      this.motionStartedAt = now;
      this.motionFadeDurationMs = transitionDurationForMotion(requestedName);
    }

    let motion = requestedMotions[this.currentMotionIndex] ?? requestedMotions[0];
    const elapsedMs = now - this.motionStartedAt;
    const isTemporary = this.temporaryMotionName === requestedName && now < this.temporaryMotionUntil;
    if (
      !isTemporary &&
      requestedName !== 'Sleep' &&
      motion.Meta.Duration > 0 &&
      elapsedMs >= motion.Meta.Duration * 1000
    ) {
      this.currentMotionIndex = this.nextMotionIndex(requestedName);
      this.motionStartedAt = now;
      this.motionFadeDurationMs = transitionDurationForMotion(requestedName);
      motion = requestedMotions[this.currentMotionIndex] ?? requestedMotions[0];
    }
    return motion;
  }

  private shouldHoldCurrentMotion(requestedName: string, now: number) {
    if (!this.currentMotionName || this.currentMotionName === requestedName) return false;
    if (this.temporaryMotionName && now < this.temporaryMotionUntil) return false;
    const elapsedMs = now - this.motionStartedAt;
    if (this.currentMotionName === 'Thinking' && requestedName === 'Speaking') {
      return elapsedMs < 2200;
    }
    if (this.currentMotionName === 'Speaking' && requestedName === 'Idle') {
      return elapsedMs < 2600;
    }
    return false;
  }

  private motionWeight(now: number) {
    if (this.currentMotionName === 'Sleep') return 0.9;
    const progress = Math.max(0, Math.min(1, (now - this.motionStartedAt) / this.motionFadeDurationMs));
    const eased = 1 - Math.pow(1 - progress, 3);
    return 0.18 + eased * 0.58;
  }

  private motionNameForState(now: number) {
    if (this.temporaryMotionName && now < this.temporaryMotionUntil) {
      return this.temporaryMotionName;
    }
    if (this.temporaryMotionName && now >= this.temporaryMotionUntil) {
      this.temporaryMotionName = '';
      this.temporaryMotionUntil = 0;
    }
    if (this.status === 'thinking') return 'Thinking';
    if (this.audioState === 'playing') return 'Speaking';
    return 'Idle';
  }

  private nextMotionIndex(groupName: string) {
    const motions = this.motions.get(groupName);
    if (!motions?.length) return 0;
    const nextIndex = ((this.motionGroupIndexes.get(groupName) ?? -1) + 1) % motions.length;
    this.motionGroupIndexes.set(groupName, nextIndex);
    return nextIndex;
  }

  private applyStateParameters(now: number) {
    if (this.currentMotionName === 'Sleep') return;
    const seconds = (now - this.startedAt) / 1000;
    const idleSway = Math.sin(seconds * 0.86);
    const slowSway = Math.sin(seconds * 0.62);
    let angleX = this.pointerX * 2.8 + slowSway * 0.38;
    let angleY = -this.pointerY * 2.4 + Math.sin(seconds * 0.72) * 0.28;
    let angleZ = idleSway * 0.2;
    let bodyY = slowSway * 0.24;
    let bodyZ = idleSway * 0.2;

    if (this.status === 'thinking') {
      angleX += Math.sin(seconds * 0.82) * 0.55;
      angleY -= 0.35;
      angleZ += Math.sin(seconds * 0.72) * 0.28;
      this.setParameter('ParamMouthForm', 0.12, 0.06);
      this.setParameter('ParamEyeBallY', -0.16, 0.08);
    }

    const isTalking = this.audioState === 'playing';
    if (isTalking) {
      angleY += Math.sin(seconds * 2.4) * 0.38;
      angleZ += Math.sin(seconds * 2.1) * 0.24;
      bodyZ += Math.sin(seconds * 2.2) * 0.32;
    }

    if (this.status === 'idle' && this.audioState === 'idle') {
      angleX += Math.sin(seconds * 0.42) * 0.35;
      angleY += Math.sin(seconds * 0.55) * 0.22;
      bodyZ += Math.sin(seconds * 0.82) * 0.22;
    }

    const tapElapsed = now - this.tapStartedAt;
    if (tapElapsed >= 0 && tapElapsed < 980) {
      const progress = tapElapsed / 980;
      const bounce = Math.sin(progress * Math.PI);
      angleZ += bounce * 2.4;
      bodyY += bounce * 1.8;
    }

    this.setParameter('ParamAngleX', angleX, 0.035);
    this.setParameter('ParamAngleY', angleY, 0.035);
    this.setParameter('ParamAngleZ', angleZ, 0.03);
    this.setParameter('ParamBodyAngleY', bodyY, 0.03);
    this.setParameter('ParamBodyAngleZ', bodyZ, 0.03);
    this.setParameter('ParamEyeBallX', this.pointerX * 0.8, 0.12);
    this.setParameter('ParamEyeBallY', -this.pointerY * 0.55, 0.12);
    this.setParameter('ParamBreath', 0.5 + Math.sin(seconds * 1.2) * 0.18, 0.08);
    for (const id of this.eyeBlinkIds) {
      this.setParameter(id, 1, 0.8);
    }
    const amplitude = this.audioState === 'playing' ? 0.74 : 0.38;
    const mouthWave = Math.abs(Math.sin(seconds * 10.2)) * 0.72 + Math.abs(Math.sin(seconds * 6.4)) * 0.28;
    const mouthValue = isTalking ? 0.18 + mouthWave * amplitude : 0;
    for (const id of this.lipSyncIds) {
      this.setParameter(id, mouthValue, isTalking ? 0.66 : 0.16);
    }
    if (isTalking) {
      this.setParameter('ParamMouthForm', 0.55, 0.12);
      this.setParameter('ParamEyeLSmile', 0.12, 0.06);
      this.setParameter('ParamEyeRSmile', 0.12, 0.06);
    }
  }

  private applyBlink(now: number) {
    if (this.currentMotionName === 'Sleep') return;
    if (!this.blinkStartedAt && now >= this.nextBlinkAt) {
      this.blinkStartedAt = now;
      this.nextBlinkAt = now + 2600 + Math.random() * 3600;
    }
    if (!this.blinkStartedAt) return;

    const elapsed = now - this.blinkStartedAt;
    const duration = 170;
    if (elapsed >= duration) {
      this.blinkStartedAt = 0;
      return;
    }
    const half = duration / 2;
    const openness = elapsed < half ? 1 - elapsed / half : (elapsed - half) / half;
    for (const id of this.eyeBlinkIds) {
      this.setParameter(id, openness, 0.92);
    }
  }

  private applySleepParameters() {
    if (this.currentMotionName !== 'Sleep') return;
    for (const id of this.eyeBlinkIds) {
      this.setParameter(id, 0.02, 0.95);
    }
    for (const id of this.lipSyncIds) {
      this.setParameter(id, 0, 0.9);
    }
    this.setParameter('ParamEyeLSmile', 0.15, 0.35);
    this.setParameter('ParamEyeRSmile', 0.15, 0.35);
    this.setParameter('ParamMouthForm', 0.12, 0.25);
  }

  private applyExpression(now: number) {
    this.activeExpressions = this.activeExpressions.filter((item) => now - item.startedAt <= item.durationMs);
    if (!this.activeExpressions.length) return;

    const activeExpressions = [...this.activeExpressions].sort((left, right) => left.priority - right.priority);
    for (const active of activeExpressions) {
      const expression = this.expressions.get(active.name);
      if (!expression) continue;

      const elapsed = now - active.startedAt;
      const fadeIn = Math.min(1, elapsed / 220);
      const fadeOut = Math.min(1, (active.durationMs - elapsed) / 320);
      const weight = Math.max(0, Math.min(fadeIn, fadeOut));

      for (const parameter of expression.Parameters ?? []) {
        const value = parameter.Value * active.boost;
        if (parameter.Blend === 'Multiply') {
          this.multiplyParameter(parameter.Id, value, weight);
        } else {
          this.setParameter(parameter.Id, value, Math.min(1, weight));
        }
      }
    }
  }

  private wakeFromSleep() {
    if (this.temporaryMotionName === 'Sleep') {
      this.temporaryMotionName = '';
      this.temporaryMotionUntil = 0;
      this.motionStartedAt = performance.now();
    }
    for (const id of this.eyeBlinkIds) {
      this.setParameter(id, 1, 1);
    }
  }

  private resetExpressionParameters() {
    for (const id of this.expressionParameterIds) {
      this.setParameter(id, 0, 0.72);
    }
  }

  private resetSleepParameters() {
    if (this.currentMotionName === 'Sleep') return;
    for (const id of this.sleepParameterIds) {
      if (id === 'ParamEyeLOpen' || id === 'ParamEyeROpen') {
        this.setParameter(id, 1, 0.95);
        continue;
      }
      if (
        id.startsWith('shuijiao') ||
        id === 'Param248' ||
        id === 'Param205' ||
        id === 'ParamMouthOpenY' ||
        id === 'ParamMouthForm'
      ) {
        this.setParameter(id, 0, 0.85);
      }
    }
  }

  private setParameter(id: string, value: number, weight: number) {
    const model = this.model;
    const modules = this.modules;
    if (!model || !modules) return;
    const handle = modules.CubismFramework.getIdManager().getId(id);
    model.setParameterValueById(handle, value, weight);
  }

  private multiplyParameter(id: string, value: number, weight: number) {
    const model = this.model;
    const modules = this.modules;
    if (!model || !modules) return;
    const handle = modules.CubismFramework.getIdManager().getId(id);
    model.multiplyParameterValueById(handle, value, weight);
  }

  private draw() {
    const gl = this.ensureGl();
    const model = this.model;
    const renderer = this.renderer;
    if (!model || !renderer) return;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.setMvpMatrix(this.createMvpMatrix(model));
    renderer.setRenderState(null as unknown as WebGLFramebuffer, [0, 0, this.canvas.width, this.canvas.height]);
    renderer.drawModel();
  }

  private createMvpMatrix(model: any) {
    const modules = this.modules;
    if (!modules) throw new Error('Cubism Framework modules are not initialized.');
    const modelMatrix = new modules.CubismModelMatrix(model.getCanvasWidth(), model.getCanvasHeight());
    modelMatrix.setHeight(2.0);
    modelMatrix.setCenterPosition(0, 0);

    const projection = new modules.CubismMatrix44();
    projection.loadIdentity();
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    if (aspect > 1) {
      projection.scale(1 / aspect, 1);
    } else {
      projection.scale(1, aspect);
    }
    projection.multiplyByMatrix(modelMatrix);
    return projection;
  }

  private ensureGl() {
    if (!this.gl) throw new Error('WebGL is not initialized.');
    return this.gl;
  }
}

async function loadFrameworkModules(coreScriptUrl: string): Promise<CubismModules> {
  await loadCubismCore(coreScriptUrl);
  if (!frameworkModulesPromise) {
    frameworkModulesPromise = Promise.all([
      import('../vendor/live2d/src/live2dcubismframework'),
      import('../vendor/live2d/src/math/cubismmatrix44'),
      import('../vendor/live2d/src/math/cubismmodelmatrix'),
      import('../vendor/live2d/src/model/cubismmoc'),
      import('../vendor/live2d/src/rendering/cubismrenderer_webgl'),
      import('../vendor/live2d/src/effect/cubismpose'),
      import('../vendor/live2d/src/physics/cubismphysics'),
    ]).then(
      ([
        frameworkModule,
        matrixModule,
        modelMatrixModule,
        mocModule,
        rendererModule,
        poseModule,
        physicsModule,
      ]) => ({
        CubismFramework: frameworkModule.CubismFramework,
        LogLevel: frameworkModule.LogLevel,
        Option: frameworkModule.Option,
        CubismMatrix44: matrixModule.CubismMatrix44,
        CubismModelMatrix: modelMatrixModule.CubismModelMatrix,
        CubismMoc: mocModule.CubismMoc,
        CubismRenderer_WebGL: rendererModule.CubismRenderer_WebGL,
        CubismPose: poseModule.CubismPose,
        CubismPhysics: physicsModule.CubismPhysics,
      }),
    );
  }
  return frameworkModulesPromise;
}

function startFramework(modules: CubismModules) {
  if (frameworkStarted) return;
  const option = new modules.Option();
  option.loggingLevel = modules.LogLevel.LogLevel_Off;
  option.logFunction = () => undefined;
  modules.CubismFramework.startUp(option);
  modules.CubismFramework.initialize();
  frameworkStarted = true;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json() as Promise<T>;
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.text();
}

async function fetchArrayBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.arrayBuffer();
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load texture ${url}`));
    image.src = url;
  });
}

function collectParameterIds(motions: MotionData[]) {
  const ids = new Set<string>();
  for (const motion of motions) {
    for (const curve of motion.Curves) {
      if (curve.Target === 'Parameter') {
        ids.add(curve.Id);
      }
    }
  }
  return ids;
}

function collectExpressionParameterIds(expressions: Map<string, ExpressionData>) {
  const ids = new Set<string>();
  for (const expression of expressions.values()) {
    for (const parameter of expression.Parameters ?? []) {
      ids.add(parameter.Id);
    }
  }
  return ids;
}

function transitionDurationForMotion(groupName: string) {
  if (groupName === 'Thinking') return 720;
  if (groupName === 'Speaking') return 640;
  if (groupName === 'Sleep') return 900;
  if (groupName === 'Success' || groupName === 'Tap') return 460;
  if (groupName === 'Fallback') return 780;
  return 560;
}

function evaluateCurve(curve: MotionCurve, time: number) {
  const segments = curve.Segments;
  if (segments.length < 2) return 0;
  let currentTime = segments[0];
  let currentValue = segments[1];
  let index = 2;
  while (index < segments.length) {
    const type = segments[index++];
    if (type === 0) {
      const endTime = segments[index++];
      const endValue = segments[index++];
      if (time <= endTime) return lerp(currentValue, endValue, normalized(time, currentTime, endTime));
      currentTime = endTime;
      currentValue = endValue;
      continue;
    }
    if (type === 1) {
      index += 2;
      const c2Value = segments[index + 1];
      index += 2;
      const endTime = segments[index++];
      const endValue = segments[index++];
      if (time <= endTime) {
        return cubicBezier(currentValue, c2Value, c2Value, endValue, normalized(time, currentTime, endTime));
      }
      currentTime = endTime;
      currentValue = endValue;
      continue;
    }
    const endTime = segments[index++];
    const endValue = segments[index++];
    if (time <= endTime) return type === 2 ? currentValue : endValue;
    currentTime = endTime;
    currentValue = endValue;
  }
  return currentValue;
}

function normalized(value: number, min: number, max: number) {
  if (max <= min) return 1;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number) {
  const inv = 1 - t;
  return inv * inv * inv * p0 + 3 * inv * inv * t * p1 + 3 * inv * t * t * p2 + t * t * t * p3;
}
