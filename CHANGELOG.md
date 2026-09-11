# Changelog

All notable changes to this extension are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the extension
follows [semantic versioning](https://semver.org/spec/v2.0.0.html).

The version here and the `v*` tag that publishes it must match — the release
workflow refuses to publish when they do not, because a Marketplace listing
whose version names no tag in the repository cannot be traced back to source.

## [Unreleased]

## [0.1.0] — unreleased

Initial extension.

### Added

- Engine state in the status bar: running / idle / stopped, with a click menu
  for start, stop, restart, doctor, and refresh.
- Notifications when the engine idle-stops to free RAM or wakes back up — the
  state an always-on Docker Desktop has no way to show.
- `Skrog: Run Doctor` opens `skrog doctor` in a terminal.
- Talks to `skrog.exe` only through its `--json` CLI contract (Skrog ≥ 0.4.0),
  so the extension holds no engine logic of its own.

[Unreleased]: https://github.com/wslkit/skrog-vscode/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/wslkit/skrog-vscode/releases/tag/v0.1.0
