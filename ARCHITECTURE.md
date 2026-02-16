# Architecture

Camelot follows a **three-layer architecture**: Domain → Infrastructure → Frontend. Each layer has clear boundaries, explicit contracts, and dependency rules that keep the system composable and testable.

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│   SPA · xterm.js · WebSocket client · Dark UI    │
├─────────────────────────────────────────────────┤
│              HTTP API + WebSocket                 │
├─────────────────────────────────────────────────┤
│                Infrastructure                    │
│   Express · ws · node-pty · better-sqlite3       │
├─────────────────────────────────────────────────┤
│                    Domain                        │
│   Agents · Tickets · Projects · Skills · Config  │
└─────────────────────────────────────────────────┘
```

## Layers

### Domain (business logic)

Pure TypeScript. No I/O, no framework imports, no file system access. Domain modules define **interfaces** in `types.ts` files and implement business rules against those interfaces.

| Module | Responsibility |
|--------|---------------|
| `agents/` | Agent configuration, run lifecycle (spawn, track, kill), multi-agent orchestration |
| `tickets/` | Ticket CRUD, stage progression (Cleanse → Plan → Attack → Review → Done) |
| `projects/` | Project registry (name + location) |
| `skills/` | Skill file management, publishing to agent config directories |
| `tools/` | Tool file management |
| `config/` | Application settings (port, SDP path, default agent, log level) |
| `daily-stream/` | Work logging, effort tracking, standup export |

**Key rule:** Domain modules **never** import infrastructure directly. They depend on interfaces (e.g., `AgentSpawner`, `TicketStore`, `ProjectStore`) that infrastructure implements and injects.

```typescript
// domain/agents/types.ts
export interface AgentConfig {
  name: string;
  command: string;
  flags: string[];
  model: string;
  mode: 'interactive' | 'non-interactive';
}

export interface AgentRun {
  id: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed' | 'killed';
  startedAt: number;
  exitCode?: number;
}

export interface AgentSpawner {
  spawn(config: AgentConfig): Promise<AgentRun>;
  kill(runId: string): Promise<void>;
  list(): AgentRun[];
}

export interface AgentStore {
  saveConfig(config: AgentConfig): void;
  getConfigs(): AgentConfig[];
  saveRun(run: AgentRun): void;
  getRuns(limit?: number): AgentRun[];
}
```

### Infrastructure (I/O and adapters)

Implements domain interfaces with real I/O. Each infrastructure module provides a concrete class that satisfies a domain contract.

| Module | Implements | Technology |
|--------|-----------|------------|
| `db/sqlite.ts` | `TicketStore`, `ProjectStore`, `AgentStore` | better-sqlite3 |
| `agents/copilot-spawner.ts` | `AgentSpawner` | child_process / node-pty |
| `agents/claude-spawner.ts` | `AgentSpawner` | child_process / node-pty |
| `terminal/launcher.ts` | `TerminalLauncher` | wt.exe (Windows Terminal) |
| `terminal/pty-manager.ts` | `PtyManager` | node-pty (ConPTY) |
| `server/routes.ts` | HTTP API | Express |
| `server/websocket.ts` | Real-time events | ws |
| `sdp/bridge.ts` | `SdpReader` | fs (reads `.sdp/plans/`) |
| `logging/logger.ts` | `Logger` | pino |

**Dependency direction:** Infrastructure imports domain types. Domain never imports infrastructure.

### Frontend (SPA)

Single-page application served from `public/` (or a built `dist/`). Communicates with the server exclusively via HTTP REST and WebSocket.

| Component | Technology | Purpose |
|-----------|-----------|---------|
| SPA shell | HTML/CSS/JS | Full-page cockpit layout (sidebar, terminal, tickets, log) |
| Terminal | xterm.js + addons (fit, web-links) | In-browser PTY rendering |
| Reactive controls | WebSocket client | Auto-updating lists (tickets, projects, agents) |
| Icon sidebar | CSS | Navigation: Home, Skills, Tools, Projects, Settings |
| Modal system | CSS/JS | Overlay panels for admin features |

## Dependency Rules

```
Frontend ──HTTP/WS──▶ Infrastructure ──implements──▶ Domain interfaces
                      Infrastructure ──imports────▶ Domain types
                      Domain ──imports────▶ nothing (pure)
```

1. **Domain is dependency-free.** It defines interfaces and logic. It never reaches out to databases, file systems, or networks.
2. **Infrastructure implements domain interfaces.** Concrete classes satisfy contracts defined in domain `types.ts` files.
3. **Dependency injection at composition root.** `src/index.ts` wires infrastructure implementations into domain consumers. No module imports singletons.
4. **Frontend is decoupled.** It only knows the HTTP/WebSocket API contract. It could be replaced entirely without touching server code.

## Project Structure

```
src/
├── index.ts                    ← composition root (wiring)
├── agents/
│   ├── types.ts                ← AgentSpawner, AgentConfig, AgentRun, AgentStore
│   ├── copilot-spawner.ts      ← implements AgentSpawner for Copilot CLI
│   ├── copilot-spawner.test.ts
│   ├── claude-spawner.ts       ← implements AgentSpawner for Claude Code
│   └── claude-spawner.test.ts
├── tickets/
│   ├── types.ts                ← TicketStore, Ticket, TicketStage
│   └── ticket-service.ts       ← domain logic (stage transitions, validation)
├── projects/
│   ├── types.ts                ← ProjectStore, Project
│   └── project-service.ts
├── skills/
│   ├── types.ts                ← SkillStore, Skill
│   └── skill-publisher.ts      ← publishes to ~/.copilot/agents/ etc.
├── tools/
│   └── types.ts
├── config/
│   ├── types.ts                ← AppConfig
│   ├── defaults.ts             ← baked-in defaults
│   └── loader.ts               ← merges defaults + camelot.config.json
├── daily-stream/
│   ├── types.ts
│   └── stream-service.ts
├── db/
│   ├── types.ts                ← re-exports store interfaces
│   ├── sqlite.ts               ← better-sqlite3 implementation
│   └── sqlite.test.ts
├── server/
│   ├── types.ts
│   ├── routes.ts               ← Express route handlers
│   ├── routes.test.ts
│   └── websocket.ts            ← ws event handling
├── terminal/
│   ├── types.ts                ← TerminalLauncher, PtyManager
│   ├── launcher.ts             ← wt.exe integration
│   ├── pty-manager.ts          ← node-pty session management
│   └── pty-manager.test.ts
├── sdp/
│   ├── types.ts
│   └── bridge.ts               ← reads .sdp/plans/
└── logging/
    ├── types.ts                ← Logger interface
    └── pino-logger.ts          ← pino implementation
public/
├── index.html
├── styles.css
└── app.js                      ← SPA, WebSocket client, xterm.js setup
```

## Data Flow

### HTTP API

REST endpoints for CRUD operations. All responses are JSON.

```
POST   /api/projects          → create project
GET    /api/projects          → list projects
DELETE /api/projects/:id      → delete project

POST   /api/tickets           → create ticket
GET    /api/tickets           → list tickets
PATCH  /api/tickets/:id       → update ticket (stage, etc.)
DELETE /api/tickets/:id       → delete ticket

GET    /api/agents            → list agent configurations
POST   /api/agents            → create/update agent config
POST   /api/agents/spawn      → spawn agent run
DELETE /api/agents/runs/:id   → kill agent run
GET    /api/agents/runs       → list active runs

GET    /api/skills            → list skills
POST   /api/skills            → create/update skill
POST   /api/skills/publish    → publish to local filesystem

GET    /api/config            → get app settings
PATCH  /api/config            → update settings
```

### WebSocket Events

Bidirectional real-time channel on the same port (`:1187`). Server pushes state changes; client sends terminal input.

```
Server → Client:
  ticket:created    { ticket }
  ticket:updated    { ticket }
  ticket:deleted    { id }
  project:created   { project }
  project:deleted   { id }
  agent:output      { runId, data }        ← stdout/stderr stream
  agent:started     { run }
  agent:exited      { runId, exitCode }
  terminal:output   { sessionId, data }    ← PTY output for xterm.js

Client → Server:
  terminal:input    { sessionId, data }    ← keystrokes to PTY
  terminal:resize   { sessionId, cols, rows }
  terminal:open     { agentName, projectId?, ticketId? }
  terminal:close    { sessionId }
```

### SQLite Persistence

Single `camelot.db` file. Tables mirror domain entities.

```sql
agents        (id, name, command, flags, model, mode)
agent_runs    (id, agent_id, status, started_at, ended_at, exit_code)
projects      (id, name, location)
tickets       (id, title, stage, project_id, created_at, updated_at)
skills        (id, name, path, content)
tools         (id, name, path, content)
config        (key, value)
daily_stream  (id, ticket_id, action, timestamp, detail)
```

### Request Lifecycle

```
Browser click "Add Ticket"
  → POST /api/tickets { title: "Fix login" }
    → routes.ts validates, calls ticketService.create(...)
      → ticketService uses injected TicketStore.save(ticket)
        → sqlite.ts inserts row
      → ticketService returns ticket
    → routes.ts responds 201 { ticket }
    → websocket.ts broadcasts ticket:created { ticket }
  → Browser receives WS event, updates ticket list reactively
```

### Terminal Lifecycle

```
Browser clicks "New Terminal"
  → WS: terminal:open { agentName: "copilot" }
    → pty-manager spawns: copilot -i --yolo
    → PTY stdout → WS: terminal:output { sessionId, data }
  → xterm.js renders output
  → User types → WS: terminal:input { sessionId, data }
    → pty-manager writes to PTY stdin
  → Browser closes tab → WS: terminal:close { sessionId }
    → pty-manager kills PTY process
```

## Extension Points

### Adding a New Agent

1. Define configuration in the admin UI (or seed in `defaults.ts`)
2. Implement `AgentSpawner` interface if the agent needs custom spawn logic
3. Register in the composition root (`index.ts`)
4. The spawner handles CLI differences; the rest of the system treats all agents uniformly

### Adding a New Skill

1. Create skill file via the Skills admin UI
2. Skill is stored in SQLite and on the filesystem
3. "Publish" copies it to the appropriate agent config directory (`~/.copilot/agents/`, etc.)

### Adding a New Store / Data Source

1. Define a domain interface in the relevant `types.ts`
2. Implement it (SQLite, file system, API — whatever)
3. Inject at the composition root
4. Domain logic doesn't change

### Adding New UI Panels

1. Add a sidebar icon + modal route
2. Implement the panel's HTML/JS
3. Connect to existing HTTP API / WebSocket events
4. The modal system (#30) provides consistent overlay behaviour

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Node.js + TypeScript | Type safety, ecosystem, Windows support |
| HTTP server | Express | Mature, minimal, well-understood |
| Database | better-sqlite3 | Synchronous API (simpler code), zero-config, single file |
| WebSocket | ws | Lightweight, no framework lock-in |
| Terminal backend | node-pty (ConPTY) | Same approach as VS Code; full Windows terminal emulation |
| Terminal frontend | xterm.js | Industry standard browser terminal; addon ecosystem |
| Testing | Vitest | Fast, TypeScript-native, Jest-compatible API |
| Logging | pino | Low overhead, structured JSON, log rotation via pino-roll |
| Architecture | Contract-first DI | Testable (inject mocks), swappable (change DB without touching domain), clear boundaries |
| UI approach | Vanilla SPA | No framework overhead for a cockpit app; direct DOM control |
| Default port | 1187 | Avoids common conflicts (3000, 8080, etc.) |

## Design Principles

1. **Contract-first.** Interfaces before implementations. Always.
2. **Inject everything.** No module reaches out for its own dependencies.
3. **Tests alongside source.** `foo.ts` → `foo.test.ts`, same directory.
4. **No `any`.** Strict TypeScript. Use `unknown` + type guards.
5. **Small functions.** Under 30 lines. Extract early.
6. **Explicit errors.** `Result<T, E>` or typed throws. No silent failures.
7. **Reactive by default.** Every mutation broadcasts via WebSocket. The UI never polls.
