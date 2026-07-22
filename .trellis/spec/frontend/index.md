# Frontend Development Guidelines

This project is **testpilot-studio**, a single-page frontend application built with React 19, TypeScript, Vite 8, Ant Design 6, React Router 7, TanStack React Query 5, and Zustand 5.

## Required Reading Before Frontend Edits

| Guide | Description |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | How `src/` is organized by app/shared/features |
| [Component Guidelines](./component-guidelines.md) | Page, panel, drawer, card and Ant Design usage patterns |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks and data fetching patterns |
| [State Management](./state-management.md) | React Query, Zustand and local state boundaries |
| [Quality Guidelines](./quality-guidelines.md) | Verification commands and change discipline |
| [Type Safety](./type-safety.md) | API payload normalization and TypeScript conventions |

## Project Commands

```bash
npm run type-check
npm run build
npm run lint
npm run verify
```

`npm run build` already runs `tsc -b` before Vite build. Build output goes to `dist/`.

## High-Level Architecture

- `src/app/` owns shell layout, routing, providers and global app styles.
- `src/features/` owns product domains such as projects, testing, AI testing, base services and auth.
- `src/shared/` owns reusable components, utility functions, API request wrapper and app-wide stores.
- `src/services/api.ts` is the broad API facade used by many features.
- `src/utils/format.tsx` and `src/utils/updatePayload.ts` contain cross-feature formatting and payload helpers.

## UI Design Baseline

The product is a dense operational/testing workspace, not a marketing site. Prefer compact panels, tables, cards and drawers. Avoid decorative-only gradients and hero-style layouts in workbench pages. When changing theme-like styling, scope carefully unless the request is explicitly global.
