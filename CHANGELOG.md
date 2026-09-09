# Changelog

## 0.1.0 — unreleased

Initial extension.

- Engine status in the status bar: running / idle / stopped, with a click menu
  for start, stop, restart, doctor, and refresh.
- Notifications when the engine idle-stops to free RAM or wakes back up.
- `Hawser: Run Doctor` opens `hawser doctor` in a terminal.
- Talks to `hawser.exe` only through its `--json` CLI contract (Hawser ≥ 0.3.0).
