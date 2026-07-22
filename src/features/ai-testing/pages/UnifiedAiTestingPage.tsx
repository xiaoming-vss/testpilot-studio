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
  Modal,
  Pagination,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { BadgeProps } from 'antd'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiCaseGenerateTaskDrawer, type ApiCaseGenerateTaskFormValues } from '../components/ApiCaseGenerateTaskDrawer'
import { AiTaskQuickLinks } from '../components/AiTaskQuickLinks'
import { FunctionalCaseGenerateTaskDrawer, type FunctionalCaseGenerateTaskFormValues } from '../components/FunctionalCaseGenerateTaskDrawer'
import { LlmConnectionSelectModal } from '../components/LlmConnectionSelectModal'
import type { ApiCaseGenerateTask, ApiCaseGenerateTaskRun, FunctionalCaseGenerateTask, FunctionalCaseGenerateTaskRun } from '../types'
import { isRunnableApiCaseGenerateTaskRun } from '../utils/taskStatus'
import '@/features/ai-testing/styles/index.css'
import { useActiveProject } from '@/features/projects/hooks/useActiveProject'
import { hasRequirementDocument } from '@/features/requirements/utils/requirementDocument'
import { api } from '@/services/api'
import { message } from '@/shared/utils/feedback'
import { formatTime, getErrorMessage, normalizeRequirementId, normalizeSprintId, pickCreatedAt } from '@/utils/format'

const { Paragraph, Text } = Typography

type AiTaskKind = 'api' | 'functional' | 'ui'

type UnifiedAiTask =
  | {
      kind: 'api'
      task: ApiCaseGenerateTask
    }
  | {
      kind: 'functional'
      task: FunctionalCaseGenerateTask
    }

const createKindOptions: Array<{
  key: AiTaskKind
  title: string
  description: string
  icon: ReactNode
  disabled?: boolean
}> = [
  {
    key: 'api',
    title: 'API测试',
    description: '根据 OpenAPI / Swagger 生成 API 用例。',
    icon: <ApiOutlined />,
  },
  {
    key: 'functional',
    title: '功能测试',
    description: '根据需求文档生成结构化功能测试用例。',
    icon: <ExperimentOutlined />,
  },
  {
    key: 'ui',
    title: 'UI测试',
    description: 'UI 生成任务暂未接入创建流程。',
    icon: <BugOutlined />,
    disabled: true,
  },
]

function getTaskId(task: ApiCaseGenerateTask) {
  return task.taskId ?? ''
}

function getFunctionalTaskId(task: FunctionalCaseGenerateTask) {
  return task.taskId ?? ''
}

function getUnifiedTaskKey(item: UnifiedAiTask) {
  return `${item.kind}:${item.kind === 'api' ? getTaskId(item.task) : getFunctionalTaskId(item.task)}`
}

function getUnifiedTaskTime(item: UnifiedAiTask) {
  const time = new Date(item.task.updatedAt || item.task.createdAt || '').getTime()
  return Number.isNaN(time) ? 0 : time
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

function taskKindTag(kind: AiTaskKind) {
  if (kind === 'api') return <Tag color="blue">API测试</Tag>
  if (kind === 'functional') return <Tag color="purple">功能测试</Tag>
  return <Tag>UI测试</Tag>
}

function taskStatusBadge(status?: ApiCaseGenerateTaskRun['status']): NonNullable<BadgeProps['status']> {
  const normalizedStatus = status ?? 'unknown'
  if (['pending', 'claimed', 'running'].includes(normalizedStatus)) return 'processing'
  if (normalizedStatus === 'success') return 'success'
  if (['failed', 'error'].includes(normalizedStatus)) return 'error'
  return 'default'
}

export function UnifiedAiTestingPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeProjectId, projectsQuery } = useActiveProject()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ApiCaseGenerateTask | null>(null)
  const [drawerSprintId, setDrawerSprintId] = useState<string | undefined>(undefined)
  const [functionalDrawerOpen, setFunctionalDrawerOpen] = useState(false)
  const [editingFunctionalTask, setEditingFunctionalTask] = useState<FunctionalCaseGenerateTask | null>(null)
  const [functionalDrawerSprintId, setFunctionalDrawerSprintId] = useState<string | undefined>(undefined)
  const [createKindModalOpen, setCreateKindModalOpen] = useState(false)
  const [selectedCreateKind, setSelectedCreateKind] = useState<AiTaskKind>('api')
  const [llmSelectTaskId, setLlmSelectTaskId] = useState<string | null>(null)
  const [functionalLlmSelectTaskId, setFunctionalLlmSelectTaskId] = useState<string | null>(null)
  const [functionalCheckpointEnabled, setFunctionalCheckpointEnabled] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(18)
  const [form] = Form.useForm<ApiCaseGenerateTaskFormValues>()
  const [functionalForm] = Form.useForm<FunctionalCaseGenerateTaskFormValues>()

  const tasksQuery = useQuery({
    queryKey: ['apiCaseGenerateTasks', activeProjectId],
    queryFn: () => api.getApiCaseGenerateTasks(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })
  const functionalTasksQuery = useQuery({
    queryKey: ['functionalCaseGenerateTasks', activeProjectId],
    queryFn: () => api.getFunctionalCaseGenerateTasks(activeProjectId!),
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
      const groups = await Promise.all(sprintsQuery.data.map((sprint) => api.getRequirements(normalizeSprintId(sprint))))
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
  const requirementMap = useMemo(
    () => new Map((allRequirementsQuery.data ?? []).map((requirement) => [normalizeRequirementId(requirement), requirement])),
    [allRequirementsQuery.data],
  )

  const unifiedTasks = useMemo<UnifiedAiTask[]>(
    () =>
      [
        ...(tasksQuery.data ?? []).map((task) => ({ kind: 'api' as const, task })),
        ...(functionalTasksQuery.data ?? []).map((task) => ({ kind: 'functional' as const, task })),
      ].sort((left, right) => getUnifiedTaskTime(right) - getUnifiedTaskTime(left)),
    [functionalTasksQuery.data, tasksQuery.data],
  )
  const pagedTasks = useMemo(
    () => unifiedTasks.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, unifiedTasks],
  )
  const shouldFillTaskGrid = pageSize === 18 && pagedTasks.length > 0
  const pagedApiTasks = useMemo(
    () => pagedTasks.filter((item): item is Extract<UnifiedAiTask, { kind: 'api' }> => item.kind === 'api').map((item) => item.task),
    [pagedTasks],
  )
  const pagedFunctionalTasks = useMemo(
    () =>
      pagedTasks
        .filter((item): item is Extract<UnifiedAiTask, { kind: 'functional' }> => item.kind === 'functional')
        .map((item) => item.task),
    [pagedTasks],
  )
  const apiTaskRunQueries = useQueries({
    queries: pagedApiTasks.map((task) => {
      const taskId = getTaskId(task)
      return {
        queryKey: ['apiCaseGenerateTaskRuns', taskId],
        queryFn: () => api.getApiCaseGenerateTaskRuns(taskId),
        enabled: Boolean(taskId),
      }
    }),
  })
  const functionalTaskRunQueries = useQueries({
    queries: pagedFunctionalTasks.map((task) => {
      const taskId = getFunctionalTaskId(task)
      return {
        queryKey: ['functionalCaseGenerateTaskRuns', taskId],
        queryFn: () => api.getFunctionalCaseGenerateTaskRuns(taskId),
        enabled: Boolean(taskId),
      }
    }),
  })
  const latestApiRunMap = useMemo(() => {
    const entries = pagedApiTasks.map((task, index) => [
      getTaskId(task),
      {
        isLoading: apiTaskRunQueries[index]?.isLoading ?? false,
        latestRun: getLatestRun(apiTaskRunQueries[index]?.data),
      },
    ] as const)
    return new Map(entries)
  }, [apiTaskRunQueries, pagedApiTasks])
  const latestFunctionalRunMap = useMemo(() => {
    const entries = pagedFunctionalTasks.map((task, index) => [
      getFunctionalTaskId(task),
      {
        isLoading: functionalTaskRunQueries[index]?.isLoading ?? false,
        latestRun: getLatestRun(functionalTaskRunQueries[index]?.data),
      },
    ] as const)
    return new Map(entries)
  }, [functionalTaskRunQueries, pagedFunctionalTasks])
  const selectedCreateKindOption = useMemo(
    () => createKindOptions.find((option) => option.key === selectedCreateKind),
    [selectedCreateKind],
  )

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(unifiedTasks.length / pageSize))
    if (page > maxPage) setPage(maxPage)
  }, [page, pageSize, unifiedTasks.length])

  useEffect(() => {
    setPage(1)
  }, [activeProjectId])

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
    mutationFn: ({ taskId, connectionId, checkpointEnabled }: { taskId: string; connectionId: string; checkpointEnabled?: boolean }) =>
      api.runFunctionalCaseGenerateTask(taskId, { connectionId, checkpointEnabled }),
    onSuccess: (run) => {
      message.success('任务已加入执行队列')
      setFunctionalLlmSelectTaskId(null)
      setFunctionalCheckpointEnabled(false)
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

  function openCreateKindModal() {
    setSelectedCreateKind('api')
    setCreateKindModalOpen(true)
  }

  function handleCreateKindSelect(kind: AiTaskKind) {
    const option = createKindOptions.find((item) => item.key === kind)
    if (option?.disabled) return
    setSelectedCreateKind(kind)
  }

  function handleCreateKindConfirm() {
    if (!selectedCreateKindOption || selectedCreateKindOption.disabled) return

    if (selectedCreateKind === 'api') {
      setCreateKindModalOpen(false)
      openCreateDrawer()
      return
    }
    if (selectedCreateKind === 'functional') {
      setCreateKindModalOpen(false)
      openCreateFunctionalDrawer()
      return
    }
  }

  function handleRunTask(task: ApiCaseGenerateTask) {
    const latestRun = latestApiRunMap.get(getTaskId(task))?.latestRun
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

  async function handleRunFunctionalTask(task: FunctionalCaseGenerateTask) {
    const latestRun = latestFunctionalRunMap.get(getFunctionalTaskId(task))?.latestRun
    if (!isRunnableApiCaseGenerateTaskRun(latestRun?.status)) {
      message.warning('任务执行中，暂时不能重复运行')
      return
    }

    if (!task.requirementId) {
      message.warning('请先关联需求')
      return
    }

    let requirement = requirementMap.get(task.requirementId)

    if (!requirement) {
      try {
        requirement = await queryClient.fetchQuery({
          queryKey: ['requirement', task.requirementId],
          queryFn: () => api.getRequirement(task.requirementId!),
        })
      } catch (error) {
        message.error(getErrorMessage(error))
        return
      }
    }

    if (!requirement) {
      message.warning('未找到关联需求，请先重新选择需求')
      return
    }

    if (!hasRequirementDocument(requirement)) {
      message.warning('当前需求未配置需求文档，请先在需求中填写文本正文或上传 DOCX 文档')
      return
    }

    setFunctionalLlmSelectTaskId(getFunctionalTaskId(task))
  }

  function handleFunctionalLlmSelectConfirm(connectionId: string) {
    if (!functionalLlmSelectTaskId) return
    runFunctionalTaskMutation.mutate({
      taskId: functionalLlmSelectTaskId,
      connectionId,
      checkpointEnabled: functionalCheckpointEnabled,
    })
  }

  function renderTaskCard(item: UnifiedAiTask) {
    if (item.kind === 'api') {
      const task = item.task
      const taskId = getTaskId(task)
      const runState = latestApiRunMap.get(taskId)
      const latestRun = runState?.latestRun
      const runnableTask = !runState?.isLoading && isRunnableApiCaseGenerateTaskRun(latestRun?.status)

      return (
        <Card
          key={getUnifiedTaskKey(item)}
          hoverable
          className="sprint-card api-collection-card ai-task-card"
          styles={{ body: { padding: 20 } }}
          onClick={() => navigate(`/ai-testing/tasks/${taskId}`)}
        >
          <div className="api-collection-card-top ai-task-card-top">
            <Space size={10}>
              <Badge status={taskStatusBadge(latestRun?.status)} />
              <Tooltip title={task.name || '未命名任务'}>
                <Text strong className="ai-task-card-title">
                  {task.name || '未命名任务'}
                </Text>
              </Tooltip>
            </Space>
            <Space size={6} wrap className="ai-task-card-tags">
              {taskKindTag('api')}
              {sourceTypeTag(task.sourceType)}
            </Space>
          </div>

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

          <Paragraph
            className="api-collection-description ai-task-card-description"
            type="secondary"
            ellipsis={{ rows: 2 }}
            title={task.instruction || '暂无生成指令'}
          >
            {task.instruction || '暂无生成指令'}
          </Paragraph>

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
            <Tooltip title={runState?.isLoading ? '运行记录加载中' : '运行任务'}>
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
    }

    const task = item.task
    const taskId = getFunctionalTaskId(task)
    const runState = latestFunctionalRunMap.get(taskId)
    const latestRun = runState?.latestRun
    const runnableTask = !runState?.isLoading && isRunnableApiCaseGenerateTaskRun(latestRun?.status)

    return (
      <Card
        key={getUnifiedTaskKey(item)}
        hoverable
        className="sprint-card api-collection-card ai-task-card ai-functional-task-card"
        styles={{ body: { padding: 20 } }}
        onClick={() => navigate(`/ai-testing/function-tasks/${taskId}`)}
      >
        <div className="api-collection-card-top ai-task-card-top">
          <Space size={10}>
            <Badge status={taskStatusBadge(latestRun?.status)} />
            <Tooltip title={task.name || '未命名任务'}>
              <Text strong className="ai-task-card-title">
                {task.name || '未命名任务'}
              </Text>
            </Tooltip>
          </Space>
          <Space size={6} wrap className="ai-task-card-tags">
            {taskKindTag('functional')}
          </Space>
        </div>

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

        <Paragraph
          className="api-collection-description ai-task-card-description"
          type="secondary"
          ellipsis={{ rows: 2 }}
          title={task.instruction || '暂无生成指令'}
        >
          {task.instruction || '暂无生成指令'}
        </Paragraph>

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
          <Tooltip title={runState?.isLoading ? '运行记录加载中' : '运行任务'}>
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
  }

  const content = (
    <>
      <div className="workbench-tabs">
        <section className="workbench-panel workbench-board-panel ai-testing-task-panel">
          <div className="panel-header ai-task-panel-header">
            <Text strong>AI 用例生成任务</Text>
            <Space wrap size={8}>
              <AiTaskQuickLinks />
              <Button
                type="primary"
                className="action-btn-create"
                icon={<PlusOutlined />}
                disabled={!activeProjectId}
                onClick={openCreateKindModal}
              >
                新建任务
              </Button>
            </Space>
          </div>

          {projectsQuery.error ? <Alert showIcon type="error" title={getErrorMessage(projectsQuery.error)} style={{ margin: '12px 18px 0' }} /> : null}
          {tasksQuery.error ? <Alert showIcon type="error" title={getErrorMessage(tasksQuery.error)} style={{ margin: '12px 18px 0' }} /> : null}
          {functionalTasksQuery.error ? (
            <Alert showIcon type="error" title={getErrorMessage(functionalTasksQuery.error)} style={{ margin: '12px 18px 0' }} />
          ) : null}

          <div className="table-body-scroll ai-testing-card-scroll">
            {!activeProjectId ? (
              <div className="sprint-card-loading ai-testing-empty-shell">
                <Empty description="请先选择项目" />
              </div>
            ) : tasksQuery.isLoading || functionalTasksQuery.isLoading ? (
              <div className="sprint-card-loading ai-testing-empty-shell">
                <Empty description="任务加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : unifiedTasks.length === 0 ? (
              <div className="ai-testing-empty-shell">
                <Empty description="当前项目下暂无生成任务">
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateKindModal}>
                    创建第一条任务
                  </Button>
                </Empty>
              </div>
            ) : (
              <div className={`ai-task-card-grid${shouldFillTaskGrid ? ' ai-task-grid-fill-page' : ''}`}>
                {pagedTasks.map((item) => renderTaskCard(item))}
              </div>
            )}
          </div>

          <div className="table-footer">
            <Text type="secondary">{footerRange(unifiedTasks.length, page, pageSize)}</Text>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={unifiedTasks.length}
              showSizeChanger
              pageSizeOptions={['18', '24', '30', '36', '48', '60']}
              onChange={(nextPage, nextPageSize) => {
                setPage(nextPage)
                setPageSize(nextPageSize)
              }}
            />
          </div>
        </section>
      </div>

      <Modal
        open={createKindModalOpen}
        title="选择模板"
        className="ai-task-kind-modal"
        width={880}
        footer={
          <Space size={10}>
            <Button type="primary" disabled={!selectedCreateKindOption || selectedCreateKindOption.disabled} onClick={handleCreateKindConfirm}>
              确认
            </Button>
            <Button onClick={() => setCreateKindModalOpen(false)}>取消</Button>
          </Space>
        }
        onCancel={() => setCreateKindModalOpen(false)}
        destroyOnHidden
      >
        <div className="ai-task-kind-list">
          {createKindOptions.map((option) => {
            const selected = option.key === selectedCreateKind

            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={selected}
                className={`ai-task-kind-row${selected ? ' selected' : ''}`}
                disabled={option.disabled}
                onClick={() => handleCreateKindSelect(option.key)}
              >
                <span className="ai-task-kind-icon">{option.icon}</span>
                <span className="ai-task-kind-copy">
                  <span className="ai-task-kind-title">{option.title}</span>
                  <span className="ai-task-kind-description">{option.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Modal>

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
        onClose={() => {
          setFunctionalLlmSelectTaskId(null)
          setFunctionalCheckpointEnabled(false)
        }}
        onConfirm={handleFunctionalLlmSelectConfirm}
        loading={runFunctionalTaskMutation.isPending}
        showCheckpointOption
        checkpointEnabled={functionalCheckpointEnabled}
        onCheckpointEnabledChange={setFunctionalCheckpointEnabled}
      />
    </>
  )

  if (embedded) return content

  return <div className="workbench-page ai-testing-page">{content}</div>
}
