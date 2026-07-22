# Quality Guidelines

## Verification

For most frontend changes run:

```bash
npm run type-check
```

For layout, routing, API contract or shared utility changes run:

```bash
npm run build
```

For broad changes or before handoff run:

```bash
npm run verify
```

`npm run build` may report a Vite chunk-size warning. That warning currently exists in the project and is not by itself a failure.

## Change Discipline

- Keep edits scoped to the requested feature/page.
- Do not reformat unrelated files.
- Do not revert user changes unless explicitly asked.
- When worktree is dirty, inspect only the files you need and avoid broad resets.
- Prefer focused CSS overrides in the relevant feature style file over global CSS changes.

## User-Facing Feedback

Use `message` from `@/shared/utils/feedback`, not direct `antd` message imports in new code.

## Error Handling

Use `getErrorMessage(error)` from `@/utils/format` for API errors shown to users.

## Empty and Loading States

Follow existing patterns: `Empty.PRESENTED_IMAGE_SIMPLE`, helpful empty text, a primary action when creation is possible, and `Alert` for load errors and warnings.

## Styling Review

Before finishing visual changes, check that text does not overflow, buttons and pagination do not overlap content, contrast is acceptable, and scoped selectors do not unintentionally change other pages.

## Real Code Examples

- `src/shared/utils/feedback.ts` wraps Ant Design feedback APIs; use it for `message`.
- `src/shared/api/request.ts` centralizes HTTP request behavior.
- `src/app/providers/ThemeProvider.tsx` defines Ant Design tokens for light/dark mode.
- `src/app/styles/workbench.css` has global shell styles; prefer feature styles unless changing global layout deliberately.
