import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/app/providers/ThemeProvider'
import { useWorkbenchStore } from '@/features/projects/store/workbench.store'
import { UnifiedAiTestingPage } from './UnifiedAiTestingPage'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ code: status < 400 ? 0 : status, message: status < 400 ? 'ok' : '请求失败', data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function installFetchHandler(onRequest?: (url: URL, init?: RequestInit) => Response | undefined) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(requestUrl, 'http://localhost')
    const handled = onRequest?.(url, init)
    if (handled) return handled

    if (url.pathname === '/v1/projects') return jsonResponse([{ projectId: 'project-1', name: '示例项目' }])
    if (url.pathname === '/v1/projects/project-1/sprints') {
      return jsonResponse({ items: [{ sprintId: 'sprint-1', name: '迭代一' }], total: 1 })
    }
    if (url.pathname === '/v1/sprints/sprint-1/requirements') {
      return jsonResponse({ items: [{ requirementId: 'requirement-1', name: '登录需求' }], total: 1 })
    }
    if (url.pathname.includes('case-generate-tasks')) return jsonResponse({ items: [], total: 0 })
    return jsonResponse({ items: [], total: 0 })
  })
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/ai-testing/tasks']}>
          <Routes>
            <Route path="/ai-testing/tasks" element={<UnifiedAiTestingPage />} />
            <Route path="/ai-testing/ui-tasks/:taskId" element={<UiDetailProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

function UiDetailProbe() {
  const location = useLocation()
  const state = location.state as { pendingSourceArchive?: File; pendingSourceArchiveError?: string } | null
  return <div>UI 任务详情 {state?.pendingSourceArchive?.name} {state?.pendingSourceArchiveError}</div>
}

beforeEach(() => {
  useWorkbenchStore.setState({ activeProjectId: 'project-1' })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useWorkbenchStore.setState({ activeProjectId: undefined })
})

describe('统一任务列表中的 UI 用例生成', () => {
  it('创建 UI 任务后上传所选 ZIP 并进入详情', async () => {
    const requests: Array<{ path: string; method: string; body?: unknown }> = []
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/projects/project-1/ui-case-generate-tasks' && init?.method === 'POST') {
        requests.push({ path: url.pathname, method: init.method, body: JSON.parse(String(init.body)) })
        return jsonResponse({
          taskId: 'ui-task-1',
          taskType: 'ui_case_generate',
          name: '登录模块 UI 用例生成',
          projectId: 'project-1',
          sprintId: 'sprint-1',
          requirementId: 'requirement-1',
          sourceType: 'source_archive',
          sourceContent: '',
          sourceArchive: null,
          instruction: '覆盖表单校验',
        })
      }
      if (url.pathname === '/v1/ui-case-generate-tasks/ui-task-1/source-archive' && init?.method === 'PUT') {
        requests.push({ path: url.pathname, method: init.method, body: init.body })
        return jsonResponse({
          taskId: 'ui-task-1',
          sourceArchive: {
            archiveId: 'archive-1',
            filename: 'source.zip',
            sizeBytes: 4,
            sha256: 'abc123',
            uploadedAt: '2026-08-02T08:00:00.000Z',
          },
        })
      }
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: /新建任务/ }))
    await user.click(screen.getByRole('button', { name: /UI测试/ }))
    await user.click(screen.getByRole('button', { name: /确\s*认/ }))

    await user.type(await screen.findByLabelText('任务名称'), '登录模块 UI 用例生成')
    await user.click(screen.getByLabelText('所属需求'))
    await user.click(await screen.findByText('登录需求'))
    await user.upload(screen.getByLabelText('源码 ZIP'), new File(['zip'], 'source.zip', { type: 'application/zip' }))
    await user.type(screen.getByLabelText('生成指令'), '覆盖表单校验')
    await user.click(screen.getByRole('button', { name: '创建并上传' }))

    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[0]).toEqual({
      path: '/v1/projects/project-1/ui-case-generate-tasks',
      method: 'POST',
      body: {
        name: '登录模块 UI 用例生成',
        sprintId: 'sprint-1',
        requirementId: 'requirement-1',
        instruction: '覆盖表单校验',
      },
    })
    expect(requests[1].body).toBeInstanceOf(FormData)
    expect((requests[1].body as FormData).get('file')).toBeInstanceOf(File)
    expect(await screen.findByText('UI 任务详情')).toBeInTheDocument()
  })

  it('requirementId 和 ZIP 缺失时不创建任务', async () => {
    const fetchSpy = installFetchHandler()
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /新建任务/ }))
    await user.click(screen.getByRole('button', { name: /UI测试/ }))
    await user.click(screen.getByRole('button', { name: /确\s*认/ }))
    await user.type(await screen.findByLabelText('任务名称'), '缺少来源的任务')
    await user.click(screen.getByRole('button', { name: '创建并上传' }))

    expect(await screen.findByText('请选择所属需求')).toBeInTheDocument()
    expect(screen.getByText('请选择源码 ZIP')).toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([input, init]) => String(input).includes('/ui-case-generate-tasks') && init?.method === 'POST')).toBe(false)
  })

  it('任务创建成功但上传失败时保留任务并进入详情重试', async () => {
    let deleteRequested = false
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/projects/project-1/ui-case-generate-tasks' && init?.method === 'POST') {
        return jsonResponse({ ...taskForUploadFailure, taskId: 'ui-task-retry' })
      }
      if (url.pathname === '/v1/ui-case-generate-tasks/ui-task-retry/source-archive' && init?.method === 'PUT') {
        return new Response(JSON.stringify({ code: 400, message: 'ZIP 已损坏', data: {} }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.pathname === '/v1/ui-case-generate-tasks/ui-task-retry' && init?.method === 'DELETE') deleteRequested = true
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /新建任务/ }))
    await user.click(screen.getByRole('button', { name: /UI测试/ }))
    await user.click(screen.getByRole('button', { name: /确\s*认/ }))
    await user.type(await screen.findByLabelText('任务名称'), '待重试任务')
    await user.click(screen.getByLabelText('所属需求'))
    await user.click(await screen.findByText('登录需求'))
    await user.upload(screen.getByLabelText('源码 ZIP'), new File(['broken'], 'broken.zip', { type: 'application/zip' }))
    await user.click(screen.getByRole('button', { name: '创建并上传' }))

    expect(await screen.findByText(/UI 任务详情 broken.zip ZIP 已损坏/)).toBeInTheDocument()
    expect(deleteRequested).toBe(false)
  })
})

const taskForUploadFailure = {
  taskType: 'ui_case_generate',
  name: '待重试任务',
  projectId: 'project-1',
  sprintId: 'sprint-1',
  requirementId: 'requirement-1',
  sourceType: 'source_archive',
  sourceContent: '',
  sourceArchive: null,
  instruction: '',
}
