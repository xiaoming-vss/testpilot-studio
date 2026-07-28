import { request, requestBlob, type ListResponse } from '@/shared/api/request'
import type {
  CreateTestReportGenerateRunPayload,
  Project,
  ProjectUpdatePayload,
  Sprint,
  SprintCreatePayload,
  SprintDailyMetricsSnapshot,
  SprintUpdatePayload,
  TestReportGenerateRun,
} from '../types'

export const projectsApi = {
  getProjects: () => request<ListResponse<Project>>('/v1/projects'),
  createProject: (body: Pick<Project, 'name' | 'description'>) =>
    request<Project>('/v1/projects', { method: 'POST', body: JSON.stringify(body) }),
  getProject: (projectId: string) => request<Project>(`/v1/projects/${projectId}`),
  updateProject: (projectId: string, body: ProjectUpdatePayload) =>
    request<Project>(`/v1/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (projectId: string) =>
    request<Record<string, never>>(`/v1/projects/${projectId}`, { method: 'DELETE' }),
  getSprints: (projectId: string) => request<ListResponse<Sprint>>(`/v1/projects/${projectId}/sprints`),
  createSprint: (projectId: string, body: SprintCreatePayload) =>
    request<Sprint>(`/v1/projects/${projectId}/sprints`, { method: 'POST', body: JSON.stringify(body) }),
  getSprint: (sprintId: string) => request<Sprint>(`/v1/sprints/${sprintId}`),
  updateSprint: (sprintId: string, body: SprintUpdatePayload) =>
    request<Sprint>(`/v1/sprints/${sprintId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSprint: (sprintId: string) =>
    request<Record<string, never>>(`/v1/sprints/${sprintId}`, { method: 'DELETE' }),
  getSprintDailyMetricsByDate: (sprintId: string, snapshotDate: string) =>
    request<SprintDailyMetricsSnapshot>(`/v1/sprints/${sprintId}/daily-metrics/${snapshotDate}`),
  getSprintDailyMetrics: (sprintId: string, params: { startDate: string; endDate: string }) =>
    request<ListResponse<SprintDailyMetricsSnapshot>>(
      `/v1/sprints/${sprintId}/daily-metrics?${new URLSearchParams(params).toString()}`,
    ),
  generateSprintDailyMetrics: (sprintId: string, snapshotDate: string) =>
    request<SprintDailyMetricsSnapshot>(`/v1/sprints/${sprintId}/daily-metrics/${snapshotDate}`, { method: 'PUT' }),
  createTestReportGenerateRun: (projectId: string, body: CreateTestReportGenerateRunPayload) =>
    request<TestReportGenerateRun>(`/v1/projects/${projectId}/test-report-generate-runs`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getTestReportGenerateRuns: (projectId: string, params: { sprintId: string }) =>
    request<ListResponse<TestReportGenerateRun>>(
      `/v1/projects/${projectId}/test-report-generate-runs?${new URLSearchParams(params).toString()}`,
    ),
  getTestReportGenerateRun: (runId: string) => request<TestReportGenerateRun>(`/v1/test-report-generate-runs/${runId}`),
  downloadTestReportGenerateRunPdf: (runId: string) => requestBlob(`/v1/test-report-generate-runs/${runId}/pdf`),
}
