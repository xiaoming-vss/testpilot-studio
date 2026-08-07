import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/app/providers/ThemeProvider'
import { useThemeStore } from '@/shared/store/theme.store'
import type { FunctionalCaseGenerateTaskRun } from '../types'
import { FunctionalCaseGenerateTaskDetailPage } from './FunctionalCaseGenerateTaskDetailPage'

const task = {
  taskId: 'task-1',
  taskType: 'functional_case_generate',
  name: '登录功能用例生成',
  projectId: 'project-1',
  sprintId: 'sprint-1',
  requirementId: 'requirement-1',
  instruction: '生成登录功能用例',
}

const candidateYaml = JSON.stringify({
  cases: [
    {
      case_module: '登录',
      'Case Title': '账号密码登录成功',
      preconditions: '用户已注册',
      steps: '输入账号密码并提交',
      expected_results: '登录成功',
      priority: 'P0',
      case_type: '功能',
    },
  ],
}, null, 2)

const pendingRun: FunctionalCaseGenerateTaskRun = {
  runId: 'run-1',
  taskId: 'task-1',
  projectId: 'project-1',
  requirementId: 'requirement-1',
  status: 'success',
  reviewStatus: 'pending',
  importStatus: 'pending',
  importedTargets: [],
  importedAt: null,
  importMigrationComplete: true,
  resultYaml: candidateYaml,
  createdAt: '2026-08-02T07:00:00.000Z',
}

function jsonResponse(data: unknown, status = 200, message = 'ok') {
  return new Response(JSON.stringify({ code: status < 400 ? 0 : status, message, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function installFetchHandler(
  getRun: () => typeof pendingRun,
  onRequest?: (url: URL, init?: RequestInit) => Response | undefined,
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(requestUrl, 'http://localhost')
    const handled = onRequest?.(url, init)
    if (handled) return handled

    if (url.pathname === '/v1/function-case-generate-tasks/task-1') return jsonResponse(task)
    if (url.pathname === '/v1/function-case-generate-tasks/task-1/runs') {
      return jsonResponse({ items: [getRun()], total: 1 })
    }
    if (url.pathname === '/v1/function-case-generate-task-runs/run-1') return jsonResponse(getRun())
    if (url.pathname === '/v1/requirements/requirement-1/function-test-suites') {
      return jsonResponse({
        items: [
          { suiteId: 'suite-login', name: '登录' },
          { suiteId: 'suite-checkout', name: '结算' },
        ],
        total: 2,
      })
    }
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
        <MemoryRouter initialEntries={['/ai-testing/function-tasks/task-1']}>
          <Routes>
            <Route path="/ai-testing/function-tasks/:taskId" element={<FunctionalCaseGenerateTaskDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useThemeStore.setState({ mode: 'light' })
})

describe('功能候选结果审核与正式资产导入', () => {
  it('暗色主题下树图节点使用高对比度配色', async () => {
    useThemeStore.setState({ mode: 'dark' })
    const currentRun: FunctionalCaseGenerateTaskRun = {
      ...pendingRun,
      configJson: JSON.stringify({
        caseNames: {
          categories: [
            {
              model: 'EGO 首次接入流程',
              data: [
                {
                  test_model: '功能场景测试',
                  test_points: ['验证手机 App 完成配网'],
                },
              ],
            },
          ],
        },
      }),
    }
    installFetchHandler(() => currentRun)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '测试点' }))
    await user.click(screen.getByRole('tab', { name: '树图' }))

    const pointNode = await screen.findByTitle('验证手机 App 完成配网')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(getComputedStyle(pointNode).backgroundColor).toBe('rgba(37, 43, 56, 0.96)')
    expect(getComputedStyle(pointNode).color).toBe('rgb(230, 237, 247)')
  })

  it('暗色主题下候选审核弹窗使用统一表面和暗色滚动条', async () => {
    useThemeStore.setState({ mode: 'dark' })
    installFetchHandler(() => pendingRun)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '审核候选结果' }))
    const dialog = await screen.findByRole('dialog')

    const modalContent = dialog.querySelector<HTMLElement>('.ant-modal-container')
    const modalHeader = dialog.querySelector<HTMLElement>('.ant-modal-header')
    const modalBody = dialog.querySelector<HTMLElement>('.ant-modal-body')
    const modalFooter = dialog.querySelector<HTMLElement>('.ant-modal-footer')

    expect(modalContent).not.toBeNull()
    expect(modalHeader).not.toBeNull()
    expect(modalBody).not.toBeNull()
    expect(modalFooter).not.toBeNull()
    expect(getComputedStyle(modalContent!).backgroundColor).toBe('rgba(22, 27, 38, 0.98)')
    expect(getComputedStyle(modalHeader!).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(modalFooter!).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(modalBody!).scrollbarColor).toBe('rgba(148, 163, 184, 0.42)')
  })

  it('预览候选按用例模块折叠卡片，编辑候选直接展示 JSON', async () => {
    installFetchHandler(() => pendingRun)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '审核候选结果' }))

    const moduleToggle = await screen.findByRole('button', { name: '登录，1 条，展开' })
    expect(moduleToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('账号密码登录成功')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'json' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '卡片' })).not.toBeInTheDocument()

    await user.click(moduleToggle)
    expect(screen.getByRole('button', { name: '登录，1 条，收起' })).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText('账号密码登录成功')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '编辑候选' }))

    expect(await screen.findByRole('textbox', { name: '功能候选结果 JSON' })).toBeInTheDocument()
  })

  it('按方案测试点分析返回格式展示功能流程和场景设计', async () => {
    const requirementAnalysis = {
      Platform_core_functions: [
        {
          function: 'EGO 设备接入',
          description: '发现、配网并接入本地化 Server',
          business_value: '降低设备接入成本',
        },
      ],
      Target_understanding: [
        {
          target: '验证部署可用性',
          description: '确保本地化 Server 可以稳定接入设备',
        },
      ],
      Risk_point_prediction: [
        {
          risk_area: '设备发现',
          risk_description: '局域网广播可能被网络策略拦截',
          impact: '设备无法自动接入',
        },
      ],
      function_flow: [
        {
          flow_name: 'EGO 首次接入流程',
          description: '手机 App 配网 -> 自动发现本地化 Server -> 自动上报',
        },
      ],
      Scene_Design: [
        {
          scene_type: '功能场景',
          sub_category: [
            {
              scene_type: 'EGO 配网与首次接入',
              description: '覆盖首次接入全流程，关注自动发现、自动上报与状态可观测性',
            },
          ],
        },
      ],
    }
    const currentRun: FunctionalCaseGenerateTaskRun = {
      ...pendingRun,
      status: 'waiting_review',
      checkpointEnabled: true,
      currentStage: 'requirement_analysis',
      stageStatus: 'waiting_review',
      configJson: JSON.stringify({ requirementAnalysis }),
    }
    installFetchHandler(() => currentRun)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '审核' }))
    await user.click(screen.getByRole('tab', { name: '图像' }))

    for (const sectionName of ['平台核心功能', '目标理解', '风险点预测', '功能流程', '场景设计']) {
      expect(screen.getByRole('button', { name: new RegExp(sectionName) })).toHaveAttribute('aria-expanded', 'false')
    }
    expect(screen.queryByText(requirementAnalysis.Platform_core_functions[0].description)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /平台核心功能/ }))
    expect(screen.getByRole('button', { name: /平台核心功能/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(requirementAnalysis.Platform_core_functions[0].description)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /功能流程/ }))
    expect(await screen.findByText('流程和依赖链')).toBeInTheDocument()
    expect(screen.getByText(requirementAnalysis.function_flow[0].description)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /场景设计/ }))
    expect(screen.getByText('场景说明')).toBeInTheDocument()
    expect(screen.getByText(requirementAnalysis.Scene_Design[0].sub_category[0].description)).toBeInTheDocument()
    expect(screen.queryByText('来源依据')).not.toBeInTheDocument()
    expect(screen.queryByText('验证重点')).not.toBeInTheDocument()
    expect(screen.queryByText('保护价值/风险')).not.toBeInTheDocument()
  })

  it('待审核成功运行可编辑保存，批准不导入并冻结候选', async () => {
    let currentRun: FunctionalCaseGenerateTaskRun = { ...pendingRun }
    let patchBody: unknown
    let reviewBody: unknown
    let importRequests = 0
    const changedYaml = candidateYaml.replace('账号密码登录成功', '账号密码登录并进入首页')
    installFetchHandler(() => currentRun, (url, init) => {
      if (url.pathname === '/v1/function-case-generate-task-runs/run-1/result' && init?.method === 'PATCH') {
        patchBody = JSON.parse(String(init.body))
        currentRun = { ...currentRun, resultYaml: changedYaml }
        return jsonResponse(currentRun)
      }
      if (url.pathname === '/v1/function-case-generate-task-runs/run-1/review' && init?.method === 'POST') {
        reviewBody = JSON.parse(String(init.body))
        currentRun = {
          ...currentRun,
          reviewStatus: 'approved',
          importStatus: 'pending',
          reviewComment: '内容正确',
          reviewedAt: '2026-08-02T08:00:00.000Z',
        }
        return jsonResponse(currentRun)
      }
      if (url.pathname.endsWith('/import')) importRequests += 1
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '审核候选结果' }))
    await user.click(screen.getByRole('tab', { name: '编辑候选' }))
    const editor = await screen.findByRole('textbox', { name: '功能候选结果 JSON' })
    await user.click(editor)
    await user.keyboard('{Control>}a{/Control}')
    await user.paste(changedYaml)
    await user.click(screen.getByRole('button', { name: '保存候选结果' }))
    await waitFor(() => expect(patchBody).toEqual({ resultYaml: changedYaml }))

    await user.type(screen.getByLabelText('审核备注'), '内容正确')
    await user.click(screen.getByRole('button', { name: /批\s*准/ }))

    await waitFor(() => expect(reviewBody).toEqual({ action: 'approve', reviewComment: '内容正确' }))
    expect(importRequests).toBe(0)
    expect(await screen.findByText('已批准')).toBeInTheDocument()
    expect(screen.getByText('待导入')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导入正式用例' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '查看候选结果' }))
    await user.click(screen.getByRole('tab', { name: '编辑候选' }))
    expect(await screen.findByRole('textbox', { name: '功能候选结果 JSON' })).toHaveAttribute('aria-readonly', 'true')
    expect(screen.queryByRole('button', { name: '保存候选结果' })).not.toBeInTheDocument()
  })

  it('无冲突时一次导入并隐藏目标套件标签，且禁止再次导入', async () => {
    let currentRun: FunctionalCaseGenerateTaskRun = { ...pendingRun, reviewStatus: 'approved' }
    const requestBodies: unknown[] = []
    installFetchHandler(() => currentRun, (url, init) => {
      if (url.pathname.endsWith('/import') && init?.method === 'POST') {
        requestBodies.push(JSON.parse(String(init.body)))
        currentRun = {
          ...currentRun,
          importStatus: 'imported',
          importedAt: '2026-08-02T09:00:00.000Z',
          importedTargets: [
            { targetType: 'function_suite', targetId: 'suite-login' },
            { targetType: 'function_suite', targetId: 'suite-checkout' },
          ],
        }
        return jsonResponse({ requiresConfirmation: false, conflicts: [], run: currentRun })
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '导入正式用例' }))

    await waitFor(() => expect(requestBodies).toEqual([{ confirmOverwrite: false }]))
    expect(await screen.findByText('已导入')).toBeInTheDocument()
    expect(screen.queryByText('功能套件：登录')).not.toBeInTheDocument()
    expect(screen.queryByText('功能套件：结算')).not.toBeInTheDocument()
    expect(screen.getByText(/导入时间：/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '导入正式用例' })).not.toBeInTheDocument()
  })

  it('首次冲突只展示完整新旧字段，取消后仍可重试', async () => {
    const currentRun: FunctionalCaseGenerateTaskRun = { ...pendingRun, reviewStatus: 'approved' }
    const requestBodies: unknown[] = []
    installFetchHandler(() => currentRun, (url, init) => {
      if (url.pathname.endsWith('/import') && init?.method === 'POST') {
        requestBodies.push(JSON.parse(String(init.body)))
        return jsonResponse({
          requiresConfirmation: true,
          conflicts: [{
            normalizedName: '账号密码登录成功',
            existingCase: {
              module: '旧登录模块', title: '旧标题', preconditions: '旧前置', steps: '旧步骤',
              expectedResults: '旧预期', priority: 'P1', caseType: '旧类型',
            },
            generatedCase: {
              module: '新登录模块', title: '新标题', preconditions: '新前置', steps: '新步骤',
              expectedResults: '新预期', priority: 'P0', caseType: '新类型',
            },
          }],
          run: currentRun,
        })
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '导入正式用例' }))
    expect(await screen.findByText('旧登录模块')).toBeInTheDocument()
    expect(screen.getByText('新登录模块')).toBeInTheDocument()
    for (const value of ['旧标题', '新标题', '旧前置', '新前置', '旧步骤', '新步骤', '旧预期', '新预期', 'P1', 'P0', '旧类型', '新类型']) {
      expect(screen.getAllByText(value).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('待导入')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '取消覆盖' }))
    expect(requestBodies).toHaveLength(1)
    expect(screen.getByRole('button', { name: '导入正式用例' })).toBeEnabled()
  })

  it('确认覆盖后再次请求并显示导入成功', async () => {
    let currentRun: FunctionalCaseGenerateTaskRun = { ...pendingRun, reviewStatus: 'approved' }
    const requestBodies: unknown[] = []
    installFetchHandler(() => currentRun, (url, init) => {
      if (url.pathname.endsWith('/import') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { confirmOverwrite: boolean }
        requestBodies.push(body)
        if (!body.confirmOverwrite) {
          return jsonResponse({
            requiresConfirmation: true,
            conflicts: [{
              normalizedName: 'login',
              existingCase: { module: '登录', title: '旧标题', preconditions: '', steps: '', expectedResults: '', priority: 'P1', caseType: '功能' },
              generatedCase: { module: '登录', title: '新标题', preconditions: '', steps: '', expectedResults: '', priority: 'P0', caseType: '功能' },
            }],
            run: currentRun,
          })
        }
        currentRun = {
          ...currentRun,
          importStatus: 'imported',
          importedAt: '2026-08-02T09:00:00.000Z',
          importedTargets: [{ targetType: 'function_suite', targetId: 'suite-login' }],
        }
        return jsonResponse({ requiresConfirmation: false, conflicts: [], run: currentRun })
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '导入正式用例' }))
    await user.click(await screen.findByRole('button', { name: '整批确认覆盖' }))

    await waitFor(() => expect(requestBodies).toEqual([
      { confirmOverwrite: false },
      { confirmOverwrite: true },
    ]))
    expect(await screen.findByText('已导入')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '导入正式用例' })).not.toBeInTheDocument()
  })

  it('导入失败后保持已批准、待导入并允许重试', async () => {
    const currentRun: FunctionalCaseGenerateTaskRun = {
      ...pendingRun,
      reviewStatus: 'approved',
      importStatus: 'pending',
    }
    let attempts = 0
    installFetchHandler(() => currentRun, (url, init) => {
      if (url.pathname.endsWith('/import') && init?.method === 'POST') {
        attempts += 1
        return jsonResponse({}, 500, '正式资产写入失败')
      }
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '导入正式用例' }))
    expect(await screen.findByText('正式资产写入失败')).toBeInTheDocument()
    expect(screen.getByText('已批准')).toBeInTheDocument()
    expect(screen.getByText('待导入')).toBeInTheDocument()
    const retryButton = screen.getByRole('button', { name: '导入正式用例' })
    expect(retryButton).toBeEnabled()
    await user.click(retryButton)
    await waitFor(() => expect(attempts).toBe(2))
  })
})
