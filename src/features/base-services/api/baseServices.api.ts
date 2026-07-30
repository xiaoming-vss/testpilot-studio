import { request, type ListResponse } from '@/shared/api/request'
import type {
  CreateLlmConnectionPayload,
  CreateZentaoBindingPayload,
  CreateZentaoConnectionPayload,
  LlmConnection,
  UpdateLlmConnectionPayload,
  UpdateZentaoConnectionPayload,
  ZentaoBinding,
  ZentaoConnection,
  ZentaoRemoteListResponse,
  ZentaoRemoteOption,
} from '../types'

function integrationPath(projectId: string, provider: 'llm' | 'zentao') {
  return `/v1/projects/${encodeURIComponent(projectId)}/integrations/${provider}/connections`
}

function integrationConnectionPath(projectId: string, provider: 'llm' | 'zentao', connectionId: string) {
  return `${integrationPath(projectId, provider)}/${encodeURIComponent(connectionId)}`
}

export const baseServicesApi = {
  getLlmConnections: (projectId: string) => request<ListResponse<LlmConnection>>(integrationPath(projectId, 'llm')),
  getLlmConnection: (projectId: string, connectionId: string) =>
    request<LlmConnection>(integrationConnectionPath(projectId, 'llm', connectionId)),
  createLlmConnection: (projectId: string, body: CreateLlmConnectionPayload) =>
    request<LlmConnection>(integrationPath(projectId, 'llm'), {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateLlmConnection: (projectId: string, connectionId: string, body: UpdateLlmConnectionPayload) =>
    request<LlmConnection>(integrationConnectionPath(projectId, 'llm', connectionId), {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteLlmConnection: (projectId: string, connectionId: string) =>
    request<Record<string, never>>(integrationConnectionPath(projectId, 'llm', connectionId), {
      method: 'DELETE',
    }),
  getZentaoConnections: (projectId: string) => request<ListResponse<ZentaoConnection>>(integrationPath(projectId, 'zentao')),
  getZentaoConnection: (projectId: string, connectionId: string) =>
    request<ZentaoConnection>(integrationConnectionPath(projectId, 'zentao', connectionId)),
  createZentaoConnection: (projectId: string, body: CreateZentaoConnectionPayload) =>
    request<ZentaoConnection>(integrationPath(projectId, 'zentao'), {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateZentaoConnection: (projectId: string, connectionId: string, body: UpdateZentaoConnectionPayload) =>
    request<ZentaoConnection>(integrationConnectionPath(projectId, 'zentao', connectionId), {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  reauthZentaoConnection: (projectId: string, connectionId: string) =>
    request<ZentaoConnection>(`${integrationConnectionPath(projectId, 'zentao', connectionId)}/reauth`, {
      method: 'POST',
    }),
  deleteZentaoConnection: (projectId: string, connectionId: string) =>
    request<Record<string, never>>(integrationConnectionPath(projectId, 'zentao', connectionId), {
      method: 'DELETE',
    }),
  getZentaoRemoteProjects: (projectId: string, connectionId: string, page = 1, pageSize = 100) =>
    request<ZentaoRemoteListResponse<ZentaoRemoteOption>>(
      `${integrationConnectionPath(projectId, 'zentao', connectionId)}/projects?page=${page}&pageSize=${pageSize}`,
    ),
  getZentaoRemoteExecutions: (projectId: string, connectionId: string, remoteProjectId: string, page = 1, pageSize = 100) =>
    request<ZentaoRemoteListResponse<ZentaoRemoteOption>>(
      `${integrationConnectionPath(projectId, 'zentao', connectionId)}/projects/${encodeURIComponent(remoteProjectId)}/executions?page=${page}&pageSize=${pageSize}`,
    ),
  getZentaoRemoteTestTasks: (projectId: string, connectionId: string, remoteExecutionId: string, page = 1, pageSize = 100) =>
    request<ZentaoRemoteListResponse<ZentaoRemoteOption>>(
      `${integrationConnectionPath(projectId, 'zentao', connectionId)}/executions/${encodeURIComponent(remoteExecutionId)}/testtasks?page=${page}&pageSize=${pageSize}`,
    ),
  getZentaoRemoteStories: (projectId: string, connectionId: string, remoteExecutionId: string, page = 1, pageSize = 100) =>
    request<ZentaoRemoteListResponse<ZentaoRemoteOption>>(
      `${integrationConnectionPath(projectId, 'zentao', connectionId)}/executions/${encodeURIComponent(remoteExecutionId)}/stories?page=${page}&pageSize=${pageSize}`,
    ),
  getZentaoRemoteCases: (projectId: string, connectionId: string, remoteExecutionId: string, page = 1, pageSize = 100) =>
    request<ZentaoRemoteListResponse<ZentaoRemoteOption>>(
      `${integrationConnectionPath(projectId, 'zentao', connectionId)}/executions/${encodeURIComponent(remoteExecutionId)}/cases?page=${page}&pageSize=${pageSize}`,
    ),
  getProjectBindings: (projectId: string) => request<ListResponse<ZentaoBinding>>(`/v1/projects/${projectId}/bindings`),
  createProjectBinding: (projectId: string, body: CreateZentaoBindingPayload) =>
    request<ZentaoBinding>(`/v1/projects/${projectId}/bindings`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteProjectBinding: (projectId: string, bindingId: string) =>
    request<Record<string, never>>(`/v1/projects/${projectId}/bindings/${bindingId}`, {
      method: 'DELETE',
    }),
  getSprintBindings: (sprintId: string) => request<ListResponse<ZentaoBinding>>(`/v1/sprints/${sprintId}/bindings`),
  createSprintBinding: (sprintId: string, body: CreateZentaoBindingPayload) =>
    request<ZentaoBinding>(`/v1/sprints/${sprintId}/bindings`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteSprintBinding: (sprintId: string, bindingId: string) =>
    request<Record<string, never>>(`/v1/sprints/${sprintId}/bindings/${bindingId}`, {
      method: 'DELETE',
    }),
  getRequirementBindings: (requirementId: string) =>
    request<ListResponse<ZentaoBinding>>(`/v1/requirements/${requirementId}/bindings`),
  createRequirementBinding: (requirementId: string, body: CreateZentaoBindingPayload) =>
    request<ZentaoBinding>(`/v1/requirements/${requirementId}/bindings`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteRequirementBinding: (requirementId: string, bindingId: string) =>
    request<Record<string, never>>(`/v1/requirements/${requirementId}/bindings/${bindingId}`, {
      method: 'DELETE',
    }),
}
