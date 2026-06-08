import {
  ApiOutlined,
  BugOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Form,
  Pagination,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import type { BadgeProps } from 'antd'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiCaseGenerateTaskDrawer, type ApiCaseGenerateTaskFormValues } from '../components/ApiCaseGenerateTaskDrawer'
import { FunctionalCaseGenerateTaskDrawer, type FunctionalCaseGenerateTaskFormValues } from '../components/FunctionalCaseGenerateTaskDrawer'
import { LlmConnectionSelectModal } from '../components/LlmConnectionSelectModal'
import type { ApiCaseGenerateTask, ApiCaseGenerateTaskRun, FunctionalCaseGenerateTask, FunctionalCaseGenerateTaskRun } from '../types'
import { isRunnableApiCaseGenerateTaskRun } from '../utils/taskStatus'
import '@/features/ai-testing/styles/index.css'
import { useActiveProject } from '@/features/projects/hooks/useActiveProject'
import { api } from '@/services/api'
import { formatTime, getErrorMessage, normalizeRequirementId, normalizeSprintId, pickCreatedAt } from '@/utils/format'

const { Paragraph, Text, Title } = Typography

type AiTestingCategory = 'api' | 'ui' | 'functional'

function getTaskId(task: ApiCaseGenerateTask) {
  return task.taskId ?? ''
}

function getFunctionalTaskId(task: FunctionalCaseGenerateTask) {
  return task.taskId ?? ''
}

function footerRange(total: number, page: number, pageSize: number) {
  if (total === 0) return '显示第 0 条 - 第 0 条，共 0 条'
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return `显示第 ${start} 条 - 第 ${end} 条，共 ${total} 条`
}

function getRunSortTime(run: ApiCaseGenerateTaskRun | FunctionalCaseGenerateTaskRun) {
  const time = new Date(run.createdAt || run.startedAt || run.updatedAt || '').getTime()
  return Number.isNaN(time) ? 0 : time
}

function getLatestRun<T extends ApiCaseGenerateTaskRun | FunctionalCaseGenerateTaskRun>(runs?: T[]) {
  return [...(runs ?? [])].sort((left, right) => getRunSortTime(right) - getRunSortTime(left))[0]
}

function sourceTypeTag(sourceType: ApiCaseGenerateTask['sourceType']) {
  return <Tag color={sourceType === 'swagger' ? 'gold' : 'blue'}>{sourceType}</Tag>
}

function functionalSourceTypeTag(sourceType: FunctionalCaseGenerateTask['sourceType']) {
  if (sourceType === 'docx') return <Tag color="purple">docx</Tag>
  return <Tag color="blue">text</Tag>
}

function getFunctionalSourceFileName(task: FunctionalCaseGenerateTask) {
  const sourceContent = task.sourceContent || ''
  if (!sourceContent) return ''
  const normalized = sourceContent.split('?')[0]
  const segments = normalized.split(/[\\/]/)
  return segments[segments.length - 1] || normalized
}

function getFunctionalSourcePreview(task: FunctionalCaseGenerateTask) {
  if (task.sourceType === 'text') return task.sourceContent || '暂无来源内容'
  return '下载文件'
}

function taskStatusBadge(status?: ApiCaseGenerateTaskRun['status']): NonNullable<BadgeProps['status']> {
  const normalizedStatus = status ?? 'unknown'
  if (['pending', 'claimed', 'running'].includes(normalizedStatus)) return 'processing'
  if (normalizedStatus === 'success') return 'success'
  if (['failed', 'error'].includes(normalizedStatus)) return 'error'
  return 'default'
}

const categoryOptions: Array<{
  key: AiTestingCategory
  label: string
  description: string
  icon: ReactNode
}> = [
  {
    key: 'api',
    label: 'API测试',
    description: '项目级 API 用例生成任务录入与管理',
    icon: <ApiOutlined />,
  },
  {
    key: 'ui',
    label: 'UI测试',
    description: '后续承接 UI 场景生成与任务管理',
    icon: <BugOutlined />,
  },
  {
    key: 'functional',
    label: '功能测试',
    description: '项目级功能用例生成任务录入与管理',
    icon: <ExperimentOutlined />,
  },
]

export function AiTestingPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { activeProjectId, projects, projectsQuery } = useActiveProject()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ApiCaseGenerateTask | null>(null)
  const [drawerSprintId, setDrawerSprintId] = useState<string | undefined>(undefined)
  const [functionalDrawerOpen, setFunctionalDrawerOpen] = useState(false)
  const [editingFunctionalTask, setEditingFunctionalTask] = useState<FunctionalCaseGenerateTask | null>(null)
  const [functionalDrawerSprintId, setFunctionalDrawerSprintId] = useState<string | undefined>(undefined)
  const [llmSelectTaskId, setLlmSelectTaskId] = useState<string | null>(null)
  const [functionalLlmSelectTaskId, setFunctionalLlmSelectTaskId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [functionalPage, setFunctionalPage] = useState(1)
  const [functionalPageSize, setFunctionalPageSize] = useState(10)
  const [form] = Form.useForm<ApiCaseGenerateTaskFormValues>()
  const [functionalForm] = Form.useForm<FunctionalCaseGenerateTaskFormValues>()

  const activeCategory = useMemo<AiTestingCategory>(() => {
    const tab = searchParams.get('tab')
    if (tab === 'ui' || tab === 'functional' || tab === 'api') return tab
    return 'api'
  }, [searchParams])

  const activeProject = useMemo(
    () => projects.find((project) => (project.projectId ?? project.project_id ?? '') === activeProjectId),
    [activeProjectId, projects],
  )

  const tasksQuery = useQuery({
    queryKey: ['apiCaseGenerateTasks', activeProjectId],
    queryFn: () => api.getApiCaseGenerateTasks(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })
  const sprintsQuery = useQuery({
    queryKey: ['sprints', 'aiTesting', activeProjectId],
    queryFn: () => api.getSprints(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })
  const sprintOptions = useMemo(
    () => (sprintsQuery.data ?? []).map((sprint) => ({ label: sprint.name, value: normalizeSprintId(sprint) })),
    [sprintsQuery.data],
  )
  const requirementOptionsQuery = useQuery({
    queryKey: ['requirements', 'aiTesting', drawerSprintId],
    queryFn: () => api.getRequirements(drawerSprintId!),
    enabled: Boolean(drawerSprintId),
  })
  const functionalRequirementOptionsQuery = useQuery({
    queryKey: ['requirements', 'aiTestingFunctional', functionalDrawerSprintId],
    queryFn: () => api.getRequirements(functionalDrawerSprintId!),
    enabled: Boolean(functionalDrawerSprintId),
  })
  const allRequirementsQuery = useQuery({
    queryKey: ['requirementsPool', 'aiTesting', activeProjectId, sprintOptions.map((item) => item.value).join(',')],
    queryFn: async () => {
      if (!sprintsQuery.data || sprintsQuery.data.length === 0) return []
      const groups = await Promise.all(
        sprintsQuery.data.map((sprint) => api.getRequirements(normalizeSprintId(sprint))),
      )
      return groups.flat()
    },
    enabled: Boolean(activeProjectId) && !sprintsQuery.isLoading,
  })
  const requirementOptions = useMemo(
    () =>
      (requirementOptionsQuery.data ?? []).map((requirement) => ({
        label: requirement.name,
        value: normalizeRequirementId(requirement),
      })),
    [requirementOptionsQuery.data],
  )
  const functionalRequirementOptions = useMemo(
    () =>
      (functionalRequirementOptionsQuery.data ?? []).map((requirement) => ({
        label: requirement.name,
        value: normalizeRequirementId(requirement),
      })),
    [functionalRequirementOptionsQuery.data],
  )
  const sprintNameMap = useMemo(
    () => new Map((sprintsQuery.data ?? []).map((sprint) => [normalizeSprintId(sprint), sprint.name])),
    [sprintsQuery.data],
  )
  const requirementNameMap = useMemo(
    () => new Map((allRequirementsQuery.data ?? []).map((requirement) => [normalizeRequirementId(requirement), requirement.name])),
    [allRequirementsQuery.data],
  )

  const tasks = useMemo(
    () =>
      [...(tasksQuery.data ?? [])].sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || '').getTime()
        const rightTime = new Date(right.updatedAt || right.createdAt || '').getTime()
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
      }),
    [tasksQuery.data],
  )
  const functionalTasksQuery = useQuery({
    queryKey: ['functionalCaseGenerateTasks', activeProjectId],
    queryFn: () => api.getFunctionalCaseGenerateTasks(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })
  const functionalTasks = useMemo(
    () =>
      [...(functionalTasksQuery.data ?? [])].sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || '').getTime()
        const rightTime = new Date(right.updatedAt || right.createdAt || '').getTime()
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
      }),
    [functionalTasksQuery.data],
  )

  const pagedTasks = useMemo(
    () => tasks.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, tasks],
  )
  const pagedFunctionalTasks = useMemo(
    () => functionalTasks.slice((functionalPage - 1) * functionalPageSize, functionalPage * functionalPageSize),
    [functionalPage, functionalPageSize, functionalTasks],
  )
  const taskRunQueries = useQueries({
    queries: pagedTasks.map((task) => {
      const taskId = getTaskId(task)
      return {
        queryKey: ['apiCaseGenerateTaskRuns', taskId],
        queryFn: () => api.getApiCaseGenerateTaskRuns(taskId),
        enabled: Boolean(taskId) && activeCategory === 'api',
      }
    }),
  })
  const latestRunMap = useMemo(() => {
    const entries = pagedTasks.map((task, index) => [getTaskId(task), getLatestRun(taskRunQueries[index]?.data)] as const)
    return new Map(entries)
  }, [pagedTasks, taskRunQueries])
  const functionalTaskRunQueries = useQueries({
    queries: pagedFunctionalTasks.map((task) => {
      const taskId = getFunctionalTaskId(task)
      return {
        queryKey: ['functionalCaseGenerateTaskRuns', taskId],
        queryFn: () => api.getFunctionalCaseGenerateTaskRuns(taskId),
        enabled: Boolean(taskId) && activeCategory === 'functional',
      }
    }),
  })
  const latestFunctionalRunMap = useMemo(() => {
    const entries = pagedFunctionalTasks.map((task, index) => [getFunctionalTaskId(task), getLatestRun(functionalTaskRunQueries[index]?.data)] as const)
    return new Map(entries)
  }, [functionalTaskRunQueries, pagedFunctionalTasks])
  const closeDrawerEffect = useEffectEvent(() => {
    closeDrawer()
  })
  const closeFunctionalDrawerEffect = useEffectEvent(() => {
    closeFunctionalDrawer()
  })

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(tasks.length / pageSize))
    if (page > maxPage) setPage(maxPage)
  }, [page, pageSize, tasks.length])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(functionalTasks.length / functionalPageSize))
    if (functionalPage > maxPage) setFunctionalPage(maxPage)
  }, [functionalPage, functionalPageSize, functionalTasks.length])

  useEffect(() => {
    setPage(1)
    setFunctionalPage(1)
  }, [activeProjectId])

  useEffect(() => {
    if (activeCategory !== 'api' && drawerOpen) {
      closeDrawerEffect()
    }
    if (activeCategory !== 'functional' && functionalDrawerOpen) {
      closeFunctionalDrawerEffect()
    }
  }, [activeCategory, closeDrawerEffect, closeFunctionalDrawerEffect, drawerOpen, functionalDrawerOpen])

  const createTaskMutation = useMutation({
    mutationFn: (values: ApiCaseGenerateTaskFormValues) => api.createApiCaseGenerateTask(activeProjectId!, values),
    onSuccess: () => {
      message.success('任务已创建')
      closeDrawer()
      queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTasks', activeProjectId] })
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: (values: ApiCaseGenerateTaskFormValues) => api.updateApiCaseGenerateTask(getTaskId(editingTask!), values),
    onSuccess: (task) => {
      const taskId = getTaskId(task)
      message.success('任务已更新')
      closeDrawer()
      queryClient.setQueryData(['apiCaseGenerateTask', taskId], task)
      queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTasks', activeProjectId] })
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.deleteApiCaseGenerateTask(taskId),
    onSuccess: (_, taskId) => {
      message.success('任务已删除')
      queryClient.removeQueries({ queryKey: ['apiCaseGenerateTask', taskId], exact: true })
      queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTasks', activeProjectId] })
    },
  })

  const runTaskMutation = useMutation({
    mutationFn: ({ taskId, connectionId }: { taskId: string; connectionId: string }) =>
      api.runApiCaseGenerateTask(taskId, connectionId),
    onSuccess: (run) => {
      message.success('任务已加入执行队列')
      setLlmSelectTaskId(null)
      queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTask', run.taskId] })
      queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTaskRuns', run.taskId] })
      queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTasks', activeProjectId] })
    },
  })
  const createFunctionalTaskMutation = useMutation({
    mutationFn: (values: FunctionalCaseGenerateTaskFormValues) => api.createFunctionalCaseGenerateTask(activeProjectId!, values),
    onSuccess: () => {
      message.success('功能测试任务已创建')
      closeFunctionalDrawer()
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTasks', activeProjectId] })
    },
  })

  const updateFunctionalTaskMutation = useMutation({
    mutationFn: (values: FunctionalCaseGenerateTaskFormValues) =>
      api.updateFunctionalCaseGenerateTask(getFunctionalTaskId(editingFunctionalTask!), values),
    onSuccess: () => {
      message.success('功能测试任务已更新')
      closeFunctionalDrawer()
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTasks', activeProjectId] })
    },
  })

  const deleteFunctionalTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.deleteFunctionalCaseGenerateTask(taskId),
    onSuccess: () => {
      message.success('功能测试任务已删除')
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTasks', activeProjectId] })
    },
  })
  const runFunctionalTaskMutation = useMutation({
    mutationFn: ({ taskId, connectionId }: { taskId: string; connectionId: string }) =>
      api.runFunctionalCaseGenerateTask(taskId, { connectionId }),
    onSuccess: (run) => {
      message.success('任务已加入执行队列')
      setFunctionalLlmSelectTaskId(null)
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTask', run.taskId] })
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTaskRuns', run.taskId] })
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTasks', activeProjectId] })
    },
  })

  function openCreateDrawer() {
    setEditingTask(null)
    const defaultSprintId = sprintOptions[0]?.value
    setDrawerSprintId(defaultSprintId)
    form.setFieldsValue({
      name: '',
      sprintId: defaultSprintId,
      requirementId: undefined,
      sourceType: 'openapi',
      sourceContent: '',
      instruction: '',
    })
    setDrawerOpen(true)
  }

  function openEditDrawer(task: ApiCaseGenerateTask) {
    setEditingTask(task)
    setDrawerSprintId(task.sprintId)
    form.setFieldsValue({
      name: task.name,
      sprintId: task.sprintId,
      requirementId: task.requirementId,
      sourceType: task.sourceType,
      sourceContent: task.sourceContent,
      instruction: task.instruction,
    })
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setEditingTask(null)
    setDrawerSprintId(undefined)
    form.resetFields()
  }

  function openCreateFunctionalDrawer() {
    setEditingFunctionalTask(null)
    const defaultSprintId = sprintOptions[0]?.value
    setFunctionalDrawerSprintId(defaultSprintId)
    functionalForm.setFieldsValue({
      name: '',
      sprintId: defaultSprintId,
      requirementId: undefined,
      sourceType: 'text',
      sourceContent: '',
      sourceFileName: undefined,
      file: undefined,
      instruction: '',
    })
    setFunctionalDrawerOpen(true)
  }

  function openEditFunctionalDrawer(task: FunctionalCaseGenerateTask) {
    setEditingFunctionalTask(task)
    setFunctionalDrawerSprintId(task.sprintId)
    functionalForm.setFieldsValue({
      name: task.name,
      sprintId: task.sprintId,
      requirementId: task.requirementId,
      sourceType: task.sourceType,
      sourceContent: task.sourceContent,
      sourceFileName: getFunctionalSourceFileName(task) || undefined,
      file: undefined,
      instruction: task.instruction,
    })
    setFunctionalDrawerOpen(true)
  }

  function closeFunctionalDrawer() {
    setFunctionalDrawerOpen(false)
    setEditingFunctionalTask(null)
    setFunctionalDrawerSprintId(undefined)
    functionalForm.resetFields()
  }

  function handleCategoryChange(nextCategory: AiTestingCategory) {
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('tab', nextCategory)
    setSearchParams(nextSearchParams, { replace: true })
  }

  function handleRunTask(task: ApiCaseGenerateTask) {
    const latestRun = latestRunMap.get(getTaskId(task))
    if (!isRunnableApiCaseGenerateTaskRun(latestRun?.status)) {
      message.warning('任务执行中，暂时不能重复运行')
      return
    }
    setLlmSelectTaskId(getTaskId(task))
  }

  function handleLlmSelectConfirm(connectionId: string) {
    if (!llmSelectTaskId) return
    runTaskMutation.mutate({ taskId: llmSelectTaskId, connectionId })
  }

  function handleRunFunctionalTask(task: FunctionalCaseGenerateTask) {
    const latestRun = latestFunctionalRunMap.get(getFunctionalTaskId(task))
    if (!isRunnableApiCaseGenerateTaskRun(latestRun?.status)) {
      message.warning('任务执行中，暂时不能重复运行')
      return
    }
    setFunctionalLlmSelectTaskId(getFunctionalTaskId(task))
  }

  function handleFunctionalLlmSelectConfirm(connectionId: string) {
    if (!functionalLlmSelectTaskId) return
    runFunctionalTaskMutation.mutate({ taskId: functionalLlmSelectTaskId, connectionId })
  }

  const activeCategoryMeta = categoryOptions.find((item) => item.key === activeCategory) ?? categoryOptions[0]

  return (
    <div className="workbench-page ai-testing-page">
      <section className="workbench-project-toolbar ai-testing-hero">
        <div className="ai-testing-toolbar-main">
            <div className="ai-testing-switcher-row">
            <div className="ai-testing-tab-switcher" role="tablist" aria-label="测试模块切换">
              {categoryOptions.map((option) => {
                const active = option.key === activeCategory
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`ai-testing-tab${active ? ' active' : ''}`}
                    onClick={() => handleCategoryChange(option.key)}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="workbench-tabs">
        {activeCategory === 'api' ? (
          <>
            <section className="workbench-panel workbench-board-panel ai-testing-task-panel">
              <div className="panel-header ai-task-panel-header">
                <Text strong>API 用例生成任务</Text>
                <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} disabled={!activeProjectId} onClick={openCreateDrawer}>
                  新建任务
                </Button>
              </div>

              {projectsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(projectsQuery.error)} style={{ margin: '12px 18px 0' }} /> : null}
              {tasksQuery.error ? <Alert showIcon type="error" message={getErrorMessage(tasksQuery.error)} style={{ margin: '12px 18px 0' }} /> : null}

              <div className="table-body-scroll ai-testing-card-scroll">
                {!activeProjectId ? (
                  <div className="sprint-card-loading ai-testing-empty-shell">
                    <Empty description="请先选择项目" />
                  </div>
                ) : tasksQuery.isLoading ? (
                  <div className="sprint-card-loading ai-testing-empty-shell">
                    <Empty description="任务加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="ai-testing-empty-shell">
                    <Empty description="当前项目下暂无 API 用例生成任务">
                      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDrawer}>
                        创建第一条任务
                      </Button>
                    </Empty>
                  </div>
                ) : (
                  <div className="ai-task-card-grid">
                    {pagedTasks.map((task, index) => {
                      const taskId = getTaskId(task)
                      const latestRunQuery = taskRunQueries[index]
                      const latestRun = latestRunMap.get(taskId)
                      const runnableTask = !latestRunQuery?.isLoading && isRunnableApiCaseGenerateTaskRun(latestRun?.status)
                      return (
                        <Card
                          key={taskId}
                          hoverable
                          className="sprint-card api-collection-card ai-task-card"
                          bodyStyle={{ padding: 20 }}
                          onClick={() => navigate(`/ai-testing/tasks/${taskId}`)}
                        >
                          <div className="api-collection-card-top ai-task-card-top">
                            <Space size={10}>
                              <Badge status={taskStatusBadge(latestRun?.status)} />
                              <Text strong className="ai-task-card-title">{task.name || '未命名任务'}</Text>
                            </Space>
                            <Space size={6} wrap className="ai-task-card-tags">
                              {sourceTypeTag(task.sourceType)}
                            </Space>
                          </div>

                          <Paragraph className="api-collection-description ai-task-card-description" type="secondary" ellipsis={{ rows: 2 }}>
                            {task.instruction || '暂无生成指令'}
                          </Paragraph>

                          <div className="sprint-card-meta api-collection-meta-inline">
                            <span className="sprint-card-label">所属迭代/需求</span>
                            <span className="api-collection-inline-value">
                              {sprintNameMap.get(task.sprintId ?? '') ?? task.sprintId ?? '-'}/
                              {requirementNameMap.get(task.requirementId ?? '') ?? task.requirementId ?? '-'}
                            </span>
                          </div>

                          <div className="sprint-card-meta">
                            <span className="sprint-card-label">创建时间</span>
                            <span className="api-collection-inline-value">{formatTime(pickCreatedAt(task))}</span>
                          </div>

                          <div
                            className="sprint-card-actions ai-task-card-actions"
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                          >
                            <Tooltip title="查看详情">
                              <Button
                                type="text"
                                shape="circle"
                                className="action-btn-read"
                                icon={<EyeOutlined />}
                                aria-label="查看详情"
                                onClick={() => navigate(`/ai-testing/tasks/${taskId}`)}
                              />
                            </Tooltip>
                            <Tooltip title={latestRunQuery?.isLoading ? '运行记录加载中' : '运行任务'}>
                              <span>
                                <Button
                                  type="text"
                                  shape="circle"
                                  className="action-btn-run"
                                  icon={<CaretRightOutlined />}
                                  aria-label="运行任务"
                                  disabled={!runnableTask}
                                  onClick={() => handleRunTask(task)}
                                />
                              </span>
                            </Tooltip>
                            <Tooltip title="编辑任务">
                              <span>
                                <Button
                                  type="text"
                                  shape="circle"
                                  className="action-btn-update"
                                  icon={<EditOutlined />}
                                  aria-label="编辑任务"
                                  onClick={() => openEditDrawer(task)}
                                />
                              </span>
                            </Tooltip>
                            <Popconfirm title="确认删除该任务？" onConfirm={() => deleteTaskMutation.mutate(taskId)}>
                              <Tooltip title="删除任务">
                                <Button
                                  danger
                                  type="text"
                                  shape="circle"
                                  className="action-btn-delete"
                                  icon={<DeleteOutlined />}
                                  aria-label="删除任务"
                                  loading={deleteTaskMutation.isPending && deleteTaskMutation.variables === taskId}
                                />
                              </Tooltip>
                            </Popconfirm>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="table-footer">
                <Text type="secondary">{footerRange(tasks.length, page, pageSize)}</Text>
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={tasks.length}
                  showSizeChanger
                  onChange={(nextPage, nextPageSize) => {
                    setPage(nextPage)
                    setPageSize(nextPageSize)
                  }}
                />
              </div>
            </section>
          </>
        ) : activeCategory === 'functional' ? (
          <section className="workbench-panel workbench-board-panel ai-testing-task-panel">
            <div className="panel-header ai-task-panel-header">
              <Text strong>功能用例生成任务</Text>
              <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} disabled={!activeProjectId} onClick={openCreateFunctionalDrawer}>
                新建任务
              </Button>
            </div>

            {projectsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(projectsQuery.error)} style={{ margin: '12px 18px 0' }} /> : null}
            {functionalTasksQuery.error ? <Alert showIcon type="error" message={getErrorMessage(functionalTasksQuery.error)} style={{ margin: '12px 18px 0' }} /> : null}

            <div className="table-body-scroll ai-testing-card-scroll">
              {!activeProjectId ? (
                <div className="sprint-card-loading ai-testing-empty-shell">
                  <Empty description="请先选择项目" />
                </div>
              ) : functionalTasksQuery.isLoading ? (
                <div className="sprint-card-loading ai-testing-empty-shell">
                  <Empty description="任务加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
              ) : functionalTasks.length === 0 ? (
                <div className="ai-testing-empty-shell">
                  <Empty description="当前项目下暂无功能测试生成任务">
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateFunctionalDrawer}>
                      创建第一条任务
                    </Button>
                  </Empty>
                </div>
              ) : (
                <div className="ai-task-card-grid">
                  {pagedFunctionalTasks.map((task, index) => {
                    const taskId = getFunctionalTaskId(task)
                    const latestRunQuery = functionalTaskRunQueries[index]
                    const latestRun = latestFunctionalRunMap.get(taskId)
                    const runnableTask = !latestRunQuery?.isLoading && isRunnableApiCaseGenerateTaskRun(latestRun?.status)
                    return (
                      <Card
                        key={taskId}
                        hoverable
                        className="sprint-card api-collection-card ai-task-card ai-functional-task-card"
                        bodyStyle={{ padding: 20 }}
                        onClick={() => navigate(`/ai-testing/function-tasks/${taskId}`)}
                      >
                        <div className="api-collection-card-top ai-task-card-top">
                          <Space size={10}>
                            <Badge status={taskStatusBadge(latestRun?.status)} />
                            <Text strong className="ai-task-card-title">{task.name || '未命名任务'}</Text>
                          </Space>
                          <Space size={6} wrap className="ai-task-card-tags">
                            {functionalSourceTypeTag(task.sourceType)}
                          </Space>
                        </div>

                        <Paragraph className="api-collection-description ai-task-card-description" type="secondary" ellipsis={{ rows: 2 }}>
                          {task.instruction || '暂无生成指令'}
                        </Paragraph>

                        <div className="sprint-card-meta api-collection-meta-inline">
                          <span className="sprint-card-label">所属迭代/需求</span>
                          <span className="api-collection-inline-value">
                            {sprintNameMap.get(task.sprintId ?? '') ?? task.sprintId ?? '-'}/
                            {requirementNameMap.get(task.requirementId ?? '') ?? task.requirementId ?? '-'}
                          </span>
                        </div>

                        <div className="sprint-card-meta api-collection-meta-inline">
                          <span className="sprint-card-label">来源内容</span>
                          <span className="api-collection-inline-value ai-functional-source-value">
                            {task.sourceType === 'text' ? (
                              getFunctionalSourcePreview(task)
                            ) : (
                              <a
                                href={task.sourceContent}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                title={getFunctionalSourceFileName(task) || '下载文件'}
                              >
                                下载文件
                              </a>
                            )}
                          </span>
                        </div>

                        <div className="sprint-card-meta">
                          <span className="sprint-card-label">创建时间</span>
                          <span className="api-collection-inline-value">{formatTime(pickCreatedAt(task))}</span>
                        </div>

                        <div
                          className="sprint-card-actions ai-task-card-actions"
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <Tooltip title="查看详情">
                            <Button
                              type="text"
                              shape="circle"
                              className="action-btn-read"
                              icon={<EyeOutlined />}
                              aria-label="查看详情"
                              onClick={(event) => {
                                event.stopPropagation()
                                navigate(`/ai-testing/function-tasks/${taskId}`)
                              }}
                            />
                          </Tooltip>
                          <Tooltip title={latestRunQuery?.isLoading ? '运行记录加载中' : '运行任务'}>
                            <span>
                              <Button
                                type="text"
                                shape="circle"
                                className="action-btn-run"
                                icon={<CaretRightOutlined />}
                                aria-label="运行任务"
                                disabled={!runnableTask}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleRunFunctionalTask(task)
                                }}
                              />
                            </span>
                          </Tooltip>
                          <Tooltip title="编辑任务">
                            <span>
                              <Button
                                type="text"
                                shape="circle"
                                className="action-btn-update"
                                icon={<EditOutlined />}
                                aria-label="编辑任务"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openEditFunctionalDrawer(task)
                                }}
                              />
                            </span>
                          </Tooltip>
                          <Popconfirm title="确认删除该任务？" onConfirm={() => deleteFunctionalTaskMutation.mutate(taskId)}>
                            <Tooltip title="删除任务">
                              <Button
                                danger
                                type="text"
                                shape="circle"
                                className="action-btn-delete"
                                icon={<DeleteOutlined />}
                                aria-label="删除任务"
                                onClick={(event) => event.stopPropagation()}
                                loading={deleteFunctionalTaskMutation.isPending && deleteFunctionalTaskMutation.variables === taskId}
                              />
                            </Tooltip>
                          </Popconfirm>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="table-footer">
              <Text type="secondary">{footerRange(functionalTasks.length, functionalPage, functionalPageSize)}</Text>
              <Pagination
                current={functionalPage}
                pageSize={functionalPageSize}
                total={functionalTasks.length}
                showSizeChanger
                onChange={(nextPage, nextPageSize) => {
                  setFunctionalPage(nextPage)
                  setFunctionalPageSize(nextPageSize)
                }}
              />
            </div>
          </section>
        ) : (
          <section className="ai-testing-coming-panel">
            <Card className="ai-testing-coming-card" bordered={false}>
              <div className="ai-testing-coming-badge">Coming Soon</div>
              <div className="ai-testing-coming-icon">{activeCategoryMeta.icon}</div>
              <Title level={3}>{activeCategoryMeta.label}</Title>
              <Paragraph className="ai-testing-coming-description">{activeCategoryMeta.description}</Paragraph>
              <div className="ai-testing-coming-meta">
                <span>当前项目</span>
                <strong>{activeProject?.name || activeProjectId || '未选择项目'}</strong>
              </div>
              <div className="ai-testing-coming-hint">
                {activeProjectId ? '当前先保留入口，等后端能力完成后再接入真实工作流。' : '先选择项目，再进入对应生成模块。'}
              </div>
            </Card>
          </section>
        )}
      </div>

      <ApiCaseGenerateTaskDrawer
        title={editingTask ? '编辑 API 用例生成任务' : '新建 API 用例生成任务'}
        open={drawerOpen}
        form={form}
        loading={createTaskMutation.isPending || updateTaskMutation.isPending}
        error={createTaskMutation.error ?? updateTaskMutation.error}
        sprintOptions={sprintOptions}
        requirementOptions={requirementOptions}
        onSprintChange={(value) => {
          setDrawerSprintId(value)
          form.setFieldValue('requirementId', undefined)
        }}
        onClose={closeDrawer}
        onFinish={(values) => {
          if (editingTask) {
            updateTaskMutation.mutate(values)
            return
          }
          createTaskMutation.mutate(values)
        }}
      />

      <FunctionalCaseGenerateTaskDrawer
        title={editingFunctionalTask ? '编辑功能用例生成任务' : '新建功能用例生成任务'}
        open={functionalDrawerOpen}
        form={functionalForm}
        editing={Boolean(editingFunctionalTask)}
        loading={createFunctionalTaskMutation.isPending || updateFunctionalTaskMutation.isPending}
        error={createFunctionalTaskMutation.error ?? updateFunctionalTaskMutation.error}
        sprintOptions={sprintOptions}
        requirementOptions={functionalRequirementOptions}
        onSprintChange={(value) => {
          setFunctionalDrawerSprintId(value)
          functionalForm.setFieldValue('requirementId', undefined)
        }}
        onClose={closeFunctionalDrawer}
        onFinish={(values) => {
          if (editingFunctionalTask) {
            updateFunctionalTaskMutation.mutate(values)
            return
          }
          createFunctionalTaskMutation.mutate(values)
        }}
      />

      <LlmConnectionSelectModal
        open={Boolean(llmSelectTaskId)}
        onClose={() => setLlmSelectTaskId(null)}
        onConfirm={handleLlmSelectConfirm}
        loading={runTaskMutation.isPending}
      />
      <LlmConnectionSelectModal
        open={Boolean(functionalLlmSelectTaskId)}
        onClose={() => setFunctionalLlmSelectTaskId(null)}
        onConfirm={handleFunctionalLlmSelectConfirm}
        loading={runFunctionalTaskMutation.isPending}
      />
    </div>
  )
}
