# Contributing to Camelot

## Coding Standards

### Contract-First Design

Every module exposes a **TypeScript interface** before implementation. Interfaces live alongside their implementations. This keeps the codebase composable and testable.

```typescript
// agents/types.ts — contracts first
export interface AgentSpawner {
  spawn(config: AgentConfig): Promise<AgentRun>;
  kill(runId: string): Promise<void>;
  list(): AgentRun[];
}

// agents/copilot-spawner.ts — implementation
export class CopilotSpawner implements AgentSpawner { ... }
```

### Project Structure

```
src/
├── agents/
│   ├── types.ts              — interfaces/contracts
│   ├── copilot-spawner.ts    — implementation
│   ├── copilot-spawner.test.ts — tests alongside source
│   ├── claude-spawner.ts
│   └── claude-spawner.test.ts
├── db/
│   ├── types.ts
│   ├── sqlite.ts
│   └── sqlite.test.ts
├── server/
│   ├── types.ts
│   ├── routes.ts
│   └── routes.test.ts
├── terminal/
│   ├── types.ts
│   ├── launcher.ts
│   └── launcher.test.ts
└── index.ts
```

### Rules

1. **Interfaces before implementations.** Define the contract in `types.ts`, implement separately. No god files.

2. **Tests alongside source.** `foo.ts` → `foo.test.ts` in the same directory. No separate `__tests__/` folder.

3. **Dependency injection.** Modules receive their dependencies via constructor/factory — never import singletons directly. This makes testing trivial.

4. **No `any`.** Use `unknown` + type guards if the type isn't known. TypeScript strict mode enabled.

5. **Explicit error handling.** Functions that can fail return `Result<T, E>` or throw typed errors. No silent swallowing.

6. **Small functions.** If it's over 30 lines, it probably does too much. Extract.

7. **Named exports only.** No default exports — makes refactoring and imports predictable.

8. **Const by default.** Use `const` everywhere. `let` only when mutation is genuinely needed.

### Testing

- **Framework:** Vitest (fast, TypeScript-native, compatible with Jest API)
- **Pattern:** Arrange → Act → Assert
- **Mocking:** Inject interfaces, provide test implementations. Avoid mocking libraries where possible.
- **Coverage:** Not a metric to chase, but critical paths must be tested.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx vitest src/agents/copilot-spawner.test.ts
```

### Naming

- Files: `kebab-case.ts`
- Interfaces/Types: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Test descriptions: plain English, describe what it does

### Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- One concern per commit
- PR descriptions reference issue numbers
