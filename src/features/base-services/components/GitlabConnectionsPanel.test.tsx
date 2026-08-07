import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import { GitlabConnectionsPanel } from './GitlabConnectionsPanel'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderPanel(projectId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <GitlabConnectionsPanel projectId={projectId} />
    </QueryClientProvider>,
  )
}

describe('GitlabConnectionsPanel', () => {
  it('loads the project-scoped connection list', async () => {
    vi.spyOn(api, 'getGitlabConnections').mockResolvedValue([] as never)
    renderPanel('project-1')

    expect(await screen.findByText('还没有 GitLab 连接')).toBeInTheDocument()
    expect(screen.queryByText('管理仓库访问、Webhook 与流水线状态所使用的连接')).not.toBeInTheDocument()

    expect(api.getGitlabConnections).toHaveBeenCalledWith('project-1')
  })

  it('disables creation until a project is selected', () => {
    renderPanel()

    expect(screen.getByText('请先选择项目')).toBeInTheDocument()
    screen.getAllByRole('button', { name: '新建 GitLab 连接' }).forEach((button) => {
      expect(button).toBeDisabled()
    })
  })
})
