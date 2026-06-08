export type SprintTestOverviewItem = {
  total: number
  executed: number
  unexecuted: number
  success: number
  failed: number
}

export type SprintTestOverview = {
  totalCases: number
  functional: SprintTestOverviewItem
  api: SprintTestOverviewItem
  ui: SprintTestOverviewItem
}

export type SprintBugOverview = {
  total: number
  fatal: number
  severe: number
  normal: number
  hint: number
  resolved: number
  unresolved: number
}

export const sprintTestOverviewMock: SprintTestOverview = {
  totalCases: 286,
  functional: {
    total: 124,
    executed: 96,
    unexecuted: 28,
    success: 84,
    failed: 12,
  },
  api: {
    total: 102,
    executed: 88,
    unexecuted: 14,
    success: 73,
    failed: 15,
  },
  ui: {
    total: 60,
    executed: 41,
    unexecuted: 19,
    success: 33,
    failed: 8,
  },
}

export const sprintBugOverviewMock: SprintBugOverview = {
  total: 37,
  fatal: 2,
  severe: 7,
  normal: 18,
  hint: 10,
  resolved: 24,
  unresolved: 13,
}
