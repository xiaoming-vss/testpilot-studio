import type { CreateGitlabConnectionPayload, GitlabConnection, UpdateGitlabConnectionPayload } from '../types'
import type { GitlabConnectionFormValues } from '../components/GitlabConnectionDrawer'

export function buildGitlabCreatePayload(values: GitlabConnectionFormValues): CreateGitlabConnectionPayload {
  return {
    name: values.name.trim(),
    baseUrl: values.baseUrl.trim(),
    accessToken: values.accessToken.trim(),
  }
}

export function buildGitlabUpdatePayload(
  current: GitlabConnection,
  values: GitlabConnectionFormValues,
): UpdateGitlabConnectionPayload {
  const payload: UpdateGitlabConnectionPayload = {}
  const nextName = values.name.trim()
  const nextBaseUrl = values.baseUrl.trim()
  const nextAccessToken = values.accessToken.trim()

  if (current.name !== nextName) payload.name = nextName
  if (current.baseUrl !== nextBaseUrl) payload.baseUrl = nextBaseUrl
  if (nextAccessToken) payload.accessToken = nextAccessToken

  return payload
}
