import { request } from '@/shared/api/request'
import type { CreateZentaoConnectionPayload, UpdateZentaoConnectionPayload, ZentaoConnection } from '../types'

export const baseServicesApi = {
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
}
