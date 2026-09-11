# Hawser for VS Code

See and control the [Hawser](https://github.com/hawserhq/hawser) engine — the
upstream open source Docker Engine on Windows via WSL2 — from inside VS Code.

Hawser does things Docker Desktop's architecture cannot, and this extension is
where they become visible and one click away:

- **Engine state in the status bar** — running, *idle*, or stopped. Hawser
  idle-stops a quiet engine to give its RAM back and wakes it on your next
  `docker` command; Docker Desktop is always-on and has no such state to show.
  Click for start / stop / restart / doctor.
- **Doctor** — run `hawser doctor` in a terminal from the command palette.
- Coming next, tracked in the [issues](https://github.com/hawserhq/hawser-vscode/issues):
  **engine snapshots as checkpoints**, **doctor in the Problems panel with fix
  actions**, **a remote GPU engine as your Dev Container host over mutual TLS**,
  **GPU dev containers**, an **audit panel**, and per-workspace profiles.

## Requirements

- Windows 11 with WSL2 and **Hawser installed** (`hawser install`). The
  extension talks to `hawser.exe` only through its `--json` CLI contract; it needs
  Hawser 0.3.0 or newer.
- `hawser` on PATH, or set `hawser.path`.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `hawser.path` | `""` | Path to `hawser.exe`; empty resolves `hawser` on PATH |
| `hawser.pollIntervalMs` | `5000` | Status refresh interval (only while a window is focused) |
| `hawser.notifyTransitions` | `true` | Toast when the engine idle-stops or wakes |

## Commands

`Hawser: Engine Menu` · `Start Engine` · `Stop Engine` · `Restart Engine` ·
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
scrapes human-readable `hawser` output — only `--json` and exit codes — which is
the contract that lets it live in its own repo.

## License

[Apache-2.0](LICENSE). Hawser is not affiliated with or endorsed by Docker, Inc.;
Docker is a trademark of Docker, Inc.
