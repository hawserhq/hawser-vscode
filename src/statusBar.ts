import * as vscode from 'vscode';
import type { Status } from './skrog';

/** What the status bar should show, derived from one `skrog status --json`. */
export type View =
  | { kind: 'ok'; status: Status }
  | { kind: 'not-installed' }
  | { kind: 'not-found'; path: string }
  | { kind: 'error'; message: string };

/**
 * The engine's state, always in view. Docker Desktop has nothing to say here:
 * it is always-on. Skrog idle-stops to give RAM back and wakes on demand, and
 * this is where that becomes visible instead of a mystery.
 */
export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem('skrog.engine', vscode.StatusBarAlignment.Left, 50);
    this.item.name = 'Skrog engine';
    this.item.command = 'skrog.menu';
    this.item.text = '$(sync~spin) Skrog';
    this.item.show();
  }

  render(v: View): void {
    const warn = new vscode.ThemeColor('statusBarItem.warningBackground');
    const error = new vscode.ThemeColor('statusBarItem.errorBackground');
    switch (v.kind) {
      case 'ok': {
        const s = v.status;
        const profile = s.profile ? ` · ${s.profile}` : '';
        switch (s.engine) {
          case 'running':
            this.set(`$(vm-running) Skrog${profile}`, tip(s, 'Engine running'));
            break;
          case 'idle':
            this.set(
              `$(vm-outline) Skrog idle${profile}`,
              tip(s, 'Engine idle-stopped to free RAM — wakes on your next docker command'),
            );
            break;
          default:
            this.set(`$(debug-stop) Skrog stopped${profile}`, tip(s, 'Engine stopped (stays stopped until started)'), warn);
        }
        break;
      }
      case 'not-installed':
        this.set('$(warning) Skrog: not installed', 'No Skrog engine on this machine. Run `skrog install`.', warn);
        break;
      case 'not-found':
        this.set('$(error) Skrog: not found', `Could not run "${v.path}". Install Skrog or set skrog.path.`, error);
        break;
      case 'error':
        this.set('$(error) Skrog', v.message, error);
        break;
    }
  }

  private set(text: string, tooltip: string | vscode.MarkdownString, bg?: vscode.ThemeColor): void {
    this.item.text = text;
    this.item.tooltip = tooltip;
    this.item.backgroundColor = bg;
  }

  dispose(): void {
    this.item.dispose();
  }
}

function tip(s: Status, headline: string): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**${headline}**\n\n`);
  md.appendMarkdown(`- distro: \`${s.distro ?? '?'}\`\n- supervisor: ${s.supervisor}\n- desired: ${s.desired}`);
  if (s.profile) {
    md.appendMarkdown(`\n- profile: ${s.profile}`);
  }
  md.appendMarkdown('\n\nClick for actions.');
  return md;
}
