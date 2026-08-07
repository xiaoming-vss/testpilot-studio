import { describe, expect, it } from 'vitest'
import type { GitlabConnection } from '../types'
import { buildGitlabCreatePayload, buildGitlabUpdatePayload } from './gitlabConnectionPayload'

const connection: GitlabConnection = {
  connectionId: 'connection-1',
  projectId: 'project-1',
  provider: 'gitlab',
  name: '公司 GitLab',
  baseUrl: 'https://gitlab.example.com',
  authType: 'personal_access_token',
  account: '',
  status: 'active',
  hasAccessToken: true,
}

describe('GitLab connection payloads', () => {
  it('trims fields when creating a connection', () => {
    expect(buildGitlabCreatePayload({
      name: ' 公司 GitLab ',
      baseUrl: ' https://gitlab.example.com ',
      accessToken: ' glpat-token ',
    })).toEqual({ name: '公司 GitLab', baseUrl: 'https://gitlab.example.com', accessToken: 'glpat-token' })
  })

  it('omits an empty token when editing', () => {
    expect(buildGitlabUpdatePayload(connection, {
      name: '新连接名称',
      baseUrl: connection.baseUrl,
      accessToken: '   ',
    })).toEqual({ name: '新连接名称' })
  })

  it('includes a new token when editing', () => {
    expect(buildGitlabUpdatePayload(connection, {
      name: connection.name,
      baseUrl: connection.baseUrl,
      accessToken: ' glpat-new-token ',
    })).toEqual({ accessToken: 'glpat-new-token' })
  })
})
