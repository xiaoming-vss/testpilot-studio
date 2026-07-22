# Component Guidelines

## Page and Panel Pattern

Most workbench pages use:

```tsx
<div className="workbench-page feature-page">
  <section className="workbench-project-toolbar ...">...</section>
  <section className="workbench-panel ...">...</section>
</div>
```

Follow the local page pattern instead of converting styles wholesale.

## Ant Design Usage

Use Ant Design primitives for common controls: `Button`, `Select`, `Form`, `Drawer`, `Modal`, `Popconfirm`, `Pagination`, `Empty`, `Alert`, `Card`, `Tag`, and `Tooltip`.

Use icons from `@ant-design/icons`. Keep destructive actions inside `Popconfirm`. Use `Tooltip` plus ellipsis for long text where existing cards do that.

## Page Components

Route-level components should own query/mutation orchestration, delegate substantial forms/drawers into `components/`, keep navigation handlers near the page, and reset pagination when filters change.

## Drawers and Forms

Existing drawers use vertical Ant Design forms and `Form.useForm<T>()`.

- Keep form value types explicit.
- Trim user-entered strings before sending create/update payloads.
- For edit drawers, blank secret fields such as API keys should mean "do not change" unless the local API contract says otherwise.

## Cards and Lists

The product is an operational testing workspace. Cards should be compact, stable and scannable. Avoid forcing cards to fill large vertical space unless the page needs equal-height dashboards.

## Styling Scope

Prefer feature page scope, e.g. `.base-services-page ...` or `.ai-testing-page ...`. Use global shell classes only when the user explicitly requests a global layout change. `workbench.css` has broad shell/sidebar/header overrides and may win due to ordering.

## Real Code Examples

- `src/features/base-services/components/LlmConnectionsPanel.tsx` shows the standard list page pattern: React Query list query, create/edit drawer state, detail drawer state, `Card` grid, `Pagination`, `Popconfirm`, and mutation invalidation.
- `src/features/test-cases/pages/TestCasePage.tsx` shows scoped filters, URL search param synchronization, requirement/sprint scope hooks, paged cards and modal/drawer workflows.
- `src/features/ai-testing/pages/RequirementAnalysisTaskPage.tsx` shows AI task cards, run/edit/delete actions and task drawer composition.
- `src/app/layouts/AppShell.tsx` owns global navigation and route registration; update selected-key logic there when adding a top-level route.
