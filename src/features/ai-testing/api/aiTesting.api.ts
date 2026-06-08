import { request } from '@/shared/api/request'
import type {
  ApiCaseGenerateTask,
  ApiCaseGenerateTaskRun,
  CreateApiCaseGenerateTaskPayload,
  CreateFunctionalCaseGenerateTaskPayload,
  FunctionalCaseGenerateTask,
  FunctionalCaseGenerateTaskRun,
  ReviewApiCaseGenerateTaskRunPayload,
  ReviewFunctionalCaseGenerateTaskRunPayload,
  RunFunctionalCaseGenerateTaskPayload,
  UpdateApiCaseGenerateTaskPayload,
  UpdateFunctionalCaseGenerateTaskPayload,
} from '../types'

function buildFunctionalCaseTaskFormData(body: CreateFunctionalCaseGenerateTaskPayload | UpdateFunctionalCaseGenerateTaskPayload) {
  const formData = new FormData()

  if (body.name !== undefined) formData.append('name', body.name)
  if (body.sprintId !== undefined) formData.append('sprintId', body.sprintId)
  if (body.requirementId !== undefined) formData.append('requirementId', body.requirementId)
  if (body.sourceType !== undefined) formData.append('sourceType', body.sourceType)
  if (body.sourceType === 'text' && body.sourceContent !== undefined) formData.append('sourceContent', body.sourceContent)
  if (body.instruction !== undefined) formData.append('instruction', body.instruction)
  if (body.file) formData.append('file', body.file)

  return formData
}

export const aiTestingApi = {
  getApiCaseGenerateTasks: (projectId: string) =>
    request<ApiCaseGenerateTask[]>(`/v1/projects/${projectId}/api-case-generate-tasks`),
  createApiCaseGenerateTask: (projectId: string, body: CreateApiCaseGenerateTaskPayload) =>
    request<ApiCaseGenerateTask>(`/v1/projects/${projectId}/api-case-generate-tasks`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getApiCaseGenerateTask: (taskId: string) =>
    request<ApiCaseGenerateTask>(`/v1/api-case-generate-tasks/${taskId}`),
  updateApiCaseGenerateTask: (taskId: string, body: UpdateApiCaseGenerateTaskPayload) =>
    request<ApiCaseGenerateTask>(`/v1/api-case-generate-tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  runApiCaseGenerateTask: (taskId: string, connectionId: string) =>
    request<ApiCaseGenerateTaskRun>(`/v1/api-case-generate-tasks/${taskId}/run`, {
      method: 'POST',
      body: JSON.stringify({ connectionId }),
    }),
  getApiCaseGenerateTaskRuns: (taskId: string) =>
    request<ApiCaseGenerateTaskRun[]>(`/v1/api-case-generate-tasks/${taskId}/runs`),
  getApiCaseGenerateTaskRun: (runId: string) =>
    request<ApiCaseGenerateTaskRun>(`/v1/api-case-generate-task-runs/${runId}`),
  reviewApiCaseGenerateTaskRun: (runId: string, body: ReviewApiCaseGenerateTaskRunPayload) =>
    request<ApiCaseGenerateTaskRun>(`/v1/api-case-generate-task-runs/${runId}/review`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteApiCaseGenerateTask: (taskId: string) =>
    request<Record<string, never>>(`/v1/api-case-generate-tasks/${taskId}`, {
      method: 'DELETE',
    }),
  getFunctionalCaseGenerateTasks: (projectId: string) =>
    request<FunctionalCaseGenerateTask[]>(`/v1/projects/${projectId}/function-case-generate-tasks`),
  createFunctionalCaseGenerateTask: (projectId: string, body: CreateFunctionalCaseGenerateTaskPayload) =>
    request<FunctionalCaseGenerateTask>(`/v1/projects/${projectId}/function-case-generate-tasks`, {
      method: 'POST',
      body: buildFunctionalCaseTaskFormData(body),
    }),
  getFunctionalCaseGenerateTask: (taskId: string) =>
    request<FunctionalCaseGenerateTask>(`/v1/function-case-generate-tasks/${taskId}`),
  updateFunctionalCaseGenerateTask: (taskId: string, body: UpdateFunctionalCaseGenerateTaskPayload) =>
    request<FunctionalCaseGenerateTask>(`/v1/function-case-generate-tasks/${taskId}`, {
      method: 'PATCH',
      body: buildFunctionalCaseTaskFormData(body),
    }),
  runFunctionalCaseGenerateTask: (taskId: string, body: RunFunctionalCaseGenerateTaskPayload) =>
    request<FunctionalCaseGenerateTaskRun>(`/v1/function-case-generate-tasks/${taskId}/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getFunctionalCaseGenerateTaskRuns: (taskId: string) =>
    request<FunctionalCaseGenerateTaskRun[]>(`/v1/function-case-generate-tasks/${taskId}/runs`),
  getFunctionalCaseGenerateTaskRun: (runId: string) =>
    request<FunctionalCaseGenerateTaskRun>(`/v1/function-case-generate-task-runs/${runId}`),
  reviewFunctionalCaseGenerateTaskRun: (runId: string, body: ReviewFunctionalCaseGenerateTaskRunPayload) =>
    request<FunctionalCaseGenerateTaskRun>(`/v1/function-case-generate-task-runs/${runId}/review`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteFunctionalCaseGenerateTask: (taskId: string) =>
    request<Record<string, never>>(`/v1/function-case-generate-tasks/${taskId}`, {
      method: 'DELETE',
    }),
}
