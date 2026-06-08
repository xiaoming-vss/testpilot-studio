import { request } from '@/shared/api/request'
import type {
  CreateFunctionTestCasePayload,
  CreateFunctionTestSuitePayload,
  FunctionTestCase,
  FunctionTestCaseImportResult,
  FunctionTestCaseZentaoImportResult,
  FunctionTestSuite,
  ImportFunctionTestCasesToZentaoPayload,
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
  importFunctionTestCases: (suiteId: string, file: Blob, filename = 'import.json') => {
    const formData = new FormData()
    formData.append('file', file, filename)
    return request<FunctionTestCaseImportResult>(`/v1/function-test-suites/${suiteId}/cases/import`, {
      method: 'POST',
      body: formData,
    })
  },
  importFunctionTestCasesToZentao: (suiteId: string, body: ImportFunctionTestCasesToZentaoPayload) =>
    request<FunctionTestCaseZentaoImportResult>(`/v1/function-test-suites/${suiteId}/zentao/testcases/import`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
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
