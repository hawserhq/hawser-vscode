# Skrog for VS Code

[![CI](https://github.com/wslkit/skrog-vscode/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wslkit/skrog-vscode/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/github/license/wslkit/skrog-vscode?color=2F3B45)](LICENSE)

<!-- Add on the first Marketplace publish; until then these render "not found":
[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/wslkit.skrog?color=0a7d84&label=marketplace)](https://marketplace.visualstudio.com/items?itemName=wslkit.skrog)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/wslkit.skrog?color=0a7d84)](https://marketplace.visualstudio.com/items?itemName=wslkit.skrog)
-->

See and control the [Skrog](https://github.com/wslkit/skrog) engine — the
upstream open source Docker Engine on Windows via WSL2 — from inside VS Code.

Skrog does things Docker Desktop's architecture cannot, and this extension is
where they become visible and one click away:

- **Engine state in the status bar** — running, *idle*, or stopped. Skrog
  idle-stops a quiet engine to give its RAM back and wakes it on your next
  `docker` command; Docker Desktop is always-on and has no such state to show.
  Click for start / stop / restart / doctor.
- **Doctor** — run `skrog doctor` in a terminal from the command palette.
- Coming next, tracked in the [issues](https://github.com/wslkit/skrog-vscode/issues):
  **engine snapshots as checkpoints**, **doctor in the Problems panel with fix
  actions**, **a remote GPU engine as your Dev Container host over mutual TLS**,
  **GPU dev containers**, an **audit panel**, and per-workspace profiles.

## Requirements

- Windows 11 with WSL2 and **Skrog installed** (`skrog install`). The
  extension talks to `skrog.exe` only through its `--json` CLI contract; it needs
  Skrog 0.3.0 or newer.
- `skrog` on PATH, or set `skrog.path`.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `skrog.path` | `""` | Path to `skrog.exe`; empty resolves `skrog` on PATH |
| `skrog.pollIntervalMs` | `5000` | Status refresh interval (only while a window is focused) |
| `skrog.notifyTransitions` | `true` | Toast when the engine idle-stops or wakes |

## Commands

`Skrog: Engine Menu` · `Start Engine` · `Stop Engine` · `Restart Engine` ·
`Run Doctor` · `Refresh Status`

## Development

```
npm install
npm run watch        # rebuild on change
```

Press **F5** to launch an Extension Development Host with the extension loaded.

```
npm run check        # typecheck
npm run build        # bundle to dist/extension.js
npm run package      # build the .vsix
```

The extension is a single esbuild bundle with no runtime dependencies. It never
scrapes human-readable `skrog` output — only `--json` and exit codes — which is
the contract that lets it live in its own repo.

## License

[Apache-2.0](LICENSE). Skrog is not affiliated with or endorsed by Docker, Inc.;
Docker is a trademark of Docker, Inc.
