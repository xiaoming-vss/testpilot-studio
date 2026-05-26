import { request } from '@/shared/api/request'
import type { Project, ProjectUpdatePayload, Sprint, SprintCreatePayload, SprintUpdatePayload } from '../types'

export const projectsApi = {
  getProjects: () => request<Project[]>('/v1/projects'),
  createProject: (body: Pick<Project, 'name' | 'description'>) =>
    request<Project>('/v1/projects', { method: 'POST', body: JSON.stringify(body) }),
  getProject: (projectId: string) => request<Project>(`/v1/projects/${projectId}`),
  updateProject: (projectId: string, body: ProjectUpdatePayload) =>
    request<Project>(`/v1/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (projectId: string) =>
    request<Record<string, never>>(`/v1/projects/${projectId}`, { method: 'DELETE' }),
  getSprints: (projectId: string) => request<Sprint[]>(`/v1/projects/${projectId}/sprints`),
  createSprint: (projectId: string, body: SprintCreatePayload) =>
    request<Sprint>(`/v1/projects/${projectId}/sprints`, { method: 'POST', body: JSON.stringify(body) }),
  getSprint: (sprintId: string) => request<Sprint>(`/v1/sprints/${sprintId}`),
  updateSprint: (sprintId: string, body: SprintUpdatePayload) =>
    request<Sprint>(`/v1/sprints/${sprintId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSprint: (sprintId: string) =>
    request<Record<string, never>>(`/v1/sprints/${sprintId}`, { method: 'DELETE' }),
}
