import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Dropdown,
  Empty,
  Form,
  Modal,
  Pagination,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
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
import { getApiCaseGenerateTaskRunStatusMeta, isRunnableApiCaseGenerateTaskRun } from '../utils/taskStatus'
import { useActiveProject } from '@/features/projects/hooks/useActiveProject'
import type { Requirement } from '@/features/requirements/types'
import { api, listItems } from '@/services/api'
import { message } from '@/shared/utils/feedback'
import { formatTime, getErrorMessage, normalizeRequirementId, normalizeSprintId, pickCreatedAt } from '@/utils/format'

const { Text } = Typography

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

function normalizeTaskInstruction(instruction?: string) {
  return instruction?.trim() ?? ''
}

function renderLatestRunStatus(status?: RequirementAnalysisTaskRun['status']) {
  if (!status) return <Tag className="ai-task-status-idle">未运行</Tag>
  const meta = getApiCaseGenerateTaskRunStatusMeta(status)
  return <Tag color={meta.color}>{meta.label}</Tag>
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
  const [pageSize, setPageSize] = useState(10)
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
    () => listItems(sprintsQuery.data).map((sprint) => ({ label: sprint.name, value: normalizeSprintId(sprint) })),
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
    () => [...listItems(tasksQuery.data)].sort((left, right) => getTaskTime(right) - getTaskTime(left)),
    [tasksQuery.data],
  )

  const sprintNameMap = useMemo(
    () => new Map(listItems(sprintsQuery.data).map((sprint) => [normalizeSprintId(sprint), sprint.name])),
    [sprintsQuery.data],
  )
  const requirementMap = useMemo(
    () => new Map(listItems(requirementsQuery.data).map((requirement) => [normalizeRequirementId(requirement), requirement])),
    [requirementsQuery.data],
  )

  const pagedTasks = useMemo(
    () => sortedTasks.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, sortedTasks],
  )

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

  const requirementOptions = useMemo(
    () =>
      listItems(requirementsQuery.data)
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

  function getTaskRowContext(task: RequirementAnalysisTask) {
    const taskId = getTaskId(task)
    const runState = latestRunMap.get(taskId)
    const latestRun = runState?.latestRun
    const requirement = task.requirementId ? requirementMap.get(task.requirementId) : undefined
    const sprintName = sprintNameMap.get(task.sprintId ?? '') ?? requirement?.sprintName ?? task.sprintId ?? '-'
    const requirementName = requirement?.name ?? task.requirementId ?? '-'
    const runnableTask = !runState?.isLoading && isRunnableApiCaseGenerateTaskRun(latestRun?.status)
    const detailPath = `/ai-testing/requirement-analysis-tasks/${taskId}`

    return { detailPath, latestRun, requirementName, runState, runnableTask, sprintName, taskId }
  }

  const columns: TableProps<RequirementAnalysisTask>['columns'] = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: '25%',
      render: (name: RequirementAnalysisTask['name']) => (
        <Space size={10} className="ai-task-list-name">
          <span className="ai-task-list-status-dot" />
          <Tooltip title={name || '未命名任务'}>
            <Text ellipsis>
              {name || '未命名任务'}
            </Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '类型/状态',
      key: 'status',
      width: 180,
      render: (_, task) => {
        const { latestRun } = getTaskRowContext(task)
        return (
          <Space size={6} className="ai-task-list-tags">
            <Tag color="cyan">需求分析</Tag>
            {renderLatestRunStatus(latestRun?.status)}
          </Space>
        )
      },
    },
    {
      title: '所属迭代/需求',
      key: 'scope',
      ellipsis: true,
      render: (_, task) => {
        const { requirementName, sprintName } = getTaskRowContext(task)
        return (
          <Tooltip title={`${sprintName} / ${requirementName}`}>
            <Text className="ai-task-list-scope" ellipsis>
              {sprintName} / {requirementName}
            </Text>
          </Tooltip>
        )
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (_, task) => <Text type="secondary">{formatTime(pickCreatedAt(task))}</Text>,
    },
    {
      title: '最近运行',
      key: 'latestRun',
      width: 160,
      render: (_, task) => {
        const { latestRun, runState } = getTaskRowContext(task)
        if (runState?.isLoading) return <Text type="secondary">加载中...</Text>
        return <Text type="secondary">{formatTime(latestRun?.startedAt || latestRun?.createdAt || latestRun?.updatedAt)}</Text>
      },
    },
    {
      title: '补充指令',
      dataIndex: 'instruction',
      key: 'instruction',
      ellipsis: true,
      render: (instruction: RequirementAnalysisTask['instruction']) => (
        <Tooltip title={instruction || '暂无补充指令'}>
          <Text type="secondary" ellipsis>
            {instruction || '暂无补充指令'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 138,
      align: 'right',
      render: (_, task) => {
        const { detailPath, runState, runnableTask, taskId } = getTaskRowContext(task)
        return (
          <Space
            size={6}
            className="ai-task-list-actions"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Tooltip title={runState?.isLoading ? '运行记录加载中' : undefined}>
              <span>
                <Button
                  size="small"
                  autoInsertSpace={false}
                  className="ai-task-run-button"
                  aria-label="运行任务"
                  disabled={!runnableTask}
                  onClick={() => handleRunTask(task)}
                >
                  运行
                </Button>
              </span>
            </Tooltip>
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              classNames={{ root: 'ai-task-more-dropdown' }}
              menu={{
                items: [
                  { key: 'view', icon: <EyeOutlined />, label: '查看详情' },
                  { key: 'edit', icon: <EditOutlined />, label: '编辑任务' },
                  { type: 'divider' },
                  {
                    key: 'delete',
                    danger: true,
                    icon: <DeleteOutlined />,
                    label: '删除任务',
                    disabled: deleteTaskMutation.isPending && deleteTaskMutation.variables === taskId,
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'view') {
                    navigate(detailPath)
                    return
                  }
                  if (key === 'edit') {
                    openEditDrawer(task)
                    return
                  }
                  Modal.confirm({
                    title: '确认删除该任务？',
                    content: '删除后无法恢复，请谨慎操作。',
                    okText: '删除',
                    okButtonProps: { danger: true },
                    cancelText: '取消',
                    onOk: () => deleteTaskMutation.mutateAsync(taskId),
                  })
                },
              }}
            >
              <Button
                type="text"
                size="small"
                className="ai-task-more-button"
                icon={<MoreOutlined />}
                aria-label="更多操作"
                loading={deleteTaskMutation.isPending && deleteTaskMutation.variables === taskId}
                onClick={(event) => event.stopPropagation()}
              />
            </Dropdown>
          </Space>
        )
      },
    },
  ]

  const content = (
    <>
      <div className="workbench-tabs">
        <section className="workbench-panel workbench-board-panel ai-testing-task-panel">
          <div className="panel-header ai-task-panel-header">
            <Text strong>需求分析任务</Text>
            <Space wrap size={8} className="ai-task-panel-tools">
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
              <Table<RequirementAnalysisTask>
                className="ai-task-list-table"
                columns={columns}
                dataSource={pagedTasks}
                rowKey={(task) => getTaskId(task)}
                pagination={false}
                onRow={(task) => ({
                  onClick: () => navigate(`/ai-testing/requirement-analysis-tasks/${getTaskId(task)}`),
                })}
              />
            )}
          </div>

          <div className="table-footer">
            <Text type="secondary">{footerRange(sortedTasks.length, page, pageSize)}</Text>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={sortedTasks.length}
              showSizeChanger
              pageSizeOptions={['10', '20', '30', '50']}
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
        projectId={activeProjectId}
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
