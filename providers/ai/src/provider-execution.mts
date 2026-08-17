import { spawn, type ChildProcess } from "node:child_process";

export interface ProviderProcessRequest {
  readonly executable: string;
  readonly args: readonly string[];
  readonly prompt: string;
  readonly workingDirectory: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

export interface ProviderProcessResult {
  readonly code: number | null;
  readonly timedOut: boolean;
  readonly cancelled: boolean;
  readonly crashed: boolean;
}

export interface ProviderProcessRunner {
  run(request: ProviderProcessRequest): Promise<ProviderProcessResult>;
}

export type ProviderCircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface ProviderExecutionSnapshot {
  readonly circuit: ProviderCircuitState;
  readonly consecutiveFailures: number;
  readonly restartCount: number;
}

const FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 30_000;
const MAX_RESTARTS = 1;

function terminateProcessTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      shell: false,
      stdio: "ignore",
    });
    killer.unref();
  }
  child.kill();
}

export const nativeProviderProcessRunner: ProviderProcessRunner = Object.freeze({
  run(request: ProviderProcessRequest): Promise<ProviderProcessResult> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timedOut = false;
      let cancelled = false;
      const child = spawn(request.executable, request.args, {
        cwd: request.workingDirectory,
        windowsHide: true,
        shell: false,
        stdio: ["pipe", "ignore", "ignore"],
      });

      const finish = (result: ProviderProcessResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        request.signal?.removeEventListener("abort", abort);
        resolve(result);
      };

      const abort = (): void => {
        if (settled) return;
        cancelled = true;
        terminateProcessTree(child);
      };

      const timeout = setTimeout(() => {
        if (settled) return;
        timedOut = true;
        terminateProcessTree(child);
      }, request.timeoutMs);

      request.signal?.addEventListener("abort", abort, { once: true });
      if (request.signal?.aborted) abort();
      child.once("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        request.signal?.removeEventListener("abort", abort);
        reject(error);
      });
      child.once("close", (code) => finish({
        code,
        timedOut,
        cancelled,
        crashed: !timedOut && !cancelled && code !== 0,
      }));
      child.stdin.end(request.prompt, "utf8");
    });
  },
});

export class ProviderExecutionController {
  private consecutiveFailures = 0;
  private circuitOpenedAt = 0;
  private restartCount = 0;
  private readonly runner: ProviderProcessRunner;
  private readonly now: () => number;

  constructor(runner: ProviderProcessRunner = nativeProviderProcessRunner, now: () => number = () => Date.now()) {
    this.runner = runner;
    this.now = now;
  }

  snapshot(): ProviderExecutionSnapshot {
    return Object.freeze({
      circuit: this.circuitState(),
      consecutiveFailures: this.consecutiveFailures,
      restartCount: this.restartCount,
    });
  }

  reset(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = 0;
    this.restartCount = 0;
  }

  async execute(request: ProviderProcessRequest): Promise<ProviderProcessResult & { readonly circuitOpen?: boolean }> {
    const circuit = this.circuitState();
    if (circuit === "OPEN") return { code: null, timedOut: false, cancelled: false, crashed: false, circuitOpen: true };
    if (circuit === "HALF_OPEN") this.restartCount = 0;

    let result: ProviderProcessResult;
    try {
      result = await this.runner.run(request);
    } catch {
      this.recordFailure();
      return { code: null, timedOut: false, cancelled: false, crashed: true };
    }

    if (result.crashed && this.restartCount < MAX_RESTARTS) {
      this.restartCount += 1;
      try {
        result = await this.runner.run(request);
      } catch {
        this.recordFailure();
        return { code: null, timedOut: false, cancelled: false, crashed: true };
      }
    }

    if (result.timedOut || result.cancelled || result.crashed || result.code !== 0) {
      this.recordFailure();
    } else {
      this.consecutiveFailures = 0;
      this.circuitOpenedAt = 0;
      this.restartCount = 0;
    }
    return result;
  }

  private circuitState(): ProviderCircuitState {
    if (this.circuitOpenedAt === 0) return "CLOSED";
    if (this.now() - this.circuitOpenedAt >= CIRCUIT_COOLDOWN_MS) return "HALF_OPEN";
    return "OPEN";
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    this.restartCount = 0;
    if (this.consecutiveFailures >= FAILURE_THRESHOLD) this.circuitOpenedAt = this.now();
  }
}
