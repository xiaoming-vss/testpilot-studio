import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/app/providers/ThemeProvider'
import { ApiCaseGenerateTaskDetailPage } from './ApiCaseGenerateTaskDetailPage'

const task = {
  taskId: 'task-1',
  taskType: 'api_case_generate',
  name: '登录 API 用例生成',
  projectId: 'project-1',
  sprintId: 'sprint-1',
  requirementId: 'requirement-1',
  sourceType: 'openapi',
  sourceContent: '{}',
  instruction: '生成登录用例',
}

const run = {
  runId: 'run-1',
  taskId: 'task-1',
  projectId: 'project-1',
  requirementId: 'requirement-1',
  status: 'success',
  reviewStatus: 'pending',
  importStatus: 'pending',
  importedTargets: [],
  resultYaml: 'cases:\n  - name: Login\n',
  createdAt: '2026-08-02T07:00:00.000Z',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ code: status < 400 ? 0 : status, message: status < 400 ? 'ok' : '请求失败', data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ code: status, message, data: {} }), {
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

    if (url.pathname === '/v1/api-case-generate-tasks/task-1') return jsonResponse(task)
    if (url.pathname === '/v1/api-case-generate-tasks/task-1/runs') return jsonResponse({ items: [run], total: 1 })
    if (url.pathname === '/v1/api-case-generate-task-runs/run-1') return jsonResponse(run)
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
        <MemoryRouter initialEntries={['/ai-testing/tasks/task-1']}>
          <Routes>
            <Route path="/ai-testing/tasks/:taskId" element={<ApiCaseGenerateTaskDetailPage />} />
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

describe('API 候选结果审核与导入', () => {
  it('成功运行的待审核候选可以编辑并保存完整 YAML', async () => {
    const savedYaml = 'cases:\n  - name: Login success\n'
    let patchBody: unknown
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1/result' && init?.method === 'PATCH') {
        patchBody = JSON.parse(String(init.body))
        return jsonResponse({ ...run, resultYaml: savedYaml })
      }
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: '审核候选结果' }))
    const editor = await screen.findByRole('textbox', { name: '候选结果 YAML' })
    await user.click(editor)
    await user.keyboard('{Control>}a{/Control}')
    await user.paste(savedYaml)
    await user.click(screen.getByRole('button', { name: '保存候选结果' }))

    await waitFor(() => {
      expect(patchBody).toEqual({ resultYaml: savedYaml })
    })
    expect(await screen.findByText('候选结果已保存')).toBeInTheDocument()
  })

  it('保存失败时展示错误并保留当前候选草稿', async () => {
    const invalidYaml = 'cases:\n  - name: Login\n  - name: login\n'
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1/result' && init?.method === 'PATCH') {
        return errorResponse('候选名称去除首尾空格并忽略大小写后不能重复', 400)
      }
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: '审核候选结果' }))
    const editor = await screen.findByRole('textbox', { name: '候选结果 YAML' })
    await user.click(editor)
    await user.keyboard('{Control>}a{/Control}')
    await user.paste(invalidYaml)
    await user.click(screen.getByRole('button', { name: '保存候选结果' }))

    expect(await screen.findByText('候选名称去除首尾空格并忽略大小写后不能重复')).toBeInTheDocument()
    expect(editor).toHaveTextContent('name: Login')
    expect(editor).toHaveTextContent('name: login')
  })

  it('批准候选时不选择集合并进入已批准待导入状态', async () => {
    let reviewBody: unknown
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1/review' && init?.method === 'POST') {
        reviewBody = JSON.parse(String(init.body))
        return jsonResponse({
          ...run,
          reviewStatus: 'approved',
          reviewComment: '内容符合预期',
          reviewedAt: '2026-08-02T08:00:00.000Z',
          importStatus: 'pending',
          importedTargets: [],
        })
      }
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: '审核候选结果' }))
    await user.type(screen.getByRole('textbox', { name: '审核备注' }), '内容符合预期')
    await user.click(screen.getByRole('button', { name: '批准候选' }))

    await waitFor(() => {
      expect(reviewBody).toEqual({ action: 'approve', reviewComment: '内容符合预期' })
    })
    expect(await screen.findByText('已批准')).toBeInTheDocument()
    expect(screen.getByText('待导入')).toBeInTheDocument()
    expect(screen.queryByText('请选择API测试集')).not.toBeInTheDocument()
  })

  it('已批准候选可以独立导入并展示目标与导入时间', async () => {
    const approvedRun = { ...run, reviewStatus: 'approved', importStatus: 'pending' }
    const importedRun = {
      ...approvedRun,
      importStatus: 'imported',
      importedAt: '2026-08-02T09:30:00.000Z',
      importedTargets: [{ targetType: 'api_collection', targetId: 'collection-1' }],
    }
    let importBody: unknown
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-tasks/task-1/runs') {
        return jsonResponse({ items: [approvedRun], total: 1 })
      }
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1' && !init?.method) return jsonResponse(approvedRun)
      if (url.pathname === '/v1/requirements/requirement-1/api-collections') {
        return jsonResponse({ items: [{ collectionId: 'collection-1', name: '登录接口集' }], total: 1 })
      }
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1/import' && init?.method === 'POST') {
        importBody = JSON.parse(String(init.body))
        return jsonResponse({ requiresConfirmation: false, conflicts: [], run: importedRun })
      }
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: '导入 API 集合' }))
    await user.click(screen.getByRole('combobox', { name: '目标 API 集合' }))
    await user.click(await screen.findByText('登录接口集'))
    await user.click(screen.getByRole('button', { name: '开始导入' }))

    await waitFor(() => {
      expect(importBody).toEqual({ collectionId: 'collection-1' })
    })
    expect(await screen.findByText('已导入')).toBeInTheDocument()
    expect(screen.getByText(/登录接口集/)).toBeInTheDocument()
    expect(screen.getByText(/2026/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '导入 API 集合' })).not.toBeInTheDocument()
  })

  it('无权访问目标集合时保留已批准待导入并允许重试', async () => {
    const approvedRun = { ...run, reviewStatus: 'approved', importStatus: 'pending' }
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-tasks/task-1/runs') {
        return jsonResponse({ items: [approvedRun], total: 1 })
      }
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1' && !init?.method) return jsonResponse(approvedRun)
      if (url.pathname === '/v1/requirements/requirement-1/api-collections') {
        return jsonResponse({ items: [{ collectionId: 'collection-1', name: '受限接口集' }], total: 1 })
      }
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1/import' && init?.method === 'POST') {
        return errorResponse('无权访问目标 API 集合', 403)
      }
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: '导入 API 集合' }))
    await user.click(screen.getByRole('combobox', { name: '目标 API 集合' }))
    await user.click(await screen.findByText('受限接口集'))
    await user.click(screen.getByRole('button', { name: '开始导入' }))

    expect(await screen.findByText('无权访问目标 API 集合')).toBeInTheDocument()
    expect(screen.getByText('已批准')).toBeInTheDocument()
    expect(screen.getByText('待导入')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始导入' })).toBeEnabled()
    expect(screen.queryByText('已导入')).not.toBeInTheDocument()
  })

  it('导入冲突时完整对比新旧用例且取消后仍可重试', async () => {
    const approvedRun = { ...run, reviewStatus: 'approved', importStatus: 'pending' }
    let importRequests = 0
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-tasks/task-1/runs') {
        return jsonResponse({ items: [approvedRun], total: 1 })
      }
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1' && !init?.method) return jsonResponse(approvedRun)
      if (url.pathname === '/v1/requirements/requirement-1/api-collections') {
        return jsonResponse({ items: [{ collectionId: 'collection-1', name: '登录接口集' }], total: 1 })
      }
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1/import' && init?.method === 'POST') {
        importRequests += 1
        return jsonResponse({
          requiresConfirmation: true,
          conflicts: [{
            normalizedName: 'login',
            existingCase: {
              name: '正式登录', description: '旧描述', enabled: true, orderNo: 1, method: 'POST',
              urlTemplate: '/v1/login', headers: { Authorization: 'old' }, query: { locale: 'zh-CN' },
              bodyType: 'json', bodyJson: '{"old":true}', bodyText: '', timeoutMs: 3000,
              continueOnFailure: false,
              extractRules: [{ name: '旧令牌', enabled: true, orderNo: 1, source: 'body_jsonpath', sourceExpr: '$.token', varKey: 'token', defaultValue: '' }],
              assertRules: [{ name: '旧状态', enabled: true, orderNo: 1, assertSource: 'status_code', targetExpr: '', comparator: 'eq', expectedValue: '200' }],
            },
            generatedCase: {
              name: '候选登录', description: '新描述', enabled: true, orderNo: 2, method: 'POST',
              urlTemplate: '/v2/login', headers: { Authorization: 'new' }, query: { locale: 'en-US' },
              bodyType: 'json', bodyJson: '{"new":true}', bodyText: '', timeoutMs: 5000,
              continueOnFailure: true,
              extractRules: [{ name: '新令牌', enabled: true, orderNo: 2, source: 'body_jsonpath', sourceExpr: '$.data.token', varKey: 'accessToken', defaultValue: 'none' }],
              assertRules: [{ name: '新状态', enabled: true, orderNo: 2, assertSource: 'status_code', targetExpr: '', comparator: 'eq', expectedValue: '201' }],
            },
          }],
          run: { reviewStatus: 'approved', importStatus: 'pending' },
        })
      }
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: '导入 API 集合' }))
    await user.click(screen.getByRole('combobox', { name: '目标 API 集合' }))
    await user.click(await screen.findByText('登录接口集'))
    await user.click(screen.getByRole('button', { name: '开始导入' }))

    expect(await screen.findByText('确认覆盖冲突')).toBeInTheDocument()
    expect(screen.getByText('正式登录')).toBeInTheDocument()
    expect(screen.getAllByText('候选登录').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Authorization/).length).toBe(2)
    expect(screen.getAllByText(/\$\.token/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/status_code/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: '取消覆盖' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '确认覆盖冲突' })).not.toBeInTheDocument())
    expect(screen.getByText('已批准')).toBeInTheDocument()
    expect(screen.getByText('待导入')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导入 API 集合' })).toBeEnabled()
    expect(importRequests).toBe(1)
  })

  it('确认覆盖时携带 confirmOverwrite 并以重新检查的响应为准', async () => {
    const approvedRun = { ...run, reviewStatus: 'approved', importStatus: 'pending' }
    const importedRun = {
      ...approvedRun,
      importStatus: 'imported',
      importedAt: '2026-08-02T10:00:00.000Z',
      importedTargets: [{ targetType: 'api_collection', targetId: 'collection-1' }],
    }
    const requestBodies: unknown[] = []
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-tasks/task-1/runs') {
        return jsonResponse({ items: [approvedRun], total: 1 })
      }
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1' && !init?.method) return jsonResponse(approvedRun)
      if (url.pathname === '/v1/requirements/requirement-1/api-collections') {
        return jsonResponse({ items: [{ collectionId: 'collection-1', name: '登录接口集' }], total: 1 })
      }
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1/import' && init?.method === 'POST') {
        requestBodies.push(JSON.parse(String(init.body)))
        if (requestBodies.length === 1) {
          return jsonResponse({
            requiresConfirmation: true,
            conflicts: [{ normalizedName: 'login', existingCase: { name: '旧冲突' }, generatedCase: { name: '第一次候选' } }],
            run: { reviewStatus: 'approved', importStatus: 'pending' },
          })
        }
        if (requestBodies.length === 2) {
          return jsonResponse({
            requiresConfirmation: true,
            conflicts: [{ normalizedName: 'login-v2', existingCase: { name: '新冲突' }, generatedCase: { name: '重新检查候选' } }],
            run: approvedRun,
          })
        }
        return jsonResponse({ requiresConfirmation: false, conflicts: [], run: importedRun })
      }
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: '导入 API 集合' }))
    await user.click(screen.getByRole('combobox', { name: '目标 API 集合' }))
    await user.click(await screen.findByText('登录接口集'))
    await user.click(screen.getByRole('button', { name: '开始导入' }))
    await user.click(await screen.findByRole('button', { name: '整批确认覆盖' }))

    expect((await screen.findAllByText('重新检查候选')).length).toBeGreaterThan(0)
    expect(screen.queryAllByText('第一次候选')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: '整批确认覆盖' }))

    await waitFor(() => {
      expect(requestBodies).toEqual([
        { collectionId: 'collection-1' },
        { collectionId: 'collection-1', confirmOverwrite: true },
        { collectionId: 'collection-1', confirmOverwrite: true },
      ])
    })
    expect(await screen.findByText('已导入')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '导入 API 集合' })).not.toBeInTheDocument()
  }, 15_000)

  it('候选草稿未保存时禁用审核操作并在关闭前确认放弃', async () => {
    installFetchHandler()
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: '审核候选结果' }))
    const editor = await screen.findByRole('textbox', { name: '候选结果 YAML' })
    await user.click(editor)
    await user.keyboard('{Control>}a{/Control}')
    await user.paste('cases:\n  - name: Changed\n')

    expect(screen.getByRole('button', { name: '批准候选' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '拒绝候选' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '取 消' }))
    expect((await screen.findAllByText('修改尚未保存，确定放弃吗？')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: '继续编辑' }))
    expect(screen.getByRole('textbox', { name: '候选结果 YAML' })).toBeInTheDocument()
  })

  it('审核完成后候选结果只读且不再显示审核操作', async () => {
    const approvedRun = { ...run, reviewStatus: 'approved', importStatus: 'pending' }
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-tasks/task-1/runs') return jsonResponse({ items: [approvedRun], total: 1 })
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1' && !init?.method) return jsonResponse(approvedRun)
    })
    const user = userEvent.setup()

    renderPage()

    expect(screen.queryByRole('button', { name: '审核候选结果' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '查看候选结果' }))
    expect(await screen.findByRole('textbox', { name: '候选结果 YAML' })).toHaveAttribute('aria-readonly', 'true')
    expect(screen.queryByRole('button', { name: '保存候选结果' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '批准候选' })).not.toBeInTheDocument()
  })

  it('非成功运行不能批准或导入', async () => {
    const failedRun = { ...run, status: 'failed', reviewStatus: 'pending', errorMessage: '生成失败' }
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-tasks/task-1/runs') return jsonResponse({ items: [failedRun], total: 1 })
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1' && !init?.method) return jsonResponse(failedRun)
    })

    renderPage()

    expect(await screen.findByText('失败')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '审核候选结果' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '导入 API 集合' })).not.toBeInTheDocument()
  })

  it('待审核运行不能发起导入', async () => {
    installFetchHandler()
    renderPage()

    expect(await screen.findByRole('button', { name: '审核候选结果' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '导入 API 集合' })).not.toBeInTheDocument()
  })

  it('拒绝请求只发送审核字段并冻结候选结果', async () => {
    let reviewBody: unknown
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1/review' && init?.method === 'POST') {
        reviewBody = JSON.parse(String(init.body))
        return jsonResponse({ ...run, reviewStatus: 'rejected', reviewComment: '字段不完整' })
      }
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: '审核候选结果' }))
    await user.type(screen.getByRole('textbox', { name: '审核备注' }), '字段不完整')
    await user.click(screen.getByRole('button', { name: '拒绝候选' }))

    await waitFor(() => expect(reviewBody).toEqual({ action: 'reject', reviewComment: '字段不完整' }))
    expect(await screen.findByText('已拒绝')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '导入 API 集合' })).not.toBeInTheDocument()
  })

  it('不依赖旧 importedCollectionId 判断是否已导入', async () => {
    const approvedRunWithLegacyTarget = {
      ...run,
      reviewStatus: 'approved',
      importStatus: 'pending',
      importedCollectionId: 'legacy-collection',
      importedTargets: [],
    }
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-tasks/task-1/runs') {
        return jsonResponse({ items: [approvedRunWithLegacyTarget], total: 1 })
      }
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1' && !init?.method) return jsonResponse(approvedRunWithLegacyTarget)
    })

    renderPage()

    expect(await screen.findByText('待导入')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '导入 API 集合' }, { timeout: 5_000 })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '查看目标集合' })).not.toBeInTheDocument()
  })

  it.each([
    [400, '运行状态不满足导入条件'],
    [404, '目标 API 集合不存在'],
    [500, '导入持久化失败'],
  ])('导入返回 %i 时保持已批准待导入并可重试', async (status, errorMessage) => {
    const approvedRun = { ...run, reviewStatus: 'approved', importStatus: 'pending' }
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-tasks/task-1/runs') return jsonResponse({ items: [approvedRun], total: 1 })
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1' && !init?.method) return jsonResponse(approvedRun)
      if (url.pathname === '/v1/requirements/requirement-1/api-collections') {
        return jsonResponse({ items: [{ collectionId: 'collection-1', name: '登录接口集' }], total: 1 })
      }
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1/import' && init?.method === 'POST') {
        return errorResponse(errorMessage, status)
      }
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: '导入 API 集合' }))
    await user.click(screen.getByRole('combobox', { name: '目标 API 集合' }))
    await user.click(await screen.findByText('登录接口集'))
    await user.click(screen.getByRole('button', { name: '开始导入' }))

    expect(await screen.findByText(errorMessage)).toBeInTheDocument()
    expect(screen.getByText('已批准')).toBeInTheDocument()
    expect(screen.getByText('待导入')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始导入' })).toBeEnabled()
  })

  it('确认覆盖失败后保持冲突上下文、审核状态并允许重试', async () => {
    const approvedRun = { ...run, reviewStatus: 'approved', importStatus: 'pending' }
    const requestBodies: unknown[] = []
    installFetchHandler((url, init) => {
      if (url.pathname === '/v1/api-case-generate-tasks/task-1/runs') return jsonResponse({ items: [approvedRun], total: 1 })
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1' && !init?.method) return jsonResponse(approvedRun)
      if (url.pathname === '/v1/requirements/requirement-1/api-collections') {
        return jsonResponse({ items: [{ collectionId: 'collection-1', name: '登录接口集' }], total: 1 })
      }
      if (url.pathname === '/v1/api-case-generate-task-runs/run-1/import' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        requestBodies.push(body)
        if (requestBodies.length === 1) {
          return jsonResponse({
            requiresConfirmation: true,
            conflicts: [{ normalizedName: 'login', existingCase: { name: '正式登录' }, generatedCase: { name: '候选登录' } }],
            run: { reviewStatus: 'approved', importStatus: 'pending' },
          })
        }
        return errorResponse('导入持久化失败', 500)
      }
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: '导入 API 集合' }))
    await user.click(screen.getByRole('combobox', { name: '目标 API 集合' }))
    await user.click(await screen.findByText('登录接口集'))
    await user.click(screen.getByRole('button', { name: '开始导入' }))
    await user.click(await screen.findByRole('button', { name: '整批确认覆盖' }))

    expect(await screen.findByText('导入持久化失败')).toBeInTheDocument()
    expect(screen.getByText('已批准')).toBeInTheDocument()
    expect(screen.getByText('待导入')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '整批确认覆盖' })).toBeEnabled()
    expect(requestBodies.at(-1)).toEqual({ collectionId: 'collection-1', confirmOverwrite: true })
  })
})
