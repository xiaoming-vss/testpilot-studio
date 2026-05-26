import { request } from '@/shared/api/request'
import type { Requirement, RequirementCreatePayload, RequirementUpdatePayload } from '../types'

export const requirementsApi = {
  getRequirements: (sprintId: string) => request<Requirement[]>(`/v1/sprints/${sprintId}/requirements`),
  createRequirement: (sprintId: string, body: RequirementCreatePayload) =>
    request<Requirement>(`/v1/sprints/${sprintId}/requirements`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getRequirement: (requirementId: string) => request<Requirement>(`/v1/requirements/${requirementId}`),
  updateRequirement: (requirementId: string, body: RequirementUpdatePayload) =>
    request<Requirement>(`/v1/requirements/${requirementId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRequirement: (requirementId: string) =>
    request<Record<string, never>>(`/v1/requirements/${requirementId}`, { method: 'DELETE' }),
}
