import * as vscode from 'vscode';
import type { Status } from './hawser';

/** What the status bar should show, derived from one `hawser status --json`. */
export type View =
  | { kind: 'ok'; status: Status }
  | { kind: 'not-installed' }
  | { kind: 'not-found'; path: string }
  | { kind: 'error'; message: string };

/**
 * The engine's state, always in view. Docker Desktop has nothing to say here:
 * it is always-on. Hawser idle-stops to give RAM back and wakes on demand, and
 * this is where that becomes visible instead of a mystery.
 */
export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem('hawser.engine', vscode.StatusBarAlignment.Left, 50);
    this.item.name = 'Hawser engine';
    this.item.command = 'hawser.menu';
    this.item.text = '$(sync~spin) Hawser';
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
            this.set(`$(vm-running) Hawser${profile}`, tip(s, 'Engine running'));
            break;
          case 'idle':
            this.set(
              `$(vm-outline) Hawser idle${profile}`,
              tip(s, 'Engine idle-stopped to free RAM — wakes on your next docker command'),
            );
            break;
          default:
            this.set(`$(debug-stop) Hawser stopped${profile}`, tip(s, 'Engine stopped (stays stopped until started)'), warn);
        }
        break;
      }
      case 'not-installed':
        this.set('$(warning) Hawser: not installed', 'No Hawser engine on this machine. Run `hawser install`.', warn);
        break;
      case 'not-found':
        this.set('$(error) Hawser: not found', `Could not run "${v.path}". Install Hawser or set hawser.path.`, error);
        break;
      case 'error':
        this.set('$(error) Hawser', v.message, error);
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
