import * as vscode from 'vscode';
import { Skrog, NotFoundError, type Status } from './skrog';
import { StatusBar, type View } from './statusBar';

/**
 * Oldest skrog CLI this extension is tested against (its `--json` contract).
 *
 * 0.4.0, not the 0.3.0 this read before the rename: releases through v0.3.1
 * shipped `hawser.exe`, so no binary that answers to `skrog` can report a
 * version below 0.4.0. Leaving it at 0.3.0 would have been a floor nothing can
 * fall through -- a check that looks like one and is not.
 */
const MIN_SKROG = '0.4.0';

let skrog: Skrog;
let bar: StatusBar;
let timer: NodeJS.Timeout | undefined;
let last: Status | undefined;
const out = vscode.window.createOutputChannel('Skrog');

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  skrog = Skrog.fromSettings();
  bar = new StatusBar();
  ctx.subscriptions.push(bar, out);

  ctx.subscriptions.push(
    vscode.commands.registerCommand('skrog.menu', menu),
    vscode.commands.registerCommand('skrog.start', () => engineAction(['start'], 'Starting the engine…')),
    vscode.commands.registerCommand('skrog.stop', () => engineAction(['stop'], 'Stopping the engine…')),
    vscode.commands.registerCommand('skrog.restart', () => engineAction(['restart'], 'Restarting the engine…')),
    vscode.commands.registerCommand('skrog.doctor', doctor),
    vscode.commands.registerCommand('skrog.refresh', () => refresh()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('skrog')) {
        skrog = Skrog.fromSettings();
        schedule();
        void refresh();
      }
    }),
    // Poll only while a window is focused: an editor left in the background
    // should not keep spawning processes.
    vscode.window.onDidChangeWindowState(() => schedule()),
  );

  await checkVersion();
  await refresh();
  schedule();
}

export function deactivate(): void {
  if (timer) {
    clearInterval(timer);
  }
}

function pollInterval(): number {
  return Math.max(1000, vscode.workspace.getConfiguration('skrog').get<number>('pollIntervalMs') ?? 5000);
}

function schedule(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
  if (!vscode.window.state.focused) {
    return;
  }
  timer = setInterval(() => void refresh(), pollInterval());
}

async function checkVersion(): Promise<void> {
  try {
    const v = await skrog.version();
    if (isRelease(v.app) && compare(v.app, MIN_SKROG) < 0) {
      void vscode.window.showWarningMessage(
        `Skrog ${v.app} found; this extension expects ${MIN_SKROG} or newer. Some features may not work.`,
      );
    }
    out.appendLine(`skrog ${v.app} at ${skrog.path}`);
  } catch (e) {
    out.appendLine(`version check failed: ${String(e)}`);
  }
}

/**
 * Whether a reported version is a release at all, and so worth comparing
 * against MIN_SKROG.
 *
 * Two builds are not: a source build reports `dev`, and skrog's release
 * workflow stamps `0.0.0-ci` on pull-request builds and `0.0.0-dryrun` on a
 * dry run. Those parse as 0.0.0, which is below every minimum, so anyone
 * testing a CI artifact was told their skrog was too old when the version
 * only ever meant "not a release".
 */
function isRelease(version: string): boolean {
  return version !== 'dev' && !version.startsWith('0.0.0');
}

/** Compares dotted versions; non-numeric segments compare as 0. */
function compare(a: string, b: string): number {
  const parse = (s: string) => s.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) {
      return d;
    }
  }
  return 0;
}

async function refresh(): Promise<void> {
  let view: View;
  try {
    const s = await skrog.status();
    view = s.installed ? { kind: 'ok', status: s } : { kind: 'not-installed' };
    notifyTransition(last, s);
    last = s;
  } catch (e) {
    view = e instanceof NotFoundError ? { kind: 'not-found', path: e.path } : { kind: 'error', message: String(e) };
    out.appendLine(`status: ${String(e)}`);
  }
  bar.render(view);
}

/** The idle-stop story made visible — the thing an always-on Docker Desktop cannot show. */
function notifyTransition(prev: Status | undefined, cur: Status): void {
  const enabled = vscode.workspace.getConfiguration('skrog').get<boolean>('notifyTransitions', true);
  if (!prev || !cur.installed || !enabled) {
    return;
  }
  if (prev.engine !== 'idle' && cur.engine === 'idle') {
    void vscode.window.showInformationMessage(
      'Skrog: engine idle-stopped to free RAM. It wakes on your next docker command.',
    );
  } else if (prev.engine === 'idle' && cur.engine === 'running') {
    void vscode.window.showInformationMessage('Skrog: engine woke up.');
  }
}

async function engineAction(args: string[], title: string): Promise<void> {
  await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title }, async () => {
    const r = await skrog.run(args, 180_000);
    out.appendLine(`skrog ${args.join(' ')} → exit ${r.code}\n${r.stdout}${r.stderr}`);
    if (r.code !== 0) {
      void vscode.window.showErrorMessage(
        `skrog ${args.join(' ')} failed (exit ${r.code}). See the Skrog output channel.`,
      );
    }
  });
  await refresh();
}

/** Doctor is a human-facing report; a terminal renders it as intended. */
function doctor(): void {
  const t = vscode.window.createTerminal({ name: 'Skrog doctor' });
  t.show();
  // Quoted so a skrog.path with spaces works in PowerShell (the Windows default).
  t.sendText(`& "${skrog.path}" doctor`);
}

async function menu(): Promise<void> {
  const s = last;
  type Item = vscode.QuickPickItem & { run: () => unknown };
  const items: Item[] = [];

  if (!s?.installed) {
    items.push({
      label: '$(book) How to install Skrog',
      run: () => vscode.env.openExternal(vscode.Uri.parse('https://github.com/wslkit/skrog#install')),
    });
  } else {
    if (s.engine !== 'running') {
      items.push({
        label: '$(play) Start / wake engine',
        detail: 'skrog start',
        run: () => engineAction(['start'], 'Starting the engine…'),
      });
    } else {
      items.push({
        label: '$(debug-stop) Stop engine',
        detail: 'skrog stop — stays stopped until started',
        run: () => engineAction(['stop'], 'Stopping the engine…'),
      });
    }
    items.push({
      label: '$(debug-restart) Restart engine',
      detail: 'skrog restart',
      run: () => engineAction(['restart'], 'Restarting the engine…'),
    });
  }

  items.push(
    { label: '$(pulse) Run doctor', detail: 'skrog doctor', run: doctor },
    { label: '$(refresh) Refresh status', run: () => refresh() },
    { label: '$(output) Show Skrog output', run: () => out.show() },
  );

  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: s?.installed ? `Engine ${s.engine} · ${s.distro ?? ''}` : 'Skrog',
  });
  await pick?.run();
}
