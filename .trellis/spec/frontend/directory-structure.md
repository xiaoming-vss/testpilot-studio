# Directory Structure

## Root Structure

```text
src/
  app/                 Shell layout, providers, router, global styles
  features/            Product domains
  shared/              Reusable components, API request wrapper, stores, utils
  services/            API facade
  utils/               Cross-feature formatting and payload helpers
```

## Feature Layout Pattern

A feature normally contains some of:

```text
feature-name/
  api/
  components/
  config/
  hooks/
  pages/
  store/
  styles/
  types.ts
  utils/
```

Follow the local feature's existing structure. Do not introduce a new folder style for a small change.

## Current Feature Domains

- `ai-testing`: AI skill library, case generation tasks, requirement analysis.
- `api-automation`: API collections, environments, case editor utilities.
- `base-services`: LLM and Zentao connection management.
- `projects`: Projects, sprints and active project context.
- `requirements`: Requirement forms and document preview.
- `test-cases`: Functional test suites and cases.
- `testing`: Unified testing tab container.
- `ui-automation`: UI suites, run config and case editor.

## Routing

Primary route wiring is in `src/app/layouts/AppShell.tsx`. When adding a route, add the route-level page under the owning feature `pages/` folder and update sidebar selected-key logic if needed.

## Styles

- Global shell/workbench styles: `src/app/styles/*.css`.
- Feature-level styles: `src/features/<feature>/styles/index.css`.
- Shared page frame styles: `src/shared/styles/page-frame.css`.

Prefer page/feature-scoped classes for visual experiments to avoid cross-page regressions.
