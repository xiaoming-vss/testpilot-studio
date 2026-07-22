export type Project = {
  projectId?: string
  project_id?: string
  userId?: string
  user_id?: string
  name: string
  description?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type Sprint = {
  sprintId?: string
  sprint_id?: string
  projectId?: string
  project_id?: string
  name: string
  description?: string
  status: 'running' | 'completed'
  startTime?: string
  start_time?: string
  endTime?: string
  end_time?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type SprintCreatePayload = {
  name: string
  description?: string
  startTime: string
  endTime?: string
}

export type ProjectUpdatePayload = Partial<Pick<Project, 'name' | 'description'>>

export type SprintUpdatePayload = Partial<{
  name: string
  description: string
  status: Sprint['status']
  startTime: string
  endTime: string
}>

export type SprintDailyMetricsTestStats = {
  total?: number
  executed?: number
  pending?: number
  unexecuted?: number
  success?: number
  failed?: number
  passed?: number
}

export type SprintDailyMetricsBugStats = {
  total?: number
  fatal?: number
  serious?: number
  severe?: number
  normal?: number
  suggestion?: number
  hint?: number
  resolved?: number
  unresolved?: number
}

export type SprintDailyMetricsSnapshot = {
  sprintId?: string
  sprint_id?: string
  snapshotDate?: string
  snapshot_date?: string
  date?: string
  projectId?: string
  project_id?: string
  totalCases?: number
  total_cases?: number
  functional?: SprintDailyMetricsTestStats
  function?: SprintDailyMetricsTestStats
  functionTesting?: SprintDailyMetricsTestStats
  function_testing?: SprintDailyMetricsTestStats
  api?: SprintDailyMetricsTestStats
  ui?: SprintDailyMetricsTestStats
  bug?: SprintDailyMetricsBugStats
  bugs?: SprintDailyMetricsBugStats
  functionTotal?: number
  function_total?: number
  apiTotal?: number
  api_total?: number
  uiTotal?: number
  ui_total?: number
  bugTotal?: number
  bug_total?: number
  bugResolved?: number
  bug_resolved?: number
  bugUnresolved?: number
  bug_unresolved?: number
  bugFatal?: number
  bug_fatal?: number
  bugSevere?: number
  bug_severe?: number
  bugNormal?: number
  bug_normal?: number
  bugHint?: number
  bug_hint?: number
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}
