import type {
  ApiAssertRule,
  ApiEnvironment,
  ApiEnvironmentVar,
  ApiCollection,
  ApiExtractRule,
  Project,
  Requirement,
  RequirementUpdatePayload,
  Sprint,
  SprintCreatePayload,
  SprintUpdatePayload,
  UiTestCase,
  UiTestSuite,
} from '../services/api'
import type { CollectionFormValues, SprintFormValues, UiTestSuiteFormValues } from '../components/EntityDrawers'
import { pickEndTime, pickStartTime } from './format'

function normalizeText(value?: string) {
  return value ?? ''
}

function toRfc3339(value: SprintFormValues['startTime']) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (typeof value.toISOString === 'function') return value.toISOString()
  return ''
}

export function buildSprintCreatePayload(values: SprintFormValues): SprintCreatePayload {
  const startTime = toRfc3339(values.startTime)
  const endTime = toRfc3339(values.endTime)

  return {
    name: values.name,
    description: values.description,
    startTime,
    ...(endTime ? { endTime } : {}),
  }
}

export function buildProjectUpdatePayload(project: Project, values: Pick<Project, 'name' | 'description'>) {
  const payload: Partial<Pick<Project, 'name' | 'description'>> = {}

  if (project.name !== values.name) payload.name = values.name
  if (normalizeText(project.description) !== normalizeText(values.description)) {
    payload.description = values.description ?? ''
  }

  return payload
}

export function buildSprintUpdatePayload(sprint: Sprint, values: SprintFormValues): SprintUpdatePayload {
  const payload: SprintUpdatePayload = {}
  const nextStartTime = toRfc3339(values.startTime)
  const nextEndTime = toRfc3339(values.endTime)
  const currentStartTime = pickStartTime(sprint) ?? ''
  const currentEndTime = pickEndTime(sprint) ?? ''

  if (sprint.name !== values.name) payload.name = values.name
  if (normalizeText(sprint.description) !== normalizeText(values.description)) {
    payload.description = values.description ?? ''
  }
  if (values.status && sprint.status !== values.status) payload.status = values.status
  if (nextStartTime && nextStartTime !== currentStartTime) payload.startTime = nextStartTime
  if (nextEndTime !== currentEndTime) payload.endTime = nextEndTime

  return payload
}

export function buildRequirementUpdatePayload(
  requirement: Requirement,
  values: Partial<Pick<Requirement, 'name' | 'description' | 'status'>>,
): RequirementUpdatePayload {
  const payload: RequirementUpdatePayload = {}

  if (values.name !== undefined && requirement.name !== values.name) payload.name = values.name
  if (normalizeText(requirement.description) !== normalizeText(values.description)) {
    payload.description = values.description ?? ''
  }
  if (values.status && requirement.status !== values.status) payload.status = values.status

  return payload
}

export function buildApiCollectionUpdatePayload(collection: ApiCollection, values: CollectionFormValues) {
  const payload: Partial<Pick<ApiCollection, 'name' | 'description'>> = {}

  if (collection.name !== values.name) payload.name = values.name
  if (normalizeText(collection.description) !== normalizeText(values.summary)) {
    payload.description = values.summary ?? ''
  }

  return payload
}

export function buildUiTestSuiteUpdatePayload(suite: UiTestSuite, values: UiTestSuiteFormValues) {
  const payload: Partial<
    Pick<
      UiTestSuite,
      'name' | 'description' | 'headless' | 'slowMoMs' | 'viewportWidth' | 'viewportHeight' | 'defaultStepTimeoutMs'
    >
  > = {}

  if (suite.name !== values.name) payload.name = values.name
  if (normalizeText(suite.description) !== normalizeText(values.description)) {
    payload.description = values.description ?? ''
  }
  if (suite.headless !== values.headless && values.headless !== undefined) {
    payload.headless = values.headless
  }
  if ((suite.slowMoMs ?? undefined) !== (values.slowMoMs ?? undefined) && values.slowMoMs !== undefined) {
    payload.slowMoMs = values.slowMoMs
  }
  if ((suite.viewportWidth ?? undefined) !== (values.viewportWidth ?? undefined) && values.viewportWidth !== undefined) {
    payload.viewportWidth = values.viewportWidth
  }
  if ((suite.viewportHeight ?? undefined) !== (values.viewportHeight ?? undefined) && values.viewportHeight !== undefined) {
    payload.viewportHeight = values.viewportHeight
  }
  if (
    (suite.defaultStepTimeoutMs ?? undefined) !== (values.defaultStepTimeoutMs ?? undefined) &&
    values.defaultStepTimeoutMs !== undefined
  ) {
    payload.defaultStepTimeoutMs = values.defaultStepTimeoutMs
  }

  return payload
}

export function buildUiTestCaseUpdatePayload(
  uiTestCase: UiTestCase,
  values: Pick<UiTestCase, 'name' | 'enabled' | 'orderNo' | 'stepsJson'>,
) {
  const payload: Partial<Pick<UiTestCase, 'name' | 'enabled' | 'orderNo' | 'stepsJson'>> = {}

  if (uiTestCase.name !== values.name) payload.name = values.name
  if (Boolean(uiTestCase.enabled) !== Boolean(values.enabled)) payload.enabled = Boolean(values.enabled)
  if ((uiTestCase.orderNo ?? undefined) !== (values.orderNo ?? undefined)) payload.orderNo = values.orderNo
  if (normalizeText(uiTestCase.stepsJson) !== normalizeText(values.stepsJson)) payload.stepsJson = values.stepsJson ?? '[]'

  return payload
}

export function buildApiEnvironmentUpdatePayload(
  environment: ApiEnvironment,
  values: Pick<ApiEnvironment, 'name' | 'baseUrl' | 'description' | 'isDefault'>,
) {
  const payload: Partial<Pick<ApiEnvironment, 'name' | 'baseUrl' | 'description' | 'isDefault'>> = {}

  if (environment.name !== values.name) payload.name = values.name
  if (environment.baseUrl !== values.baseUrl) payload.baseUrl = values.baseUrl
  if (normalizeText(environment.description) !== normalizeText(values.description)) {
    payload.description = values.description ?? ''
  }
  if (Boolean(environment.isDefault) !== Boolean(values.isDefault)) payload.isDefault = Boolean(values.isDefault)

  return payload
}

export function buildApiEnvironmentVarUpdatePayload(
  environmentVar: ApiEnvironmentVar,
  values: Pick<ApiEnvironmentVar, 'varKey' | 'value' | 'description' | 'isSecret'>,
) {
  const payload: Partial<Pick<ApiEnvironmentVar, 'varKey' | 'value' | 'description' | 'isSecret'>> = {}

  if (environmentVar.varKey !== values.varKey) payload.varKey = values.varKey
  if (environmentVar.value !== values.value) payload.value = values.value
  if (normalizeText(environmentVar.description) !== normalizeText(values.description)) {
    payload.description = values.description ?? ''
  }
  if (Boolean(environmentVar.isSecret) !== Boolean(values.isSecret)) payload.isSecret = Boolean(values.isSecret)

  return payload
}

export function buildApiAssertRuleUpdatePayload(
  assertRule: ApiAssertRule,
  values: Pick<ApiAssertRule, 'name' | 'enabled' | 'orderNo' | 'assertSource' | 'targetExpr' | 'comparator' | 'expectedValue'>,
) {
  const payload: Partial<
    Pick<ApiAssertRule, 'name' | 'enabled' | 'orderNo' | 'assertSource' | 'targetExpr' | 'comparator' | 'expectedValue'>
  > = {}

  if (assertRule.name !== values.name) payload.name = values.name
  if (Boolean(assertRule.enabled) !== Boolean(values.enabled)) payload.enabled = Boolean(values.enabled)
  if ((assertRule.orderNo ?? undefined) !== (values.orderNo ?? undefined)) payload.orderNo = values.orderNo
  if (assertRule.assertSource !== values.assertSource) payload.assertSource = values.assertSource
  if (normalizeText(assertRule.targetExpr) !== normalizeText(values.targetExpr)) payload.targetExpr = values.targetExpr ?? ''
  if (assertRule.comparator !== values.comparator) payload.comparator = values.comparator
  if (normalizeText(assertRule.expectedValue) !== normalizeText(values.expectedValue)) payload.expectedValue = values.expectedValue ?? ''

  return payload
}

export function buildApiExtractRuleUpdatePayload(
  extractRule: ApiExtractRule,
  values: Pick<ApiExtractRule, 'name' | 'enabled' | 'orderNo' | 'source' | 'sourceExpr' | 'varKey' | 'defaultValue'>,
) {
  const payload: Partial<
    Pick<ApiExtractRule, 'name' | 'enabled' | 'orderNo' | 'source' | 'sourceExpr' | 'varKey' | 'defaultValue'>
  > = {}

  if (extractRule.name !== values.name) payload.name = values.name
  if (Boolean(extractRule.enabled) !== Boolean(values.enabled)) payload.enabled = Boolean(values.enabled)
  if ((extractRule.orderNo ?? undefined) !== (values.orderNo ?? undefined)) payload.orderNo = values.orderNo
  if (extractRule.source !== values.source) payload.source = values.source
  if (normalizeText(extractRule.sourceExpr) !== normalizeText(values.sourceExpr)) payload.sourceExpr = values.sourceExpr ?? ''
  if (extractRule.varKey !== values.varKey) payload.varKey = values.varKey
  if (normalizeText(extractRule.defaultValue) !== normalizeText(values.defaultValue)) payload.defaultValue = values.defaultValue ?? ''

  return payload
}
