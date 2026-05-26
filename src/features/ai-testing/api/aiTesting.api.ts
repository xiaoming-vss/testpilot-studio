import { request } from '@/shared/api/request'
import type {
  ApiCaseGenerateTask,
  ApiCaseGenerateTaskRun,
  CreateApiCaseGenerateTaskPayload,
  ReviewApiCaseGenerateTaskRunPayload,
  UpdateApiCaseGenerateTaskPayload,
} from '../types'

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
  runApiCaseGenerateTask: (taskId: string) =>
    request<ApiCaseGenerateTaskRun>(`/v1/api-case-generate-tasks/${taskId}/run`, {
      method: 'POST',
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
}
