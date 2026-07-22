# State Management

## Server State

Server data belongs in TanStack React Query, not Zustand or long-lived local state. This includes projects, requirements, test suites, AI tasks, LLM connections and Zentao connections.

## Client State

Use local React state for UI-only state: current page/page size, drawer/modal open state, currently editing record, and temporary form context.

## Shared Client State

Use Zustand only for cross-page/session UI state. Existing stores include:

- `useWorkbenchStore` for active project.
- `useThemeStore` for theme mode.
- `useTestCasePageStore` for functional test page filter memory.
- `useAuthStore` for auth state.

Do not put server response objects in Zustand unless there is a clear project-level pattern.

## URL State

Some pages persist filter state in query params. Preserve unrelated params when navigating, use `replace: true` for automatic sync, and reset pagination after scope/filter changes.

## Real Code Examples

- `src/features/projects/store/workbench.store.ts` stores active project UI state.
- `src/shared/store/theme.store.ts` stores light/dark mode.
- `src/features/test-cases/store/testCasePage.store.ts` stores remembered functional test page filters.
- Server lists and detail records stay in React Query inside page/components such as `LlmConnectionsPanel.tsx`.
