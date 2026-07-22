import {
  CaretRightOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
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
} from 'antd'
import type { BadgeProps } from 'antd'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RequirementAnalysisTaskDrawer,
  type RequirementAnalysisTaskFormValues,
} from '../components/RequirementAnalysisTaskDrawer'
import {
  RequirementAnalysisRunModal,
  type RequirementAnalysisRunFormValues,
} from '../components/RequirementAnalysisRunModal'
import type { RequirementAnalysisTask, RequirementAnalysisTaskRun } from '../types'
import { isRunnableApiCaseGenerateTaskRun } from '../utils/taskStatus'
import { useActiveProject } from '@/features/projects/hooks/useActiveProject'
import type { Requirement } from '@/features/requirements/types'
import { api } from '@/services/api'
import { message } from '@/shared/utils/feedback'
import { formatTime, getErrorMessage, normalizeRequirementId, normalizeSprintId, pickCreatedAt } from '@/utils/format'

const { Paragraph, Text } = Typography

type RequirementPoolItem = Requirement & {
  sprintName: string
  sprintIdForCreate: string
}

function getTaskId(task: RequirementAnalysisTask) {
  return task.taskId ?? ''
}

function footerRange(total: number, page: number, pageSize: number) {
  if (total === 0) return '显示第 0 条 - 第 0 条，共 0 条'
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return `显示第 ${start} 条 - 第 ${end} 条，共 ${total} 条`
}

function getTaskTime(task: RequirementAnalysisTask) {
  const time = new Date(task.updatedAt || task.createdAt || '').getTime()
  return Number.isNaN(time) ? 0 : time
}

function getRunSortTime(run: RequirementAnalysisTaskRun) {
  const time = new Date(run.createdAt || run.startedAt || run.updatedAt || '').getTime()
  return Number.isNaN(time) ? 0 : time
}

function getLatestRun(runs?: RequirementAnalysisTaskRun[]) {
  return [...(runs ?? [])].sort((left, right) => getRunSortTime(right) - getRunSortTime(left))[0]
}

function taskStatusBadgeProps(status?: RequirementAnalysisTaskRun['status']): Pick<BadgeProps, 'status' | 'color'> {
  const normalizedStatus = String(status ?? 'unknown').toLowerCase()

  if (normalizedStatus === 'pending' || normalizedStatus === 'waiting_review') return { color: 'gold' }
  if (normalizedStatus === 'claimed') return { color: 'cyan' }
  if (normalizedStatus === 'running') return { status: 'processing' }
  if (normalizedStatus === 'success') return { status: 'success' }
  if (normalizedStatus === 'error') return { color: 'volcano' }
  if (normalizedStatus === 'failed') return { status: 'error' }
  return { status: 'default' }
}

function normalizeTaskInstruction(instruction?: string) {
  return instruction?.trim() ?? ''
}

export function RequirementAnalysisTaskPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeProjectId, projectsQuery } = useActiveProject()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<RequirementAnalysisTask | null>(null)
  const [drawerSprintId, setDrawerSprintId] = useState<string | undefined>(undefined)
  const [runTask, setRunTask] = useState<RequirementAnalysisTask | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(18)
  const [form] = Form.useForm<RequirementAnalysisTaskFormValues>()

  const tasksQuery = useQuery({
    queryKey: ['requirementAnalysisTasks', activeProjectId],
    queryFn: () => api.getRequirementAnalysisTasks(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })

  const sprintsQuery = useQuery({
    queryKey: ['sprints', 'requirementAnalysisTasks', activeProjectId],
    queryFn: () => api.getSprints(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })

  const sprintOptions = useMemo(
    () => (sprintsQuery.data ?? []).map((sprint) => ({ label: sprint.name, value: normalizeSprintId(sprint) })),
    [sprintsQuery.data],
  )

  const requirementsQuery = useQuery({
    queryKey: ['requirementsPool', 'requirementAnalysisTasks', activeProjectId, sprintOptions.map((item) => item.value).join(',')],
    queryFn: async () => {
      if (!sprintsQuery.data || sprintsQuery.data.length === 0) return [] as RequirementPoolItem[]
      const groups = await Promise.all(
        sprintsQuery.data.map(async (sprint) => {
          const sprintId = normalizeSprintId(sprint)
          const requirements = await api.getRequirements(sprintId)
          return requirements.map((requirement) => ({
            ...requirement,
            sprintName: sprint.name,
            sprintIdForCreate: sprintId,
          }))
        }),
      )
      return groups.flat()
    },
    enabled: Boolean(activeProjectId) && !sprintsQuery.isLoading,
  })

  const sortedTasks = useMemo(
    () => [...(tasksQuery.data ?? [])].sort((left, right) => getTaskTime(right) - getTaskTime(left)),
    [tasksQuery.data],
  )
  const pagedTasks = useMemo(
    () => sortedTasks.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, sortedTasks],
  )
  const shouldFillTaskGrid = pageSize === 18 && pagedTasks.length > 0

  const taskRunQueries = useQueries({
    queries: pagedTasks.map((task) => {
      const taskId = getTaskId(task)
      return {
        queryKey: ['requirementAnalysisTaskRuns', taskId],
        queryFn: () => api.getRequirementAnalysisTaskRuns(taskId),
        enabled: Boolean(taskId),
        refetchInterval: (query: { state: { data?: RequirementAnalysisTaskRun[] } }) =>
          (query.state.data ?? []).some((run) => !isRunnableApiCaseGenerateTaskRun(run.status)) ? 3000 : false,
      }
    }),
  })

  const latestRunMap = useMemo(() => {
    const entries = pagedTasks.map((task, index) => [
      getTaskId(task),
      {
        isLoading: taskRunQueries[index]?.isLoading ?? false,
        latestRun: getLatestRun(taskRunQueries[index]?.data),
      },
    ] as const)
    return new Map(entries)
  }, [pagedTasks, taskRunQueries])

  const sprintNameMap = useMemo(
    () => new Map((sprintsQuery.data ?? []).map((sprint) => [normalizeSprintId(sprint), sprint.name])),
    [sprintsQuery.data],
  )
  const requirementMap = useMemo(
    () => new Map((requirementsQuery.data ?? []).map((requirement) => [normalizeRequirementId(requirement), requirement])),
    [requirementsQuery.data],
  )

  const requirementOptions = useMemo(
    () =>
      (requirementsQuery.data ?? [])
        .filter((requirement) => !drawerSprintId || requirement.sprintIdForCreate === drawerSprintId)
        .map((requirement) => ({
          label: `${requirement.name}${drawerSprintId ? '' : `（${requirement.sprintName}）`}`,
          value: normalizeRequirementId(requirement),
        })),
    [drawerSprintId, requirementsQuery.data],
  )

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sortedTasks.length / pageSize))
    if (page > maxPage) setPage(maxPage)
  }, [page, pageSize, sortedTasks.length])

  useEffect(() => {
    setPage(1)
  }, [activeProjectId])

  const createTaskMutation = useMutation({
    mutationFn: (values: RequirementAnalysisTaskFormValues) =>
      api.createRequirementAnalysisTask(activeProjectId!, {
        name: values.name,
        requirementId: values.requirementId,
        instruction: normalizeTaskInstruction(values.instruction),
      }),
    onSuccess: () => {
      message.success('需求分析任务已创建')
      closeDrawer()
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTasks', activeProjectId] })
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: (values: RequirementAnalysisTaskFormValues) =>
      api.updateRequirementAnalysisTask(getTaskId(editingTask!), {
        name: values.name,
        requirementId: values.requirementId,
        instruction: normalizeTaskInstruction(values.instruction),
      }),
    onSuccess: (task) => {
      message.success('需求分析任务已更新')
      closeDrawer()
      queryClient.setQueryData(['requirementAnalysisTask', getTaskId(task)], task)
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTasks', activeProjectId] })
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.deleteRequirementAnalysisTask(taskId),
    onSuccess: (_, taskId) => {
      message.success('需求分析任务已删除')
      queryClient.removeQueries({ queryKey: ['requirementAnalysisTask', taskId], exact: true })
      queryClient.removeQueries({ queryKey: ['requirementAnalysisTaskRuns', taskId], exact: true })
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTasks', activeProjectId] })
    },
  })

  const runTaskMutation = useMutation({
    mutationFn: ({ taskId, values }: { taskId: string; values: RequirementAnalysisRunFormValues }) =>
      api.runRequirementAnalysisTask(taskId, {
        connectionId: values.connectionId,
        instruction: normalizeTaskInstruction(values.instruction),
        triggerType: 'manual',
        checkpointEnabled: Boolean(values.checkpointEnabled),
        configJson: '{}',
      }),
    onSuccess: (run) => {
      message.success('需求分析任务已加入执行队列')
      setRunTask(null)
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTask', run.taskId] })
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTaskRuns', run.taskId] })
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTasks', activeProjectId] })
    },
  })

  function openCreateDrawer() {
    setEditingTask(null)
    setDrawerSprintId(undefined)
    form.setFieldsValue({
      name: '需求分析',
      sprintId: undefined,
      requirementId: undefined,
      instruction: '',
    })
    setDrawerOpen(true)
  }

  function openEditDrawer(task: RequirementAnalysisTask) {
    const requirement = task.requirementId ? requirementMap.get(task.requirementId) : undefined
    const sprintId = task.sprintId || requirement?.sprintIdForCreate
    setEditingTask(task)
    setDrawerSprintId(sprintId)
    form.setFieldsValue({
      name: task.name,
      sprintId,
      requirementId: task.requirementId,
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

  function handleRunTask(task: RequirementAnalysisTask) {
    const latestRun = latestRunMap.get(getTaskId(task))?.latestRun
    if (!isRunnableApiCaseGenerateTaskRun(latestRun?.status)) {
      message.warning('任务执行中，暂时不能重复运行')
      return
    }
    setRunTask(task)
  }

  function renderTaskCard(task: RequirementAnalysisTask) {
    const taskId = getTaskId(task)
    const runState = latestRunMap.get(taskId)
    const latestRun = runState?.latestRun
    const requirement = task.requirementId ? requirementMap.get(task.requirementId) : undefined
    const sprintName = sprintNameMap.get(task.sprintId ?? '') ?? requirement?.sprintName ?? task.sprintId ?? '-'
    const requirementName = requirement?.name ?? task.requirementId ?? '-'
    const runnableTask = !runState?.isLoading && isRunnableApiCaseGenerateTaskRun(latestRun?.status)
    const detailPath = `/ai-testing/requirement-analysis-tasks/${taskId}`

    return (
      <Card
        key={taskId}
        hoverable
        className="sprint-card api-collection-card ai-task-card"
        styles={{ body: { padding: 20 } }}
        onClick={() => navigate(detailPath)}
      >
        <div className="api-collection-card-top ai-task-card-top">
          <Space size={10}>
            <Badge {...taskStatusBadgeProps(latestRun?.status)} />
            <Tooltip title={task.name || '未命名任务'}>
              <Text strong className="ai-task-card-title">
                {task.name || '未命名任务'}
              </Text>
            </Tooltip>
          </Space>
          <Space size={6} wrap className="ai-task-card-tags">
            <Tag color="cyan">需求分析</Tag>
          </Space>
        </div>

        <div className="sprint-card-meta api-collection-meta-inline">
          <span className="sprint-card-label">所属迭代/需求</span>
          <span className="api-collection-inline-value">
            {sprintName}/{requirementName}
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
          title={task.instruction || '暂无补充指令'}
        >
          {task.instruction || '暂无补充指令'}
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
              onClick={() => navigate(detailPath)}
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

  const content = (
    <>
      <div className="workbench-tabs">
        <section className="workbench-panel workbench-board-panel ai-testing-task-panel">
          <div className="panel-header ai-task-panel-header">
            <Text strong>需求分析任务</Text>
            <Space wrap size={8}>
              <Button icon={<ReloadOutlined />} onClick={() => tasksQuery.refetch()} disabled={!activeProjectId}>
                刷新
              </Button>
              <Button
                type="primary"
                className="action-btn-create"
                icon={<PlusOutlined />}
                disabled={!activeProjectId}
                onClick={openCreateDrawer}
              >
                新建任务
              </Button>
            </Space>
          </div>

          {projectsQuery.error ? <Alert showIcon type="error" title={getErrorMessage(projectsQuery.error)} style={{ margin: '12px 18px 0' }} /> : null}
          {tasksQuery.error ? <Alert showIcon type="error" title={getErrorMessage(tasksQuery.error)} style={{ margin: '12px 18px 0' }} /> : null}

          <div className="table-body-scroll ai-testing-card-scroll">
            {!activeProjectId ? (
              <div className="sprint-card-loading ai-testing-empty-shell">
                <Empty description="请先选择项目" />
              </div>
            ) : tasksQuery.isLoading ? (
              <div className="sprint-card-loading ai-testing-empty-shell">
                <Empty description="任务加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : sortedTasks.length === 0 ? (
              <div className="ai-testing-empty-shell">
                <Empty description="当前项目下暂无需求分析任务">
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDrawer}>
                    创建分析任务
                  </Button>
                </Empty>
              </div>
            ) : (
              <div className={`ai-task-card-grid${shouldFillTaskGrid ? ' ai-task-grid-fill-page' : ''}`}>
                {pagedTasks.map((task) => renderTaskCard(task))}
              </div>
            )}
          </div>

          <div className="table-footer">
            <Text type="secondary">{footerRange(sortedTasks.length, page, pageSize)}</Text>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={sortedTasks.length}
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

      <RequirementAnalysisTaskDrawer
        title={editingTask ? '编辑需求分析任务' : '新建需求分析任务'}
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

      <RequirementAnalysisRunModal
        open={Boolean(runTask)}
        loading={runTaskMutation.isPending}
        onClose={() => setRunTask(null)}
        onConfirm={(values) => {
          if (!runTask) return
          runTaskMutation.mutate({ taskId: getTaskId(runTask), values })
        }}
      />
    </>
  )

  if (embedded) return content

  return <div className="workbench-page ai-testing-page">{content}</div>
}
