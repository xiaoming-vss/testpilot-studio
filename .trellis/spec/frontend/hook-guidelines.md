# Hook Guidelines

## Data Fetching

Use TanStack React Query for server state.

```tsx
const query = useQuery({
  queryKey: ['resourceName', id],
  queryFn: () => api.getResource(id),
  enabled: Boolean(id),
})
```

Use mutations for writes and invalidate affected queries on success.

```tsx
const mutation = useMutation({
  mutationFn: apiCall,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resourceName'] }),
  onError: (error) => message.error(getErrorMessage(error)),
})
```

## Query Keys

Query keys should include every filter/scope that affects the result. Keep keys stable and array-based. Invalidate broad keys when multiple scoped caches can be affected.

## Custom Hooks

Prefer existing hooks over duplicating project/sprint/requirement loading logic:

- `useActiveProject`
- `useProjectRequirements`
- `useSprintRequirementScope`
- `useCurrentUser`

## Effects

Use `useEffect` for synchronization only when needed: persisting page filter state to URL/store, resetting pagination on filter changes, or mirroring external state into form state when opening drawers. Use `useMemo` for data derivation.

## Real Code Examples

- `src/features/projects/hooks/useActiveProject.ts` centralizes active project selection.
- `src/features/projects/hooks/useProjectRequirements.ts` gathers project requirements and lookup maps.
- `src/features/projects/hooks/useSprintRequirementScope.ts` coordinates sprint and requirement filters.
- `src/features/auth/hooks/useCurrentUser.ts` wraps current auth/user context.
