import type { CreateUiTestCasePayload, UiTestCase } from '@/services/api'
import { normalizeUiTestCaseId, pickCreatedAt } from '@/utils/format'
import { usesUiStepComparator } from '../config/stepConfig'

export const DRAFT_CASE_ID = '__draft_ui_test_case__'
export const EMPTY_UI_TEST_CASES: UiTestCase[] = []

export type UiTestStepFormValue = {
  orderNo?: number
  stepName?: string
  keyword?: string
  locatorType?: string
  locatorValue?: string
  operationValue?: string
  expectValue?: string
  comparator?: string
  timeoutMs?: number
  continueOnFailure?: boolean
  enabled?: boolean
  description?: string
}

export type UiTestCaseFormValues = {
  name: string
  enabled?: boolean
  steps?: UiTestStepFormValue[]
}

export function createDefaultUiTestCaseFormValues(): UiTestCaseFormValues {
  return {
    name: '',
    enabled: true,
    steps: [],
  }
}

function normalizeStepValue(step: Partial<UiTestStepFormValue>, index: number): UiTestStepFormValue {
  const orderNo = typeof step.orderNo === 'number' && Number.isFinite(step.orderNo) ? step.orderNo : index + 1

  return {
    orderNo,
    stepName: step.stepName ?? '',
    keyword: step.keyword ?? '',
    locatorType: step.locatorType ?? '',
    locatorValue: step.locatorValue ?? '',
    operationValue: step.operationValue ?? '',
    expectValue: step.expectValue ?? '',
    comparator: step.comparator ?? '',
    timeoutMs: typeof step.timeoutMs === 'number' && Number.isFinite(step.timeoutMs) ? step.timeoutMs : undefined,
    continueOnFailure: Boolean(step.continueOnFailure),
    enabled: step.enabled ?? true,
    description: step.description ?? '',
  }
}

export function parseStepsJson(value?: string) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item, index) => normalizeStepValue((item ?? {}) as Partial<UiTestStepFormValue>, index))
      .sort((left, right) => (left.orderNo ?? Number.MAX_SAFE_INTEGER) - (right.orderNo ?? Number.MAX_SAFE_INTEGER))
  } catch {
    return []
  }
}

function hasMeaningfulStepContent(step: UiTestStepFormValue) {
  return Boolean(
    step.stepName?.trim() ||
      step.keyword?.trim() ||
      step.locatorType?.trim() ||
      step.locatorValue?.trim() ||
      step.operationValue?.trim() ||
      step.expectValue?.trim() ||
      step.comparator?.trim() ||
      step.description?.trim() ||
      step.timeoutMs,
  )
}

export function serializeSteps(steps?: UiTestStepFormValue[]) {
  const normalizedSteps = (steps ?? [])
    .map((step, index) => normalizeStepValue(step ?? {}, index))
    .filter(hasMeaningfulStepContent)
    .map((step, index) => ({
      orderNo: index + 1,
      ...(step.stepName?.trim() ? { stepName: step.stepName.trim() } : {}),
      ...(step.keyword?.trim() ? { keyword: step.keyword.trim() } : {}),
      ...(step.locatorType?.trim() ? { locatorType: step.locatorType.trim() } : {}),
      ...(step.locatorValue?.trim() ? { locatorValue: step.locatorValue.trim() } : {}),
      ...(step.operationValue?.trim() ? { operationValue: step.operationValue.trim() } : {}),
      ...(step.expectValue?.trim() ? { expectValue: step.expectValue.trim() } : {}),
      ...(usesUiStepComparator(step.keyword?.trim()) && step.comparator?.trim() ? { comparator: step.comparator.trim() } : {}),
      ...(typeof step.timeoutMs === 'number' && Number.isFinite(step.timeoutMs) ? { timeoutMs: step.timeoutMs } : {}),
      continueOnFailure: Boolean(step.continueOnFailure),
      enabled: step.enabled ?? true,
      ...(step.description?.trim() ? { description: step.description.trim() } : {}),
    }))

  return JSON.stringify(normalizedSteps)
}

export function serializeUiTestCaseValues(values: UiTestCaseFormValues): CreateUiTestCasePayload {
  return {
    name: values.name,
    enabled: values.enabled,
    stepsJson: serializeSteps(values.steps),
  }
}

export function buildUiTestCaseFormValues(uiTestCase: UiTestCase): UiTestCaseFormValues {
  return {
    ...createDefaultUiTestCaseFormValues(),
    name: uiTestCase.name ?? '',
    enabled: uiTestCase.enabled ?? true,
    steps: parseStepsJson(uiTestCase.stepsJson),
  }
}

function getUiTestCaseOrderNo(uiTestCase: UiTestCase) {
  return uiTestCase.orderNo ?? Number.MAX_SAFE_INTEGER
}

function getUiTestCaseCreatedTime(uiTestCase: UiTestCase) {
  const createdAt = pickCreatedAt(uiTestCase)
  const timestamp = createdAt ? new Date(createdAt).getTime() : 0
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export function sortUiTestCases(uiTestCases: UiTestCase[]) {
  return [...uiTestCases].sort(
    (left, right) =>
      getUiTestCaseOrderNo(left) - getUiTestCaseOrderNo(right) ||
      getUiTestCaseCreatedTime(left) - getUiTestCaseCreatedTime(right) ||
      normalizeUiTestCaseId(left).localeCompare(normalizeUiTestCaseId(right)),
  )
}

export function getUiTestCaseStepCount(uiTestCase: UiTestCase) {
  return parseStepsJson(uiTestCase.stepsJson).length
}

export function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export function moveExpandedStepIndex(index: number, fromIndex: number, toIndex: number) {
  if (index === fromIndex) return toIndex

  if (fromIndex < toIndex && index > fromIndex && index <= toIndex) {
    return index - 1
  }

  if (fromIndex > toIndex && index >= toIndex && index < fromIndex) {
    return index + 1
  }

  return index
}

function parseMaybeJsonValue(value: unknown) {
  if (typeof value !== 'string') return value
  if (!value.trim()) return ''

  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

export function prettyPrintValue(value: unknown) {
  const normalized = parseMaybeJsonValue(value)

  if (normalized === '' || normalized === undefined || normalized === null) {
    return ''
  }

  if (typeof normalized === 'string') {
    return normalized
  }

  try {
    return JSON.stringify(normalized, null, 2)
  } catch {
    return String(normalized)
  }
}

export function formatOptionalValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
}

export function formatViewportText(width?: number, height?: number) {
  if (!width || !height) return '-'
  return `${width} x ${height}`
}

export function formatOptionalMs(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value} ms` : '-'
}
