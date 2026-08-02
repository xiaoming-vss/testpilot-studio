import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/app/providers/ThemeProvider'
import { UiCaseGenerateTaskDetailPage } from './UiCaseGenerateTaskDetailPage'

const task = {
  taskId: 'ui-task-1',
  taskType: 'ui_case_generate',
  name: '登录模块 UI 用例生成',
  projectId: 'project-1',
  sprintId: 'sprint-1',
  requirementId: 'requirement-1',
  sourceType: 'source_archive',
  sourceContent: '',
  sourceArchive: {
    archiveId: 'archive-1',
    filename: 'source.zip',
    sizeBytes: 2048,
    sha256: 'abc123',
    uploadedAt: '2026-08-02T08:00:00.000Z',
  },
  instruction: '覆盖表单校验',
}

const resultYaml = `cases:
  - name: 登录成功
    enabled: true
    orderNo: 1
    stepsJson:
      - orderNo: 1
        stepName: 打开登录页
        keyword: open
        operationValue: https://example.test/login
        continueOnFailure: false
        enabled: true
`

const run = {
  runId: 'ui-run-1',
  taskId: 'ui-task-1',
  projectId: 'project-1',
  status: 'success',
  reviewStatus: 'pending',
  importStatus: 'pending',
  importedTargets: [],
  resultYaml,
  createdAt: '2026-08-02T09:00:00.000Z',
}

function jsonResponse(data: unknown, status = 200, message = 'ok') {
  return new Response(JSON.stringify({ code: status < 400 ? 0 : status, message, data }), {
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
    if (url.pathname === '/v1/ui-case-generate-tasks/ui-task-1') return jsonResponse(task)
    if (url.pathname === '/v1/ui-case-generate-tasks/ui-task-1/runs') return jsonResponse({ items: [run], total: 1 })
    if (url.pathname === '/v1/ui-case-generate-task-runs/ui-run-1') return jsonResponse(run)
    if (url.pathname === '/v1/projects/project-1/integrations/llm/connections') {
      return jsonResponse({ items: [{ connectionId: 'llm-1', name: '主模型', status: 'active' }], total: 1 })
    }
    return jsonResponse({ items: [], total: 0 })
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/ai-testing/ui-tasks/ui-task-1']}>
          <Routes>
            <Route path="/ai-testing/ui-tasks/:taskId" element={<UiCaseGenerateTaskDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('UI 用例生成任务详情', () => {
  it('展示源码包、运行状态和结构化候选步骤，不访问内部 Worker 接口', async () => {
    const fetchSpy = installFetchHandler()
    renderPage()

    expect(await screen.findByText('source.zip')).toBeInTheDocument()
    expect(screen.getByText('2 KiB')).toBeInTheDocument()
    expect(screen.getByText('登录成功')).toBeInTheDocument()
    expect(screen.getByText('打开登录页')).toBeInTheDocument()
    expect(screen.getAllByText('success').length).toBeGreaterThan(0)
    expect(fetchSpy.mock.calls.every(([input]) => !String(input).includes('/internal/ai-worker/'))).toBe(true)
  })

  it('编辑任务时保留并提交必填的迭代与需求', async () => {
    let patchBody: unknown
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/projects/project-1/sprints') {
        return jsonResponse({ items: [{ sprintId: 'sprint-1', name: '迭代一' }], total: 1 })
      }
      if (url.pathname === '/v1/sprints/sprint-1/requirements') {
        return jsonResponse({ items: [{ requirementId: 'requirement-1', name: '登录需求' }], total: 1 })
      }
      if (url.pathname === '/v1/ui-case-generate-tasks/ui-task-1' && init?.method === 'PATCH') {
        patchBody = JSON.parse(String(init.body))
        return jsonResponse({ ...task, name: '更新后的 UI 任务' })
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /编辑任务/ }))
    const nameInput = screen.getByLabelText('编辑任务名称')
    await user.clear(nameInput)
    await user.type(nameInput, '更新后的 UI 任务')
    await user.click(screen.getByRole('button', { name: /^保\s*存$/ }))

    await waitFor(() => expect(patchBody).toEqual({
      name: '更新后的 UI 任务',
      sprintId: 'sprint-1',
      requirementId: 'requirement-1',
      instruction: '覆盖表单校验',
    }))
  })

  it('未上传源码包时禁用运行并解释前置条件', async () => {
    installFetchHandler((url) => {
      if (url.pathname === '/v1/ui-case-generate-tasks/ui-task-1') return jsonResponse({ ...task, sourceArchive: null })
    })
    renderPage()

    const runButton = await screen.findByRole('button', { name: /运行任务/ })
    expect(runButton).toBeDisabled()
    expect(screen.getAllByText('请先上传源码 ZIP').length).toBeGreaterThan(0)
  })

  it('选择 LLM 后运行请求只发送 connectionId', async () => {
    let runBody: unknown
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/ui-case-generate-tasks/ui-task-1/run' && init?.method === 'POST') {
        runBody = JSON.parse(String(init.body))
        return jsonResponse({ ...run, runId: 'ui-run-2', status: 'pending' })
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /运行任务/ }))
    await user.click(await screen.findByText('主模型'))
    await user.click(screen.getByRole('button', { name: /确认运行/ }))

    await waitFor(() => expect(runBody).toEqual({ connectionId: 'llm-1' }))
  })

  it('运行返回 403 时展示权限错误且保留任务内容', async () => {
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/ui-case-generate-tasks/ui-task-1/run' && init?.method === 'POST') {
        return jsonResponse({}, 403, '无权运行该任务')
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /运行任务/ }))
    await user.click(await screen.findByText('主模型'))
    await user.click(screen.getByRole('button', { name: /确认运行/ }))

    expect(await screen.findByText('无权运行该任务')).toBeInTheDocument()
    expect(screen.getByText('source.zip')).toBeInTheDocument()
  })

  it('展示五种运行状态，并在存在活动运行时禁用源码包替换', async () => {
    const statusRuns = ['pending', 'claimed', 'running', 'success', 'failed'].map((status, index) => ({
      ...run,
      runId: `run-${status}`,
      status,
      createdAt: `2026-08-02T0${index + 1}:00:00.000Z`,
    }))
    installFetchHandler((url) => {
      if (url.pathname === '/v1/ui-case-generate-tasks/ui-task-1/runs') return jsonResponse({ items: statusRuns, total: 5 })
      const matched = statusRuns.find((item) => url.pathname.endsWith(`/${item.runId}`))
      if (matched) return jsonResponse(matched)
    })
    renderPage()

    for (const status of ['pending', 'claimed', 'running', 'success', 'failed']) {
      expect((await screen.findAllByText(status)).length).toBeGreaterThan(0)
    }
    expect(screen.getByRole('button', { name: /替换源码包/ })).toBeDisabled()
  })

  it('保存完整 YAML 后可以批准并立即冻结编辑', async () => {
    const savedYaml = resultYaml.replace('登录成功', '登录成功（已确认）')
    let patchBody: unknown
    let reviewBody: unknown
    installFetchHandler((url, init) => {
      if (url.pathname.endsWith('/result') && init?.method === 'PATCH') {
        patchBody = JSON.parse(String(init.body))
        return jsonResponse({ ...run, resultYaml: savedYaml })
      }
      if (url.pathname.endsWith('/review') && init?.method === 'POST') {
        reviewBody = JSON.parse(String(init.body))
        return jsonResponse({ ...run, resultYaml: savedYaml, reviewStatus: 'approved', importStatus: 'pending', importedTargets: [] })
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('tab', { name: '编辑 YAML' }))
    const editor = await screen.findByRole('textbox', { name: '候选结果 YAML' })
    await user.click(editor)
    await user.keyboard('{Control>}a{/Control}')
    await user.paste(savedYaml)
    await user.click(screen.getByRole('button', { name: '保存候选结果' }))

    await waitFor(() => expect(patchBody).toEqual({ resultYaml: savedYaml }))
    await user.click(screen.getByRole('button', { name: '批准候选' }))
    await waitFor(() => expect(reviewBody).toEqual({ action: 'approve' }))
    expect(await screen.findByText('已批准')).toBeInTheDocument()
    expect(screen.getByText('待导入')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /导入/ })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '候选结果 YAML' })).toHaveAttribute('aria-readonly', 'true')
  })

  it('保存失败时保留未保存的 YAML 草稿并允许重试', async () => {
    const invalidYaml = 'cases:\n  - name: [broken'
    installFetchHandler((url, init) => {
      if (url.pathname.endsWith('/result') && init?.method === 'PATCH') {
        return jsonResponse({}, 400, '候选 YAML 结构不合法')
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('tab', { name: '编辑 YAML' }))
    const editor = await screen.findByRole('textbox', { name: '候选结果 YAML' })
    await user.click(editor)
    await user.keyboard('{Control>}a{/Control}')
    await user.paste(invalidYaml)
    await user.click(screen.getByRole('button', { name: '保存候选结果' }))

    expect(await screen.findByText('候选 YAML 结构不合法')).toBeInTheDocument()
    expect(editor).toHaveTextContent('name: [broken')
    expect(screen.getByRole('button', { name: '保存候选结果' })).toBeEnabled()
  })

  it('拒绝候选后冻结编辑且不出现导入入口', async () => {
    installFetchHandler((url, init) => {
      if (url.pathname.endsWith('/review') && init?.method === 'POST') {
        return jsonResponse({ ...run, reviewStatus: 'rejected' })
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('tab', { name: '编辑 YAML' }))
    await user.click(screen.getByRole('button', { name: '拒绝候选' }))

    expect(await screen.findByText('已拒绝')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '候选结果 YAML' })).toHaveAttribute('aria-readonly', 'true')
    expect(screen.queryByRole('button', { name: /导入/ })).not.toBeInTheDocument()
  })

  it('空白候选结果不能审核', async () => {
    installFetchHandler((url) => {
      if (url.pathname === '/v1/ui-case-generate-tasks/ui-task-1/runs') return jsonResponse({ items: [{ ...run, resultYaml: '   ' }], total: 1 })
      if (url.pathname === '/v1/ui-case-generate-task-runs/ui-run-1') return jsonResponse({ ...run, resultYaml: '   ' })
    })
    renderPage()

    expect(await screen.findByRole('button', { name: '批准候选' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '拒绝候选' })).toBeDisabled()
  })

  it('替换源码包要求确认，并使用 multipart file 字段更新当前包', async () => {
    let uploadBody: BodyInit | null | undefined
    installFetchHandler((url, init) => {
      if (url.pathname.endsWith('/source-archive') && init?.method === 'PUT') {
        uploadBody = init.body
        return jsonResponse({ ...task, sourceArchive: { ...task.sourceArchive, filename: 'next.zip' } })
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /替换源码包/ }))
    await user.upload(screen.getByLabelText('新的源码 ZIP'), new File(['next'], 'next.zip', { type: 'application/zip' }))
    expect(screen.getAllByText(/source.zip/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/next.zip/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: /确认替换/ }))

    await waitFor(() => expect(uploadBody).toBeInstanceOf(FormData))
    expect((uploadBody as FormData).get('file')).toBeInstanceOf(File)
    expect((await screen.findAllByText('next.zip')).length).toBeGreaterThan(0)
  })

  it('替换失败时保留原源码包，并展示 413 后端错误', async () => {
    installFetchHandler((url, init) => {
      if (url.pathname.endsWith('/source-archive') && init?.method === 'PUT') {
        return jsonResponse({}, 413, '文件超过网关大小限制')
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /替换源码包/ }))
    await user.upload(screen.getByLabelText('新的源码 ZIP'), new File(['next'], 'next.zip', { type: 'application/zip' }))
    await user.click(screen.getByRole('button', { name: /确认替换/ }))

    expect(await screen.findByText(/源码包超过上传大小限制.*文件超过网关大小限制/)).toBeInTheDocument()
    expect(screen.getAllByText(/source.zip/).length).toBeGreaterThan(0)
  })

  it.each([
    [400, 'ZIP 内容不合法'],
    [404, '任务不存在'],
  ])('上传返回 %s 时展示后端错误并保留旧包', async (status, errorMessage) => {
    installFetchHandler((url, init) => {
      if (url.pathname.endsWith('/source-archive') && init?.method === 'PUT') {
        return jsonResponse({}, status, errorMessage)
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /替换源码包/ }))
    await user.upload(screen.getByLabelText('新的源码 ZIP'), new File(['next'], 'next.zip', { type: 'application/zip' }))
    await user.click(screen.getByRole('button', { name: /确认替换/ }))

    expect(await screen.findByText(errorMessage)).toBeInTheDocument()
    expect(screen.getAllByText(/source.zip/).length).toBeGreaterThan(0)
  })

  it('任务详情返回 403 时显示阻断权限状态，不渲染任务内容', async () => {
    installFetchHandler((url) => {
      if (url.pathname === '/v1/ui-case-generate-tasks/ui-task-1') return jsonResponse({}, 403, '无权查看该任务')
    })
    renderPage()

    expect(await screen.findByText('无权查看该任务')).toBeInTheDocument()
    expect(screen.queryByText('source.zip')).not.toBeInTheDocument()
  })

  it('运行详情返回 403 时隐藏候选内容并显示阻断权限状态', async () => {
    installFetchHandler((url) => {
      if (url.pathname === '/v1/ui-case-generate-task-runs/ui-run-1') return jsonResponse({}, 403, '无权查看该运行')
    })
    renderPage()

    expect(await screen.findByText('无权查看该运行')).toBeInTheDocument()
    expect(screen.queryByText('登录成功')).not.toBeInTheDocument()
    expect(screen.getByText(/候选内容已隐藏/)).toBeInTheDocument()
  })
})
