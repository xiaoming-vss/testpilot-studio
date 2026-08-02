import { parse } from 'yaml'

const caseFieldNames = new Set(['name', 'enabled', 'orderNo', 'stepsJson'])
const stepFieldNames = new Set([
  'orderNo',
  'stepName',
  'keyword',
  'locatorType',
  'locatorValue',
  'operationValue',
  'continueOnFailure',
  'enabled',
])

export type UiCandidateStepView = Record<string, unknown> & {
  extraFields: Record<string, unknown>
}

export type UiCandidateCaseView = {
  name?: string
  enabled?: boolean
  orderNo?: number
  steps: UiCandidateStepView[]
  extraFields: Record<string, unknown>
}

export type UiCandidateParseResult = {
  rawYaml: string
  cases: UiCandidateCaseView[]
  error?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function extraFields(record: Record<string, unknown>, knownFields: Set<string>) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !knownFields.has(key)))
}

export function parseUiCaseCandidate(rawYaml: string): UiCandidateParseResult {
  try {
    const root = asRecord(parse(rawYaml))
    const rawCases = Array.isArray(root?.cases) ? root.cases : []
    const cases = rawCases.flatMap((candidate): UiCandidateCaseView[] => {
      const caseRecord = asRecord(candidate)
      if (!caseRecord) return []
      const rawSteps = Array.isArray(caseRecord.stepsJson) ? caseRecord.stepsJson : []
      const steps = rawSteps.flatMap((step): UiCandidateStepView[] => {
        const stepRecord = asRecord(step)
        if (!stepRecord) return []
        return [{ ...stepRecord, extraFields: extraFields(stepRecord, stepFieldNames) }]
      })
      return [{
        name: typeof caseRecord.name === 'string' ? caseRecord.name : undefined,
        enabled: typeof caseRecord.enabled === 'boolean' ? caseRecord.enabled : undefined,
        orderNo: typeof caseRecord.orderNo === 'number' ? caseRecord.orderNo : undefined,
        steps,
        extraFields: extraFields(caseRecord, caseFieldNames),
      }]
    })
    return { rawYaml, cases }
  } catch (error) {
    return {
      rawYaml,
      cases: [],
      error: error instanceof Error ? error.message : 'YAML 解析失败',
    }
  }
}
