export type FunctionTestSuite = {
  suiteId?: string
  requirementId?: string
  requirement_id?: string
  name: string
  description?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type CreateFunctionTestSuitePayload = {
  name: string
  description?: string
}

export type UpdateFunctionTestSuitePayload = Partial<CreateFunctionTestSuitePayload>

export type FunctionTestCase = {
  caseId?: string
  suiteId?: string
  title: string
  module?: string
  priority?: string
  caseType?: string
  preconditions?: string
  steps?: string
  expectedResults?: string
  orderNo?: number
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type CreateFunctionTestCasePayload = {
  title: string
  module?: string
  priority?: string
  caseType?: string
  preconditions?: string
  steps?: string
  expectedResults?: string
  orderNo?: number
}

export type UpdateFunctionTestCasePayload = Partial<CreateFunctionTestCasePayload>
