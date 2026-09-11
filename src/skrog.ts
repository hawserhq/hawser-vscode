import * as cp from 'node:child_process';
import * as vscode from 'vscode';

/** Shape of `skrog status --json`. */
export interface Status {
  installed: boolean;
  distro?: string;
  supervisor: 'running' | 'stopped';
  /** `idle` is the engine stopped by the idle timeout — healthy, wakes on demand. */
  engine: 'running' | 'idle' | 'stopped';
  desired: string;
  profile?: string;
}

/** Shape of `skrog version --json` (only the field the extension needs). */
export interface Version {
  app: string;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** The skrog binary could not be executed at all: not on PATH, or a bad `skrog.path`. */
export class NotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`skrog not found at "${path}"`);
    this.name = 'NotFoundError';
  }
}

/**
 * The extension's only coupling to Skrog: the CLI contract — `--json` output
 * and exit codes (0 ok, 1 error, 2 usage, 3 not installed). Nothing here
 * scrapes human-readable text; that contract is what lets this extension live
 * in its own repo and pin a minimum skrog version.
 */
export class Skrog {
  constructor(public readonly path: string) {}

  /** Resolves the binary from the `skrog.path` setting, else `skrog` on PATH. */
  static fromSettings(): Skrog {
    const p = vscode.workspace.getConfiguration('skrog').get<string>('path')?.trim();
    return new Skrog(p && p.length > 0 ? p : 'skrog');
  }

  run(args: string[], timeoutMs = 30_000): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      cp.execFile(
        this.path,
        args,
        { timeout: timeoutMs, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
        (err, stdout, stderr) => {
          // execFile reports every non-zero exit as an error. Skrog's non-zero
          // codes are meaningful (3 = not installed still emits JSON), so only
          // "could not run it" and "timed out" are failures here.
          const e = err as (Error & { code?: number | string; killed?: boolean }) | null;
          if (e && (e.code === 'ENOENT' || e.code === 'EACCES')) {
            reject(new NotFoundError(this.path));
            return;
          }
          if (e?.killed) {
            reject(new Error(`skrog ${args.join(' ')} timed out after ${timeoutMs}ms`));
            return;
          }
          const code = e && typeof e.code === 'number' ? e.code : 0;
          resolve({ code, stdout: String(stdout), stderr: String(stderr) });
        },
      );
    });
  }

  /** Runs a `--json` command and parses stdout; the exit code is informational. */
  async json<T>(args: string[], timeoutMs?: number): Promise<T> {
    const r = await this.run(args, timeoutMs);
    const text = r.stdout.trim();
    if (!text) {
      const why = r.stderr.trim() ? `: ${r.stderr.trim()}` : '';
      throw new Error(`skrog ${args.join(' ')} exited ${r.code} with no output${why}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`skrog ${args.join(' ')} returned non-JSON (exit ${r.code}): ${text.slice(0, 200)}`);
    }
  }

  status(): Promise<Status> {
    return this.json<Status>(['status', '--json'], 15_000);
  }

  version(): Promise<Version> {
    return this.json<Version>(['version', '--json'], 15_000);
  }
}
