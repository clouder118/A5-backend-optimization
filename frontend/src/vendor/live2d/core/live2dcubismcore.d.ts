declare namespace Live2DCubismCore {
  type csmLogFunction = (message: string) => void;

  class Moc {
    static fromArrayBuffer(buffer: ArrayBuffer): Moc;
    static prototype: {
      hasMocConsistency(buffer: ArrayBuffer): number;
    };
    _release(): void;
  }

  class Model {
    static fromMoc(moc: Moc): Model;
    parameters: any;
    parts: any;
    drawables: any;
    canvasinfo: any;
    update(): void;
    _release(): void;
  }

  const Version: {
    csmGetLatestMocVersion(): number;
    csmGetMocVersion(buffer: ArrayBuffer): number;
    csmGetVersion(): number;
  };

  const Memory: {
    initializeAmountOfMemory(size: number): void;
  };

  const Utils: Record<string, (...args: any[]) => any>;
}
