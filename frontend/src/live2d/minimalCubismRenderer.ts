import type { AvatarAudioState } from '../components/guide/AvatarGuide';
import type { GuideStatus } from '../types/scenic';

type CubismCoreGlobal = {
  Memory?: { initializeAmountOfMemory?: (size: number) => void };
  Moc?: {
    fromArrayBuffer?: (buffer: ArrayBuffer) => CubismMoc;
    prototype?: { hasMocConsistency?: (buffer: ArrayBuffer) => number };
  };
  Model?: { fromMoc?: (moc: CubismMoc) => CubismCoreModel };
};

type CubismMoc = {
  _release?: () => void;
};

type CubismCoreModel = {
  canvasinfo: {
    CanvasWidth: number;
    CanvasHeight: number;
    PixelsPerUnit: number;
  };
  parameters: {
    count: number;
    ids: string[];
    values: Float32Array | number[];
    maximumValues: Float32Array | number[];
    minimumValues: Float32Array | number[];
    defaultValues: Float32Array | number[];
  };
  drawables: {
    count: number;
    renderOrders: Int32Array | number[];
    textureIndices: Int32Array | number[];
    vertexPositions: ArrayLike<Float32Array | number[]>;
    vertexUvs: ArrayLike<Float32Array | number[]>;
    indices: ArrayLike<Uint16Array | number[]>;
    opacities: Float32Array | number[];
    blendModes?: Int32Array | number[];
    dynamicFlags?: Int32Array | number[];
    resetDynamicFlags?: () => void;
  };
  update: () => void;
  _release?: () => void;
};

type ModelSettings = {
  FileReferences: {
    Moc: string;
    Textures: string[];
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
  Meta: {
    Duration: number;
    Loop?: boolean;
  };
  Curves: MotionCurve[];
};

type RendererOptions = {
  canvas: HTMLCanvasElement;
  modelUrl: string;
  coreScriptUrl: string;
};

const normalBlendMode = 0;
const additiveBlendMode = 1;
const multiplyBlendMode = 2;

let coreScriptPromise: Promise<void> | undefined;

export class MinimalCubismRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly modelUrl: string;
  private readonly coreScriptUrl: string;
  private gl?: WebGLRenderingContext;
  private program?: WebGLProgram;
  private positionBuffer?: WebGLBuffer;
  private uvBuffer?: WebGLBuffer;
  private indexBuffer?: WebGLBuffer;
  private model?: CubismCoreModel;
  private moc?: CubismMoc;
  private textures: WebGLTexture[] = [];
  private parameterIndices = new Map<string, number>();
  private lipSyncIds: string[] = ['ParamMouthOpenY', 'ParamA'];
  private idleMotion?: MotionData;
  private tapMotion?: MotionData;
  private frameId = 0;
  private startedAt = performance.now();
  private motionStartedAt = performance.now();
  private status: GuideStatus = 'idle';
  private audioState: AvatarAudioState = 'idle';
  private destroyed = false;

  constructor(options: RendererOptions) {
    this.canvas = options.canvas;
    this.modelUrl = options.modelUrl;
    this.coreScriptUrl = options.coreScriptUrl;
  }

  async initialize() {
    await loadCubismCore(this.coreScriptUrl);
    const core = getCubismCore();
    core.Memory?.initializeAmountOfMemory?.(16 * 1024 * 1024);

    const settings = await fetchJson<ModelSettings>(this.modelUrl);
    const baseUrl = new URL('.', new URL(this.modelUrl, window.location.href)).toString();
    const mocUrl = new URL(settings.FileReferences.Moc, baseUrl).toString();
    const mocBytes = await fetchArrayBuffer(mocUrl);
    const moc = core.Moc?.fromArrayBuffer?.(mocBytes);
    if (!moc) {
      throw new Error('Cubism Core could not create Live2D model data.');
    }

    const model = core.Model?.fromMoc?.(moc);
    if (!model) {
      moc._release?.();
      throw new Error('Cubism Core could not create a runtime model.');
    }

    this.moc = moc;
    this.model = model;
    this.registerParameters(model);
    this.registerLipSyncIds(settings);
    this.setupWebGL();
    await this.loadTextures(settings, baseUrl);
    await this.loadMotions(settings, baseUrl);
    this.resize();
    window.addEventListener('resize', this.resize);
    this.loop();
  }

  setGuideState(status: GuideStatus, audioState: AvatarAudioState) {
    if (this.status !== status) {
      this.motionStartedAt = performance.now();
    }
    this.status = status;
    this.audioState = audioState;
  }

  destroy() {
    this.destroyed = true;
    window.removeEventListener('resize', this.resize);
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    const gl = this.gl;
    if (gl) {
      this.textures.forEach((texture) => gl.deleteTexture(texture));
      if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
      if (this.uvBuffer) gl.deleteBuffer(this.uvBuffer);
      if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
      if (this.program) gl.deleteProgram(this.program);
    }
    this.model?._release?.();
    this.moc?._release?.();
  }

  private registerParameters(model: CubismCoreModel) {
    for (let index = 0; index < model.parameters.count; index += 1) {
      this.parameterIndices.set(model.parameters.ids[index], index);
    }
  }

  private registerLipSyncIds(settings: ModelSettings) {
    const lipSyncGroup = settings.Groups?.find(
      (group) => group.Target === 'Parameter' && group.Name === 'LipSync',
    );
    if (lipSyncGroup?.Ids.length) {
      this.lipSyncIds = lipSyncGroup.Ids;
    }
  }

  private setupWebGL() {
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) {
      throw new Error('This browser does not provide WebGL for Live2D.');
    }
    this.gl = gl;
    this.program = createProgram(gl);
    this.positionBuffer = gl.createBuffer() ?? undefined;
    this.uvBuffer = gl.createBuffer() ?? undefined;
    this.indexBuffer = gl.createBuffer() ?? undefined;
    if (!this.positionBuffer || !this.uvBuffer || !this.indexBuffer) {
      throw new Error('WebGL buffer creation failed.');
    }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.enable(gl.BLEND);
  }

  private async loadTextures(settings: ModelSettings, baseUrl: string) {
    const gl = this.ensureGl();
    const textures = await Promise.all(
      settings.FileReferences.Textures.map(async (texturePath) => {
        const image = await loadImage(new URL(texturePath, baseUrl).toString());
        const texture = gl.createTexture();
        if (!texture) {
          throw new Error('WebGL texture creation failed.');
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        return texture;
      }),
    );
    this.textures = textures;
  }

  private async loadMotions(settings: ModelSettings, baseUrl: string) {
    const loadFirst = async (groupName: string) => {
      const motionFile = settings.FileReferences.Motions?.[groupName]?.[0]?.File;
      if (!motionFile) return undefined;
      return fetchJson<MotionData>(new URL(motionFile, baseUrl).toString());
    };
    this.idleMotion = await loadFirst('Idle');
    this.tapMotion = await loadFirst('TapBody');
  }

  private readonly resize = () => {
    const gl = this.gl;
    const rect = this.canvas.getBoundingClientRect();
    if (!gl || rect.width <= 0 || rect.height <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  };

  private loop = () => {
    if (this.destroyed) return;
    const now = performance.now();
    this.updateParameters(now);
    this.draw();
    this.frameId = requestAnimationFrame(this.loop);
  };

  private updateParameters(now: number) {
    const model = this.model;
    if (!model) return;

    const motion = this.status === 'idle' ? this.idleMotion : this.tapMotion ?? this.idleMotion;
    if (motion) {
      const elapsed = (now - this.motionStartedAt) / 1000;
      const time = motion.Meta.Loop === false ? Math.min(elapsed, motion.Meta.Duration) : elapsed % motion.Meta.Duration;
      for (const curve of motion.Curves) {
        if (curve.Target === 'Parameter') {
          this.setParameter(curve.Id, evaluateCurve(curve, time), 0.84);
        }
      }
    } else {
      this.applyProceduralIdle(now);
    }

    this.applyProceduralState(now);
    model.update();
    model.drawables.resetDynamicFlags?.();
  }

  private applyProceduralIdle(now: number) {
    const seconds = (now - this.startedAt) / 1000;
    this.setParameter('ParamAngleX', Math.sin(seconds * 0.8) * 7, 0.2);
    this.setParameter('ParamAngleY', Math.cos(seconds * 0.7) * 4, 0.2);
    this.setParameter('ParamAngleZ', Math.sin(seconds * 0.55) * 3, 0.2);
    this.setParameter('ParamBodyAngleX', Math.sin(seconds * 0.45) * 5, 0.16);
  }

  private applyProceduralState(now: number) {
    const seconds = (now - this.startedAt) / 1000;
    const isTalking = this.audioState === 'playing';
    if (this.status === 'thinking') {
      this.setParameter('ParamAngleX', Math.sin(seconds * 2.2) * 10, 0.18);
    }
    const mouthValue = isTalking ? 0.24 + Math.abs(Math.sin(seconds * 12)) * 0.72 : 0;
    for (const id of this.lipSyncIds) {
      this.setParameter(id, mouthValue, isTalking ? 0.82 : 0.18);
    }
  }

  private setParameter(id: string, value: number, weight: number) {
    const model = this.model;
    const index = this.parameterIndices.get(id);
    if (!model || index === undefined) return;
    const min = model.parameters.minimumValues[index] ?? -Infinity;
    const max = model.parameters.maximumValues[index] ?? Infinity;
    const current = model.parameters.values[index] ?? model.parameters.defaultValues[index] ?? 0;
    const next = Math.min(max, Math.max(min, value));
    model.parameters.values[index] = current * (1 - weight) + next * weight;
  }

  private draw() {
    const gl = this.ensureGl();
    const model = this.model;
    const program = this.program;
    if (!model || !program) return;

    this.resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    const count = model.drawables.count;
    const sorted = new Array<number>(count);
    for (let index = 0; index < count; index += 1) {
      const order = model.drawables.renderOrders[index] ?? index;
      sorted[order] = index;
    }

    for (let order = 0; order < count; order += 1) {
      const drawableIndex = sorted[order];
      if (drawableIndex === undefined) continue;
      this.drawDrawable(drawableIndex);
    }
  }

  private drawDrawable(drawableIndex: number) {
    const gl = this.ensureGl();
    const model = this.model;
    const program = this.program;
    if (!model || !program) return;

    const opacity = model.drawables.opacities[drawableIndex] ?? 1;
    if (opacity <= 0.01) return;

    const textureIndex = model.drawables.textureIndices[drawableIndex] ?? 0;
    const texture = this.textures[textureIndex];
    if (!texture) return;

    const positions = toFloat32(model.drawables.vertexPositions[drawableIndex]);
    const uvs = toFloat32(model.drawables.vertexUvs[drawableIndex]);
    const indices = toUint16(model.drawables.indices[drawableIndex]);
    if (!positions.length || !uvs.length || !indices.length) return;

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const uvLocation = gl.getAttribLocation(program, 'a_uv');
    const matrixLocation = gl.getUniformLocation(program, 'u_matrix');
    const opacityLocation = gl.getUniformLocation(program, 'u_opacity');
    const textureLocation = gl.getUniformLocation(program, 'u_texture');

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer!);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer!);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer!);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

    const matrix = this.getModelMatrix();
    gl.uniformMatrix3fv(matrixLocation, false, matrix);
    gl.uniform1f(opacityLocation, opacity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(textureLocation, 0);

    this.applyBlendMode(model.drawables.blendModes?.[drawableIndex] ?? normalBlendMode);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  }

  private getModelMatrix() {
    const model = this.model!;
    const canvasInfo = model.canvasinfo;
    const modelHeight = canvasInfo.CanvasHeight / canvasInfo.PixelsPerUnit;
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const scale = 1.86 / Math.max(0.001, modelHeight);
    return new Float32Array([
      scale / aspect,
      0,
      0,
      0,
      scale,
      0,
      0,
      -0.18,
      1,
    ]);
  }

  private applyBlendMode(blendMode: number) {
    const gl = this.ensureGl();
    if (blendMode === additiveBlendMode) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      return;
    }
    if (blendMode === multiplyBlendMode) {
      gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
      return;
    }
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private ensureGl() {
    if (!this.gl) {
      throw new Error('WebGL is not initialized.');
    }
    return this.gl;
  }
}

function getCubismCore() {
  const core = window.Live2DCubismCore as CubismCoreGlobal | undefined;
  if (!core?.Moc?.fromArrayBuffer || !core.Model?.fromMoc) {
    throw new Error('Live2D Cubism Core is missing. Put live2dcubismcore.min.js in /live2d/core/.');
  }
  return core;
}

export function loadCubismCore(scriptUrl: string) {
  if (window.Live2DCubismCore) {
    return Promise.resolve();
  }
  if (!coreScriptPromise) {
    coreScriptPromise = new Promise(async (resolve, reject) => {
      let objectUrl = '';
      try {
        const response = await fetch(scriptUrl);
        if (!response.ok) {
          reject(new Error(`Live2D Cubism Core script not found: ${scriptUrl}`));
          return;
        }
        const source = await response.text();
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('text/html') || source.trimStart().startsWith('<')) {
          reject(new Error(`Live2D Cubism Core script not found: ${scriptUrl}`));
          return;
        }
        objectUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Live2D Cubism Core script could not be loaded.'));
        return;
      }

      const script = document.createElement('script');
      script.src = objectUrl;
      script.async = true;
      script.onload = () => {
        URL.revokeObjectURL(objectUrl);
        if (window.Live2DCubismCore) resolve();
        else reject(new Error('Live2D Cubism Core script loaded, but global core was not found.'));
      };
      script.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Live2D Cubism Core script could not execute: ${scriptUrl}`));
      };
      document.head.appendChild(script);
    });
  }
  return coreScriptPromise;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.json() as Promise<T>;
}

async function fetchArrayBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
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

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    `
      attribute vec2 a_position;
      attribute vec2 a_uv;
      uniform mat3 u_matrix;
      varying vec2 v_uv;
      void main() {
        vec3 position = u_matrix * vec3(a_position, 1.0);
        gl_Position = vec4(position.xy, 0.0, 1.0);
        v_uv = a_uv;
      }
    `,
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform float u_opacity;
      varying vec2 v_uv;
      void main() {
        vec4 color = texture2D(u_texture, v_uv);
        gl_FragColor = vec4(color.rgb, color.a * u_opacity);
      }
    `,
  );
  const program = gl.createProgram();
  if (!program) {
    throw new Error('WebGL program creation failed.');
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown link error';
    throw new Error(`WebGL shader link failed: ${log}`);
  }
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('WebGL shader creation failed.');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error';
    gl.deleteShader(shader);
    throw new Error(`WebGL shader compile failed: ${log}`);
  }
  return shader;
}

function toFloat32(value: Float32Array | number[]) {
  return value instanceof Float32Array ? value : new Float32Array(value);
}

function toUint16(value: Uint16Array | number[]) {
  return value instanceof Uint16Array ? value : new Uint16Array(value);
}

function evaluateCurve(curve: MotionCurve, time: number) {
  const segments = curve.Segments;
  if (segments.length < 2) return 0;

  let currentTime = segments[0];
  let currentValue = segments[1];
  let index = 2;

  while (index < segments.length) {
    const segmentType = segments[index++];
    if (segmentType === 0) {
      const endTime = segments[index++];
      const endValue = segments[index++];
      if (time <= endTime) {
        const t = normalized(time, currentTime, endTime);
        return lerp(currentValue, endValue, t);
      }
      currentTime = endTime;
      currentValue = endValue;
      continue;
    }

    if (segmentType === 1) {
      const c1Time = segments[index++];
      const c1Value = segments[index++];
      const c2Time = segments[index++];
      const c2Value = segments[index++];
      const endTime = segments[index++];
      const endValue = segments[index++];
      if (time <= endTime) {
        const t = normalized(time, currentTime, endTime);
        return cubicBezier(currentValue, c1Value, c2Value, endValue, t);
      }
      currentTime = endTime;
      currentValue = endValue;
      void c1Time;
      void c2Time;
      continue;
    }

    const endTime = segments[index++];
    const endValue = segments[index++];
    if (time <= endTime) {
      return segmentType === 2 ? currentValue : endValue;
    }
    currentTime = endTime;
    currentValue = endValue;
  }

  return currentValue;
}

function normalized(value: number, min: number, max: number) {
  if (max <= min) return 1;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number) {
  const inv = 1 - t;
  return inv * inv * inv * p0 + 3 * inv * inv * t * p1 + 3 * inv * t * t * p2 + t * t * t * p3;
}

declare global {
  interface Window {
    Live2DCubismCore?: CubismCoreGlobal;
  }
}
