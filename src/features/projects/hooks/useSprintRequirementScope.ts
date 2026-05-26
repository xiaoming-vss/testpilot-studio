import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type Requirement, type Sprint } from '@/services/api'
import { normalizeRequirementId, normalizeSprintId, pickCreatedAt } from '@/utils/format'

type ProjectScopedSelection = {
  projectId?: string
  value?: string | null
}

type UseSprintRequirementScopeOptions = {
  activeProjectId?: string
  includeAllSprintOption?: boolean
  includeAllRequirementOption?: boolean
}

function pickLatestItem<T>(items: T[], getTime: (item: T) => string | undefined) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(getTime(left) ?? 0).getTime()
    const rightTime = new Date(getTime(right) ?? 0).getTime()
    return rightTime - leftTime
  })[0]
}

export function useSprintRequirementScope(options: UseSprintRequirementScopeOptions) {
  const { activeProjectId, includeAllSprintOption = false, includeAllRequirementOption = false } = options
  const [sprintSelection, setSprintSelection] = useState<ProjectScopedSelection>({})
  const [requirementSelection, setRequirementSelection] = useState<ProjectScopedSelection>({})

  const sprintsQuery = useQuery({
    queryKey: ['sprints', activeProjectId],
    queryFn: () => api.getSprints(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })

  const sprints = useMemo(() => sprintsQuery.data ?? [], [sprintsQuery.data])
  const latestSprint = useMemo(() => pickLatestItem<Sprint>(sprints, pickCreatedAt), [sprints])
  const currentSprintSelection = sprintSelection.projectId === activeProjectId ? sprintSelection.value : undefined
  const resolvedSelectedSprintId =
    currentSprintSelection === undefined
      ? latestSprint
        ? normalizeSprintId(latestSprint)
        : undefined
      : currentSprintSelection ?? undefined

  const requirementsQuery = useQuery({
    queryKey: ['requirements', resolvedSelectedSprintId],
    queryFn: () => api.getRequirements(resolvedSelectedSprintId!),
    enabled: Boolean(resolvedSelectedSprintId),
  })

  const requirements = useMemo(() => requirementsQuery.data ?? [], [requirementsQuery.data])
  const latestRequirement = useMemo(() => pickLatestItem<Requirement>(requirements, pickCreatedAt), [requirements])
  const currentRequirementSelection = requirementSelection.projectId === activeProjectId ? requirementSelection.value : undefined
  const resolvedSelectedRequirementId =
    currentRequirementSelection === undefined
      ? latestRequirement
        ? normalizeRequirementId(latestRequirement)
        : undefined
      : currentRequirementSelection ?? undefined

  const sprintFilterOptions = useMemo(
    () => [
      ...(includeAllSprintOption ? [{ label: '全部迭代', value: 'all' }] : []),
      ...sprints.map((sprint) => ({ label: sprint.name, value: normalizeSprintId(sprint) })),
    ],
    [includeAllSprintOption, sprints],
  )

  const requirementFilterOptions = useMemo(
    () => [
      ...(includeAllRequirementOption ? [{ label: '全部需求', value: 'all' }] : []),
      ...requirements.map((requirement) => ({ label: requirement.name, value: normalizeRequirementId(requirement) })),
    ],
    [includeAllRequirementOption, requirements],
  )

  function selectSprint(value?: string | null) {
    setSprintSelection({
      projectId: activeProjectId,
      value,
    })
    setRequirementSelection({
      projectId: activeProjectId,
      value: undefined,
    })
  }

  function selectRequirement(value?: string | null) {
    setRequirementSelection({
      projectId: activeProjectId,
      value,
    })
  }

  return {
    currentRequirementSelection,
    currentSprintSelection,
    requirementFilterOptions,
    requirements,
    requirementsQuery,
    resolvedSelectedRequirementId,
    resolvedSelectedSprintId,
    selectRequirement,
    selectSprint,
    sprintFilterOptions,
    sprints,
    sprintsQuery,
  }
}
