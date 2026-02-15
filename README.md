# 🏰 Camelot

AI-powered development cockpit. Multi-agent orchestration for Copilot CLI and Claude Code.

## Vision

A beautiful, interactive web dashboard that orchestrates AI coding agents on your Windows machine. Click a ticket, spawn an agent, watch it work — or jump in and take over.

## Features (Planned)

- **Multi-agent:** Copilot CLI (primary) + Claude Code (secondary) running in parallel
- **Interactive UI:** Ticket board, live agent output, hotkeys, drag/drop layouts
- **Terminal launcher:** Open Windows Terminal tabs with AI agents pre-loaded
- **In-browser terminal:** xterm.js embedded terminals (stretch goal)
- **Script runner:** Execute PowerShell scripts with live output
- **SDP integration:** Reads tickets from `.sdp/plans/`, triggers Cleanse → Plan → Attack → Review

## Stack

- **Runtime:** Node.js + TypeScript
- **Server:** Express + WebSocket
- **Database:** SQLite (better-sqlite3)
- **Terminal:** node-pty + xterm.js (stretch)
- **UI:** Modern SPA, dark theme

## Requirements

- Windows 10/11
- Node.js 20+
- [GitHub Copilot CLI](https://github.com/features/copilot/cli)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (optional, secondary)

## Quick Start

```bash
git clone https://github.com/TechnicallyShaun/camelot.git
cd camelot
npm install
npm start
```

Then open `http://localhost:1187` in your browser.

## Architecture

```
Browser (localhost:1187)
    ↕ WebSocket
Camelot Server (Node.js)
    ├── Agent Spawner → copilot -p "..." --yolo
    ├── Terminal Manager → wt.exe new-tab / node-pty
    ├── Script Runner → powershell.exe -File ...
    ├── SQLite → agent runs, logs, tickets
    └── SDP Bridge → reads .sdp/plans/*
```

## License

MIT
