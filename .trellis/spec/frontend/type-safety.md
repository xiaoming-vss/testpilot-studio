# Type Safety

## TypeScript Style

- Use explicit form value types for Ant Design forms.
- Use existing domain types from feature `types.ts` files or `@/services/api`.
- Avoid `any` unless adapting untyped third-party data at a boundary.
- Prefer type guards for filtered arrays.

```ts
const ids = items.map(getId).filter((value): value is string => Boolean(value))
```

## API Shape Normalization

The backend often exposes both camelCase and snake_case fields. Existing utilities normalize IDs and dates:

- `normalizeRequirementId`
- `normalizeFunctionTestSuiteId`
- `pickCreatedAt`
- `pickUpdatedAt`
- `formatTime`

Use these helpers instead of hand-reading only one field spelling.

## Payload Construction

Use helper functions when create/update payloads need trimming or diffing. Build create payloads from required form fields, build update payloads by comparing current record and form values, and do not send unchanged secret fields.

## Runtime Data

Do not assume optional API fields exist. Use fallbacks for names, IDs and timestamps in UI.

## Imports

Use the project alias `@/` for source imports. Keep relative imports for neighboring feature components when already used locally.

## Real Code Examples

- `src/utils/format.tsx` contains normalization helpers for IDs and timestamps.
- `src/utils/updatePayload.ts` contains payload update helpers.
- `src/features/base-services/components/LlmConnectionsPanel.tsx` demonstrates create/update payload builders with string trimming and diffing.
- `src/features/test-cases/pages/TestCasePage.tsx` demonstrates type guards when filtering normalized IDs.
