import * as vscode from 'vscode';
import { Hawser, NotFoundError, type Status } from './hawser';
import { StatusBar, type View } from './statusBar';

/** Oldest hawser CLI this extension is tested against (its `--json` contract). */
const MIN_HAWSER = '0.3.0';

let hawser: Hawser;
let bar: StatusBar;
let timer: NodeJS.Timeout | undefined;
let last: Status | undefined;
const out = vscode.window.createOutputChannel('Hawser');

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  hawser = Hawser.fromSettings();
  bar = new StatusBar();
  ctx.subscriptions.push(bar, out);

  ctx.subscriptions.push(
    vscode.commands.registerCommand('hawser.menu', menu),
    vscode.commands.registerCommand('hawser.start', () => engineAction(['start'], 'Starting the engine…')),
    vscode.commands.registerCommand('hawser.stop', () => engineAction(['stop'], 'Stopping the engine…')),
    vscode.commands.registerCommand('hawser.restart', () => engineAction(['restart'], 'Restarting the engine…')),
    vscode.commands.registerCommand('hawser.doctor', doctor),
    vscode.commands.registerCommand('hawser.refresh', () => refresh()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('hawser')) {
        hawser = Hawser.fromSettings();
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
  return Math.max(1000, vscode.workspace.getConfiguration('hawser').get<number>('pollIntervalMs') ?? 5000);
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
    const v = await hawser.version();
    // A source build reports "dev"; that is never too old.
    if (v.app !== 'dev' && compare(v.app, MIN_HAWSER) < 0) {
      void vscode.window.showWarningMessage(
        `Hawser ${v.app} found; this extension expects ${MIN_HAWSER} or newer. Some features may not work.`,
      );
    }
    out.appendLine(`hawser ${v.app} at ${hawser.path}`);
  } catch (e) {
    out.appendLine(`version check failed: ${String(e)}`);
  }
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
    const s = await hawser.status();
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
  const enabled = vscode.workspace.getConfiguration('hawser').get<boolean>('notifyTransitions', true);
  if (!prev || !cur.installed || !enabled) {
    return;
  }
  if (prev.engine !== 'idle' && cur.engine === 'idle') {
    void vscode.window.showInformationMessage(
      'Hawser: engine idle-stopped to free RAM. It wakes on your next docker command.',
    );
  } else if (prev.engine === 'idle' && cur.engine === 'running') {
    void vscode.window.showInformationMessage('Hawser: engine woke up.');
  }
}

async function engineAction(args: string[], title: string): Promise<void> {
  await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title }, async () => {
    const r = await hawser.run(args, 180_000);
    out.appendLine(`hawser ${args.join(' ')} → exit ${r.code}\n${r.stdout}${r.stderr}`);
    if (r.code !== 0) {
      void vscode.window.showErrorMessage(
        `hawser ${args.join(' ')} failed (exit ${r.code}). See the Hawser output channel.`,
      );
    }
  });
  await refresh();
}

/** Doctor is a human-facing report; a terminal renders it as intended. */
function doctor(): void {
  const t = vscode.window.createTerminal({ name: 'Hawser doctor' });
  t.show();
  // Quoted so a hawser.path with spaces works in PowerShell (the Windows default).
  t.sendText(`& "${hawser.path}" doctor`);
}

async function menu(): Promise<void> {
  const s = last;
  type Item = vscode.QuickPickItem & { run: () => unknown };
  const items: Item[] = [];

  if (!s?.installed) {
    items.push({
      label: '$(book) How to install Hawser',
      run: () => vscode.env.openExternal(vscode.Uri.parse('https://github.com/zcsizmadia/hawser#install')),
    });
  } else {
    if (s.engine !== 'running') {
      items.push({
        label: '$(play) Start / wake engine',
        detail: 'hawser start',
        run: () => engineAction(['start'], 'Starting the engine…'),
      });
    } else {
      items.push({
        label: '$(debug-stop) Stop engine',
        detail: 'hawser stop — stays stopped until started',
        run: () => engineAction(['stop'], 'Stopping the engine…'),
      });
    }
    items.push({
      label: '$(debug-restart) Restart engine',
      detail: 'hawser restart',
      run: () => engineAction(['restart'], 'Restarting the engine…'),
    });
  }

  items.push(
    { label: '$(pulse) Run doctor', detail: 'hawser doctor', run: doctor },
    { label: '$(refresh) Refresh status', run: () => refresh() },
    { label: '$(output) Show Hawser output', run: () => out.show() },
  );

  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: s?.installed ? `Engine ${s.engine} · ${s.distro ?? ''}` : 'Hawser',
  });
  await pick?.run();
}
