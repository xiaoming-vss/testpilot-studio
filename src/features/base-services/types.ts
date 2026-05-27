export type IntegrationConnectionStatus = 'active' | 'auth_failed' | 'disabled' | (string & {})

export type ZentaoConnection = {
  connectionId: string
  provider: 'zentao' | string
  name: string
  baseUrl: string
  authType: 'account_password' | string
  account: string
  status: IntegrationConnectionStatus
  hasAccessToken: boolean
  tokenExpiresAt?: string
  lastAuthAt?: string
  lastAuthError?: string
  createdAt?: string
  updatedAt?: string
}

export type CreateZentaoConnectionPayload = {
  name: string
  baseUrl: string
  account: string
  password: string
}

export type UpdateZentaoConnectionPayload = Partial<CreateZentaoConnectionPayload>
