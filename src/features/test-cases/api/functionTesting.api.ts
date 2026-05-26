import { request } from '@/shared/api/request'
import type {
  CreateFunctionTestCasePayload,
  CreateFunctionTestSuitePayload,
  FunctionTestCase,
  FunctionTestSuite,
  UpdateFunctionTestCasePayload,
  UpdateFunctionTestSuitePayload,
} from '../types'

export const functionTestingApi = {
  getFunctionTestSuites: (requirementId: string) =>
    request<FunctionTestSuite[]>(`/v1/requirements/${requirementId}/function-test-suites`),
  createFunctionTestSuite: (requirementId: string, body: CreateFunctionTestSuitePayload) =>
    request<FunctionTestSuite>(`/v1/requirements/${requirementId}/function-test-suites`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getFunctionTestSuite: (suiteId: string) => request<FunctionTestSuite>(`/v1/function-test-suites/${suiteId}`),
  updateFunctionTestSuite: (suiteId: string, body: UpdateFunctionTestSuitePayload) =>
    request<FunctionTestSuite>(`/v1/function-test-suites/${suiteId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteFunctionTestSuite: (suiteId: string) =>
    request<Record<string, never>>(`/v1/function-test-suites/${suiteId}`, { method: 'DELETE' }),
  getFunctionTestCases: (suiteId: string) =>
    request<FunctionTestCase[]>(`/v1/function-test-suites/${suiteId}/cases`),
  createFunctionTestCase: (suiteId: string, body: CreateFunctionTestCasePayload) =>
    request<FunctionTestCase>(`/v1/function-test-suites/${suiteId}/cases`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getFunctionTestCase: (caseId: string) => request<FunctionTestCase>(`/v1/function-test-cases/${caseId}`),
  updateFunctionTestCase: (caseId: string, body: UpdateFunctionTestCasePayload) =>
    request<FunctionTestCase>(`/v1/function-test-cases/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteFunctionTestCase: (caseId: string) =>
    request<Record<string, never>>(`/v1/function-test-cases/${caseId}`, { method: 'DELETE' }),
}
