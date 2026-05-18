import { useAuthStore } from '../store/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

export type User = {
  userId?: string
  user_id?: string
  name: string
  nickname?: string
  email?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

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

export type Requirement = {
  requirementId?: string
  requirement_id?: string
  sprintId?: string
  sprint_id?: string
  name: string
  description?: string
  status: 'draft' | 'in_progress' | 'completed'
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type LoginResponse = {
  accessToken: string
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

export type RequirementCreatePayload = {
  name: string
  description?: string
}

export type RequirementUpdatePayload = Partial<Pick<Requirement, 'name' | 'description' | 'status'>>

export type ApiCollection = {
  collectionId?: string
  collection_id?: string
  requirementId?: string
  requirement_id?: string
  name: string
  description?: string
  version?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type UiTestSuite = {
  suiteId?: string
  requirementId?: string
  requirement_id?: string
  name: string
  description?: string
  headless?: boolean
  slowMoMs?: number
  viewportWidth?: number
  viewportHeight?: number
  defaultStepTimeoutMs?: number
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type UiTestCase = {
  caseId?: string
  suiteId?: string
  suite_id?: string
  name: string
  description?: string
  enabled?: boolean
  orderNo?: number
  stepsJson?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type UiTestCaseDebugRunPayload = {
  headless?: boolean
  slowMoMs?: number
  viewportWidth?: number
  viewportHeight?: number
  defaultStepTimeoutMs?: number
}

export type UiTestCaseRunStepResult = {
  orderNo?: number
  stepName?: string
  keyword?: string
  status?: 'pending' | 'claimed' | 'running' | 'success' | 'failed' | 'error' | 'canceled' | 'skipped' | string
  success?: boolean
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  actualValue?: string
  screenshotPath?: string
  errorMessage?: string
}

export type UiTestCaseRun = {
  runId?: string
  uiTestCaseRunId?: string
  caseId?: string
  status?: 'pending' | 'claimed' | 'running' | 'success' | 'failed' | 'error' | 'canceled' | string
  success?: boolean
  errorMessage?: string
  currentUrl?: string
  tracePath?: string
  durationMs?: number
  stepResults?: UiTestCaseRunStepResult[]
  snapshot?: {
    browser?: unknown
    options?: unknown
  }
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type UiTestSuiteRunItem = {
  itemId?: string
  suiteRunId?: string
  caseId?: string
  caseName?: string
  orderNo?: number
  status?: 'pending' | 'running' | 'success' | 'failed' | 'error' | 'skipped' | string
  continueOnFailure?: boolean
  currentUrl?: string
  errorMessage?: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  snapshot?: unknown
  stepResults?: UiTestCaseRunStepResult[]
}

export type UiTestSuiteRunSummary = {
  suiteRunId?: string
  suiteId?: string
  status?: 'pending' | 'claimed' | 'running' | 'success' | 'failed' | 'error' | 'canceled' | string
  totalCount?: number
  successCount?: number
  failedCount?: number
  errorCount?: number
  skippedCount?: number
  currentUrl?: string
  tracePath?: string
  errorMessage?: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  snapshot?: unknown
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type UiTestSuiteRunReport = UiTestSuiteRunSummary & {
  items?: UiTestSuiteRunItem[]
}

export type ApiEnvironment = {
  environmentId?: string
  projectId?: string
  name: string
  baseUrl: string
  description?: string
  isDefault?: boolean
  createdAt?: string
  updatedAt?: string
}

export type ApiEnvironmentVar = {
  envVarId?: string
  environmentId?: string
  varKey: string
  value: string
  description?: string
  isSecret?: boolean
  createdAt?: string
  updatedAt?: string
}

export type ApiCase = {
  caseId?: string
  case_id?: string
  collectionId?: string
  collection_id?: string
  name: string
  description?: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  urlTemplate: string
  priority?: 'P0' | 'P1' | 'P2' | 'P3'
  bodyJson?: string
  bodyText?: string
  bodyType?: 'json' | 'form' | 'raw' | 'none'
  headersJson?: string
  queryJson?: string
  tagsJson?: string
  enabled?: boolean
  continueOnFailure?: boolean
  timeoutMs?: number
  orderNo?: number
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type ApiAssertSource = 'status_code' | 'header' | 'body_jsonpath' | 'body_text'

export type ApiAssertComparator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'not_contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'exists'
  | 'regex'

export type ApiAssertRule = {
  assertRuleId?: string
  assert_rule_id?: string
  caseId?: string
  case_id?: string
  name: string
  enabled: boolean
  orderNo?: number
  assertSource: ApiAssertSource
  targetExpr?: string
  comparator: ApiAssertComparator
  expectedValue?: string
  description?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type ApiExtractRuleSource = 'header' | 'body_jsonpath' | 'body_text' | 'status_code'

export type ApiExtractRuleTargetScope = 'run'

export type ApiExtractRule = {
  extractRuleId?: string
  extract_rule_id?: string
  caseId?: string
  case_id?: string
  name: string
  enabled: boolean
  orderNo?: number
  source: ApiExtractRuleSource
  sourceExpr?: string
  varKey: string
  defaultValue?: string
  targetScope: ApiExtractRuleTargetScope
  description?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type CreateApiCollectionPayload = {
  name: string
  description?: string
}

export type UpdateApiCollectionPayload = Partial<CreateApiCollectionPayload>

export type CreateUiTestSuitePayload = {
  name: string
  description?: string
  headless?: boolean
  slowMoMs?: number
  viewportWidth?: number
  viewportHeight?: number
  defaultStepTimeoutMs?: number
}

export type UpdateUiTestSuitePayload = Partial<CreateUiTestSuitePayload>

export type CreateUiTestCasePayload = {
  name: string
  description?: string
  enabled?: boolean
  orderNo?: number
  stepsJson?: string
}

export type UpdateUiTestCasePayload = Partial<CreateUiTestCasePayload>

export type CreateApiEnvironmentPayload = {
  name: string
  baseUrl: string
  description?: string
  isDefault?: boolean
}

export type UpdateApiEnvironmentPayload = Partial<CreateApiEnvironmentPayload>

export type CreateApiEnvironmentVarPayload = {
  varKey: string
  value: string
  description?: string
  isSecret?: boolean
}

export type UpdateApiEnvironmentVarPayload = Partial<CreateApiEnvironmentVarPayload>

export type CreateApiCasePayload = {
  name: string
  description?: string
  method: ApiCase['method']
  urlTemplate: string
  priority?: ApiCase['priority']
  bodyJson?: string
  bodyText?: string
  bodyType?: ApiCase['bodyType']
  headersJson?: string
  queryJson?: string
  tagsJson?: string
  enabled?: boolean
  continueOnFailure?: boolean
  timeoutMs?: number
  orderNo?: number
}

export type UpdateApiCasePayload = Partial<CreateApiCasePayload>

export type CreateApiAssertRulePayload = {
  name: string
  enabled: boolean
  orderNo?: number
  assertSource: ApiAssertSource
  targetExpr?: string
  comparator: ApiAssertComparator
  expectedValue?: string
  description?: string
}

export type UpdateApiAssertRulePayload = Partial<CreateApiAssertRulePayload>

export type CreateApiExtractRulePayload = {
  name: string
  enabled: boolean
  orderNo?: number
  source: ApiExtractRuleSource
  sourceExpr?: string
  varKey: string
  defaultValue?: string
  targetScope: ApiExtractRuleTargetScope
  description?: string
}

export type UpdateApiExtractRulePayload = Partial<CreateApiExtractRulePayload>

export type RunApiCasePayload = {
  environmentId: string
}

export type RunApiCollectionPayload = {
  environmentId: string
}

export type ApiCaseRunRequestSnapshot = {
  url?: string
  method?: string
  headersJson?: string
  queryJson?: string
  bodyType?: string
  body?: string
}

export type ApiCaseRunResponseSnapshot = {
  statusCode?: number
  headersJson?: string
  body?: string
}

export type ApiCaseRunExtractResult = {
  extractRuleId?: string
  name?: string
  varKey?: string
  success?: boolean
  usedDefault?: boolean
  value?: string
  errorMessage?: string
}

export type ApiCaseRunAssertResult = {
  assertRuleId?: string
  name?: string
  success?: boolean
  assertSource?: ApiAssertSource
  targetExpr?: string
  comparator?: ApiAssertComparator
  expectedValue?: string
  actualValue?: string
  errorMessage?: string
}

export type ApiCaseRunResult = {
  caseId?: string
  environmentId?: string
  durationMs?: number
  success?: boolean
  errorMessage?: string
  request?: ApiCaseRunRequestSnapshot
  response?: ApiCaseRunResponseSnapshot
  runtimeVarsJson?: string
  extractResults?: ApiCaseRunExtractResult[]
  assertResults?: ApiCaseRunAssertResult[]
}

export type ApiCollectionRunItem = {
  itemId?: string
  caseId?: string
  caseRunId?: string
  caseName?: string
  orderNo?: number
  status?: 'pending' | 'running' | 'success' | 'failed' | 'error' | 'skipped'
  continueOnFailure?: boolean
  errorMessage?: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  request?: ApiCaseRunRequestSnapshot
  response?: ApiCaseRunResponseSnapshot
  runtimeVarsJson?: string
  extractResults?: ApiCaseRunExtractResult[]
  assertResults?: ApiCaseRunAssertResult[]
}

export type ApiCollectionRunSummary = {
  collectionRunId?: string
  collectionId?: string
  environmentId?: string
  status?: 'running' | 'success' | 'failed' | 'error'
  totalCount?: number
  successCount?: number
  failedCount?: number
  errorCount?: number
  skippedCount?: number
  runtimeVarsJson?: string
  errorMessage?: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  createdAt?: string
  updatedAt?: string
}

export type ApiCollectionRunReport = ApiCollectionRunSummary & {
  items?: ApiCollectionRunItem[]
}

export class ApiError extends Error {
  code: number
  status: number

  constructor(message: string, code: number, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const headers = new Headers(options.headers)

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })
  const payload = (await response.json().catch(() => ({
    code: response.ok ? 0 : response.status,
    message: response.statusText,
    data: {},
  }))) as ApiEnvelope<T>

  if (!response.ok || payload.code !== 0) {
    if (payload.code === 1001 || response.status === 401) {
      useAuthStore.getState().logout()
    }
    throw new ApiError(payload.message || '请求失败', payload.code, response.status)
  }

  return payload.data
}

export const api = {
  register: (body: { name: string; password: string; email?: string }) =>
    request<Record<string, never>>('/v1/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { name: string; password: string }) =>
    request<LoginResponse>('/v1/login', { method: 'POST', body: JSON.stringify(body) }),
  getUser: () => request<User>('/v1/user'),
  updateUser: (body: Partial<Pick<User, 'name' | 'email'>>) =>
    request<Record<string, never>>('/v1/user', { method: 'PUT', body: JSON.stringify(body) }),
  deleteUser: () => request<Record<string, never>>('/v1/user', { method: 'DELETE' }),
  getProjects: () => request<Project[]>('/v1/projects'),
  createProject: (body: Pick<Project, 'name' | 'description'>) =>
    request<Project>('/v1/projects', { method: 'POST', body: JSON.stringify(body) }),
  getProject: (projectId: string) => request<Project>(`/v1/projects/${projectId}`),
  updateProject: (projectId: string, body: ProjectUpdatePayload) =>
    request<Project>(`/v1/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (projectId: string) =>
    request<Record<string, never>>(`/v1/projects/${projectId}`, { method: 'DELETE' }),
  getSprints: (projectId: string) => request<Sprint[]>(`/v1/projects/${projectId}/sprints`),
  createSprint: (projectId: string, body: SprintCreatePayload) =>
    request<Sprint>(`/v1/projects/${projectId}/sprints`, { method: 'POST', body: JSON.stringify(body) }),
  getSprint: (sprintId: string) => request<Sprint>(`/v1/sprints/${sprintId}`),
  updateSprint: (sprintId: string, body: SprintUpdatePayload) =>
    request<Sprint>(`/v1/sprints/${sprintId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSprint: (sprintId: string) =>
    request<Record<string, never>>(`/v1/sprints/${sprintId}`, { method: 'DELETE' }),
  getRequirements: (sprintId: string) => request<Requirement[]>(`/v1/sprints/${sprintId}/requirements`),
  createRequirement: (sprintId: string, body: RequirementCreatePayload) =>
    request<Requirement>(`/v1/sprints/${sprintId}/requirements`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getRequirement: (requirementId: string) => request<Requirement>(`/v1/requirements/${requirementId}`),
  updateRequirement: (requirementId: string, body: RequirementUpdatePayload) =>
    request<Requirement>(`/v1/requirements/${requirementId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRequirement: (requirementId: string) =>
    request<Record<string, never>>(`/v1/requirements/${requirementId}`, { method: 'DELETE' }),
  getApiCollections: (requirementId: string) =>
    request<ApiCollection[]>(`/v1/requirements/${requirementId}/api-collections`),
  createApiCollection: (requirementId: string, body: CreateApiCollectionPayload) =>
    request<ApiCollection>(`/v1/requirements/${requirementId}/api-collections`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getApiCollection: (collectionId: string) => request<ApiCollection>(`/v1/api-collections/${collectionId}`),
  updateApiCollection: (collectionId: string, body: UpdateApiCollectionPayload) =>
    request<ApiCollection>(`/v1/api-collections/${collectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteApiCollection: (collectionId: string) =>
    request<Record<string, never>>(`/v1/api-collections/${collectionId}`, { method: 'DELETE' }),
  getUiTestSuites: (requirementId: string) =>
    request<UiTestSuite[]>(`/v1/requirements/${requirementId}/ui-test-suites`),
  createUiTestSuite: (requirementId: string, body: CreateUiTestSuitePayload) =>
    request<UiTestSuite>(`/v1/requirements/${requirementId}/ui-test-suites`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getUiTestSuite: (suiteId: string) => request<UiTestSuite>(`/v1/ui-test-suites/${suiteId}`),
  updateUiTestSuite: (suiteId: string, body: UpdateUiTestSuitePayload) =>
    request<UiTestSuite>(`/v1/ui-test-suites/${suiteId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteUiTestSuite: (suiteId: string) =>
    request<Record<string, never>>(`/v1/ui-test-suites/${suiteId}`, { method: 'DELETE' }),
  runUiTestSuite: (suiteId: string) =>
    request<UiTestSuiteRunSummary>(`/v1/ui-test-suites/${suiteId}/run`, {
      method: 'POST',
    }),
  getUiTestSuiteRuns: (suiteId: string) => request<UiTestSuiteRunSummary[]>(`/v1/ui-test-suites/${suiteId}/runs`),
  getUiTestSuiteRun: (suiteRunId: string) => request<UiTestSuiteRunSummary>(`/v1/ui-test-suite-runs/${suiteRunId}`),
  getUiTestSuiteRunReport: (suiteRunId: string) => request<UiTestSuiteRunReport>(`/v1/ui-test-suite-runs/${suiteRunId}/report`),
  getUiTestCases: (suiteId: string) => request<UiTestCase[]>(`/v1/ui-test-suites/${suiteId}/cases`),
  createUiTestCase: (suiteId: string, body: CreateUiTestCasePayload) =>
    request<UiTestCase>(`/v1/ui-test-suites/${suiteId}/cases`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getUiTestCase: (caseId: string) => request<UiTestCase>(`/v1/ui-test-cases/${caseId}`),
  updateUiTestCase: (caseId: string, body: UpdateUiTestCasePayload) =>
    request<UiTestCase>(`/v1/ui-test-cases/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteUiTestCase: (caseId: string) =>
    request<Record<string, never>>(`/v1/ui-test-cases/${caseId}`, { method: 'DELETE' }),
  debugRunUiTestCase: (caseId: string, body: UiTestCaseDebugRunPayload = {}) =>
    request<UiTestCaseRun>(`/v1/ui-test-cases/${caseId}/debug-run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getUiTestCaseRun: (runId: string) => request<UiTestCaseRun>(`/v1/ui-test-case-runs/${runId}`),
  getApiEnvironments: (projectId: string) => request<ApiEnvironment[]>(`/v1/projects/${projectId}/api-environments`),
  createApiEnvironment: (projectId: string, body: CreateApiEnvironmentPayload) =>
    request<ApiEnvironment>(`/v1/projects/${projectId}/api-environments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getApiEnvironment: (environmentId: string) => request<ApiEnvironment>(`/v1/api-environments/${environmentId}`),
  updateApiEnvironment: (environmentId: string, body: UpdateApiEnvironmentPayload) =>
    request<ApiEnvironment>(`/v1/api-environments/${environmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteApiEnvironment: (environmentId: string) =>
    request<Record<string, never>>(`/v1/api-environments/${environmentId}`, { method: 'DELETE' }),
  getApiEnvironmentVars: (environmentId: string) =>
    request<ApiEnvironmentVar[]>(`/v1/api-environments/${environmentId}/vars`),
  createApiEnvironmentVar: (environmentId: string, body: CreateApiEnvironmentVarPayload) =>
    request<ApiEnvironmentVar>(`/v1/api-environments/${environmentId}/vars`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getApiEnvironmentVar: (envVarId: string) => request<ApiEnvironmentVar>(`/v1/api-environment-vars/${envVarId}`),
  updateApiEnvironmentVar: (envVarId: string, body: UpdateApiEnvironmentVarPayload) =>
    request<ApiEnvironmentVar>(`/v1/api-environment-vars/${envVarId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteApiEnvironmentVar: (envVarId: string) =>
    request<Record<string, never>>(`/v1/api-environment-vars/${envVarId}`, { method: 'DELETE' }),
  getApiCases: (collectionId: string) => request<ApiCase[]>(`/v1/api-collections/${collectionId}/cases`),
  createApiCase: (collectionId: string, body: CreateApiCasePayload) =>
    request<ApiCase>(`/v1/api-collections/${collectionId}/cases`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getApiCase: (caseId: string) => request<ApiCase>(`/v1/api-cases/${caseId}`),
  updateApiCase: (caseId: string, body: UpdateApiCasePayload) =>
    request<ApiCase>(`/v1/api-cases/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getApiAssertRules: (caseId: string) => request<ApiAssertRule[]>(`/v1/api-cases/${caseId}/assert-rules`),
  createApiAssertRule: (caseId: string, body: CreateApiAssertRulePayload) =>
    request<ApiAssertRule>(`/v1/api-cases/${caseId}/assert-rules`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getApiAssertRule: (assertRuleId: string) => request<ApiAssertRule>(`/v1/api-assert-rules/${assertRuleId}`),
  updateApiAssertRule: (assertRuleId: string, body: UpdateApiAssertRulePayload) =>
    request<ApiAssertRule>(`/v1/api-assert-rules/${assertRuleId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteApiAssertRule: (assertRuleId: string) =>
    request<Record<string, never>>(`/v1/api-assert-rules/${assertRuleId}`, { method: 'DELETE' }),
  getApiExtractRules: (caseId: string) => request<ApiExtractRule[]>(`/v1/api-cases/${caseId}/extract-rules`),
  createApiExtractRule: (caseId: string, body: CreateApiExtractRulePayload) =>
    request<ApiExtractRule>(`/v1/api-cases/${caseId}/extract-rules`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getApiExtractRule: (extractRuleId: string) => request<ApiExtractRule>(`/v1/api-extract-rules/${extractRuleId}`),
  updateApiExtractRule: (extractRuleId: string, body: UpdateApiExtractRulePayload) =>
    request<ApiExtractRule>(`/v1/api-extract-rules/${extractRuleId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteApiExtractRule: (extractRuleId: string) =>
    request<Record<string, never>>(`/v1/api-extract-rules/${extractRuleId}`, { method: 'DELETE' }),
  runApiCase: (caseId: string, body: RunApiCasePayload) =>
    request<ApiCaseRunResult>(`/v1/api-cases/${caseId}/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  runApiCollection: (collectionId: string, body: RunApiCollectionPayload) =>
    request<ApiCollectionRunSummary>(`/v1/api-collections/${collectionId}/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getApiCollectionRuns: (collectionId: string) =>
    request<ApiCollectionRunSummary[]>(`/v1/api-collections/${collectionId}/runs`),
  getApiCollectionRun: (collectionRunId: string) =>
    request<ApiCollectionRunSummary>(`/v1/api-collection-runs/${collectionRunId}`),
  getApiCollectionRunReport: (collectionRunId: string) =>
    request<ApiCollectionRunReport>(`/v1/api-collection-runs/${collectionRunId}/report`),
  deleteApiCase: (caseId: string) =>
    request<Record<string, never>>(`/v1/api-cases/${caseId}`, { method: 'DELETE' }),
}
