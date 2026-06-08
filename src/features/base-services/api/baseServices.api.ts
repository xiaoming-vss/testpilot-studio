import { request } from '@/shared/api/request'
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

export const baseServicesApi = {
  getLlmConnections: () => request<LlmConnection[]>('/v1/integrations/llm/connections'),
  getLlmConnection: (connectionId: string) =>
    request<LlmConnection>(`/v1/integrations/llm/connections/${connectionId}`),
  createLlmConnection: (body: CreateLlmConnectionPayload) =>
    request<LlmConnection>('/v1/integrations/llm/connections', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateLlmConnection: (connectionId: string, body: UpdateLlmConnectionPayload) =>
    request<LlmConnection>(`/v1/integrations/llm/connections/${connectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteLlmConnection: (connectionId: string) =>
    request<Record<string, never>>(`/v1/integrations/llm/connections/${connectionId}`, {
      method: 'DELETE',
    }),
  getZentaoConnections: () => request<ZentaoConnection[]>('/v1/integrations/zentao/connections'),
  getZentaoConnection: (connectionId: string) =>
    request<ZentaoConnection>(`/v1/integrations/zentao/connections/${connectionId}`),
  createZentaoConnection: (body: CreateZentaoConnectionPayload) =>
    request<ZentaoConnection>('/v1/integrations/zentao/connections', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateZentaoConnection: (connectionId: string, body: UpdateZentaoConnectionPayload) =>
    request<ZentaoConnection>(`/v1/integrations/zentao/connections/${connectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  reauthZentaoConnection: (connectionId: string) =>
    request<ZentaoConnection>(`/v1/integrations/zentao/connections/${connectionId}/reauth`, {
      method: 'POST',
    }),
  deleteZentaoConnection: (connectionId: string) =>
    request<Record<string, never>>(`/v1/integrations/zentao/connections/${connectionId}`, {
      method: 'DELETE',
    }),
  getZentaoRemoteProjects: (connectionId: string, page = 1, pageSize = 100) =>
    request<ZentaoRemoteListResponse<ZentaoRemoteOption>>(
      `/v1/integrations/zentao/connections/${connectionId}/projects?page=${page}&pageSize=${pageSize}`,
    ),
  getZentaoRemoteExecutions: (connectionId: string, remoteProjectId: string, page = 1, pageSize = 100) =>
    request<ZentaoRemoteListResponse<ZentaoRemoteOption>>(
      `/v1/integrations/zentao/connections/${connectionId}/projects/${encodeURIComponent(remoteProjectId)}/executions?page=${page}&pageSize=${pageSize}`,
    ),
  getZentaoRemoteTestTasks: (connectionId: string, remoteExecutionId: string, page = 1, pageSize = 100) =>
    request<ZentaoRemoteListResponse<ZentaoRemoteOption>>(
      `/v1/integrations/zentao/connections/${connectionId}/executions/${encodeURIComponent(remoteExecutionId)}/testtasks?page=${page}&pageSize=${pageSize}`,
    ),
  getZentaoRemoteStories: (connectionId: string, remoteExecutionId: string, page = 1, pageSize = 100) =>
    request<ZentaoRemoteListResponse<ZentaoRemoteOption>>(
      `/v1/integrations/zentao/connections/${connectionId}/executions/${encodeURIComponent(remoteExecutionId)}/stories?page=${page}&pageSize=${pageSize}`,
    ),
  getProjectBindings: (projectId: string) => request<ZentaoBinding[]>(`/v1/projects/${projectId}/bindings`),
  createProjectBinding: (projectId: string, body: CreateZentaoBindingPayload) =>
    request<ZentaoBinding>(`/v1/projects/${projectId}/bindings`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteProjectBinding: (projectId: string, bindingId: string) =>
    request<Record<string, never>>(`/v1/projects/${projectId}/bindings/${bindingId}`, {
      method: 'DELETE',
    }),
  getSprintBindings: (sprintId: string) => request<ZentaoBinding[]>(`/v1/sprints/${sprintId}/bindings`),
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
    request<ZentaoBinding[]>(`/v1/requirements/${requirementId}/bindings`),
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
