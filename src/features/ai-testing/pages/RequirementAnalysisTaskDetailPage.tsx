import {
  ArrowLeftOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Empty, Form, Input, Modal, Popconfirm, Spin, Tag } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AiTaskQuickLinks } from '../components/AiTaskQuickLinks'
import {
  RequirementAnalysisRunModal,
  type RequirementAnalysisRunFormValues,
} from '../components/RequirementAnalysisRunModal'
import {
  RequirementAnalysisTaskDrawer,
  type RequirementAnalysisTaskFormValues,
} from '../components/RequirementAnalysisTaskDrawer'
import type { RequirementAnalysisTaskRun } from '../types'
import {
  getApiCaseGenerateTaskRunStatusMeta,
  isRunnableApiCaseGenerateTaskRun,
  renderApiCaseGenerateTaskRunStatusTag,
} from '../utils/taskStatus'
import '@/features/ai-testing/styles/index.css'
import { RequirementDocumentPreviewContent } from '@/features/requirements/components/RequirementDocumentPreviewModal'
import type { Requirement } from '@/features/requirements/types'
import { hasRequirementDocument } from '@/features/requirements/utils/requirementDocument'
import { api, listItems } from '@/services/api'
import { TextCodeEditor } from '@/shared/components/TextCodeEditor/TextCodeEditor'
import { message } from '@/shared/utils/feedback'
import { formatTime, getErrorMessage, normalizeRequirementId, normalizeSprintId, pickUpdatedAt } from '@/utils/format'

type RequirementPoolItem = Requirement & {
  sprintName: string
  sprintIdForCreate: string
}

const runResultSectionDefinitions = [
  { key: 'firstStepOutput', label: '第一步输出' },
  { key: 'secondStepOutput', label: '第二步输出' },
  { key: 'resultYaml', label: '分析结果' },
  { key: 'errorMessage', label: '错误信息' },
] as const

type RunResultSectionKey = (typeof runResultSectionDefinitions)[number]['key']

type RunResultModalState = {
  key: RunResultSectionKey
  label: string
} | null

const requirementAnalysisStageMetaMap: Record<string, { label: string; color: string }> = {
  extracting_text: { label: '提取需求文档', color: 'cyan' },
  writing_requirement: { label: '编写需求理解', color: 'blue' },
  feature_understanding: { label: '功能理解生成', color: 'purple' },
  completed: { label: '已完成', color: 'success' },
}

const requirementAnalysisStageFieldMap: Record<string, { key: 'firstStepOutput' | 'secondStepOutput'; label: string }> = {
  extracting_text: { key: 'firstStepOutput', label: '第一步输出 firstStepOutput' },
  writing_requirement: { key: 'secondStepOutput', label: '第二步输出 secondStepOutput' },
}

function getRunSortTime(run: RequirementAnalysisTaskRun) {
  const time = new Date(run.createdAt || run.startedAt || run.updatedAt || '').getTime()
  return Number.isNaN(time) ? 0 : time
}

function formatStructuredContent(value?: unknown) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function parseConfigJsonRecord(configJson?: unknown): Record<string, unknown> {
  if (!configJson) return {}
  if (typeof configJson === 'object' && !Array.isArray(configJson)) {
    return configJson as Record<string, unknown>
  }
  if (typeof configJson !== 'string' || !configJson.trim()) return {}
  try {
    const parsed = JSON.parse(configJson)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}

function getRequirementAnalysisStageMeta(stage?: string) {
  if (!stage) return { label: '-', color: 'default' }
  return requirementAnalysisStageMetaMap[stage] ?? { label: stage, color: 'default' }
}

function getRequirementAnalysisStageField(stage?: string) {
  if (!stage) return undefined
  return requirementAnalysisStageFieldMap[stage]
}

function formatDurationSeconds(durationMs?: number | null) {
  if (durationMs === undefined || durationMs === null) return '-'
  return `${(durationMs / 1000).toFixed(2)} s`
}

function normalizeInstruction(instruction?: string) {
  return instruction?.trim() ?? ''
}

export function RequirementAnalysisTaskDetailPage() {
  const { taskId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSprintId, setDrawerSprintId] = useState<string | undefined>(undefined)
  const [runModalOpen, setRunModalOpen] = useState(false)
  const [expandedSection, setExpandedSection] = useState<'instruction' | 'sourceContent' | 'runHistory' | null>('runHistory')
  const [selectedRunRecordId, setSelectedRunRecordId] = useState<string | null>(null)
  const [runResultModal, setRunResultModal] = useState<RunResultModalState>(null)
  const [stageOutputDraft, setStageOutputDraft] = useState('')
  const [stageOutputDirty, setStageOutputDirty] = useState(false)
  const [stageOutputSourceKey, setStageOutputSourceKey] = useState('')
  const [stageReviewAction, setStageReviewAction] = useState<'approve' | 'revise' | null>(null)
  const [reviseModalOpen, setReviseModalOpen] = useState(false)
  const [revisionInstruction, setRevisionInstruction] = useState('')
  const [form] = Form.useForm<RequirementAnalysisTaskFormValues>()

  const taskQuery = useQuery({
    queryKey: ['requirementAnalysisTask', taskId],
    queryFn: () => api.getRequirementAnalysisTask(taskId),
    enabled: Boolean(taskId),
  })

  const task = taskQuery.data

  const boundRequirementQuery = useQuery({
    queryKey: ['requirement', 'requirementAnalysisTaskDetail', task?.requirementId],
    queryFn: () => api.getRequirement(task!.requirementId!),
    enabled: Boolean(task?.requirementId),
  })

  const runsQuery = useQuery({
    queryKey: ['requirementAnalysisTaskRuns', taskId],
    queryFn: () => api.getRequirementAnalysisTaskRuns(taskId),
    enabled: Boolean(taskId),
    refetchInterval: expandedSection === 'runHistory' ? 5000 : false,
  })

  const sprintsQuery = useQuery({
    queryKey: ['sprints', 'requirementAnalysisTaskDetail', task?.projectId],
    queryFn: async () => {
      if (!task?.projectId) return []
      return api.getSprints(task.projectId)
    },
    enabled: Boolean(task?.projectId),
  })

  const requirementsQuery = useQuery({
    queryKey: ['requirementsPool', 'requirementAnalysisTaskDetail', task?.projectId],
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
    enabled: Boolean(task?.projectId) && !sprintsQuery.isLoading,
  })

  const sprintOptions = useMemo(
    () => listItems(sprintsQuery.data).map((sprint) => ({ label: sprint.name, value: normalizeSprintId(sprint) })),
    [sprintsQuery.data],
  )
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
  const sprintNameMap = useMemo(
    () => new Map(listItems(sprintsQuery.data).map((sprint) => [normalizeSprintId(sprint), sprint.name])),
    [sprintsQuery.data],
  )
  const requirementMap = useMemo(
    () => new Map(listItems(requirementsQuery.data).map((requirement) => [normalizeRequirementId(requirement), requirement])),
    [requirementsQuery.data],
  )
  const boundRequirement = boundRequirementQuery.data ?? (task?.requirementId ? requirementMap.get(task.requirementId) : undefined)

  const runRecords = useMemo(
    () => [...listItems(runsQuery.data)].sort((left, right) => getRunSortTime(right) - getRunSortTime(left)),
    [runsQuery.data],
  )
  const latestRunRecord = runRecords[0]
  const selectedRunId = selectedRunRecordId ?? runRecords[0]?.runId ?? ''
  const selectedRunQuery = useQuery({
    queryKey: ['requirementAnalysisRun', selectedRunId],
    queryFn: () => api.getRequirementAnalysisRun(selectedRunId),
    enabled: Boolean(selectedRunId),
    refetchInterval: expandedSection === 'runHistory' && selectedRunId ? 5000 : false,
  })
  const selectedRun = selectedRunQuery.data
  const selectedRunRecord = useMemo(
    () => runRecords.find((record) => record.runId === selectedRunId),
    [runRecords, selectedRunId],
  )
  const activeSelectedRun = selectedRun?.runId === selectedRunId ? selectedRun : selectedRunRecord
  const selectedRunConfigJson = useMemo(() => parseConfigJsonRecord(selectedRun?.configJson), [selectedRun?.configJson])
  const selectedStage = selectedRun?.currentStage
  const selectedStageField = getRequirementAnalysisStageField(selectedStage)
  const selectedStageMeta = getRequirementAnalysisStageMeta(selectedStage)
  const selectedStageStatusMeta = getApiCaseGenerateTaskRunStatusMeta(selectedRun?.stageStatus)
  const selectedRunStatus = String(selectedRun?.status ?? '').toLowerCase()
  const selectedRunReviewStatus = String(selectedRun?.reviewStatus ?? '').toLowerCase()
  const selectedStageOutputContent = selectedStageField
    ? formatStructuredContent(selectedRunConfigJson[selectedStageField.key] ?? selectedRun?.[selectedStageField.key])
    : ''
  const checkpointStageWaitingReview = Boolean(
    selectedRun?.checkpointEnabled &&
      String(selectedRun?.status ?? '').toLowerCase() === 'waiting_review' &&
      selectedRun?.stageStatus === 'waiting_review' &&
      selectedStageField,
  )
  const showStageReviewInRunResultModal = Boolean(
    runResultModal?.key === selectedStageField?.key && checkpointStageWaitingReview,
  )
  const finalResultEditable = Boolean(
    selectedRun?.runId &&
      runResultModal?.key === 'resultYaml' &&
      selectedRunStatus === 'success' &&
      (!selectedStage || selectedStage === 'feature_understanding' || selectedStage === 'completed') &&
      selectedRunReviewStatus !== 'approved',
  )
  const editableRunResultModal = showStageReviewInRunResultModal || finalResultEditable
  const editableRunResultStage = finalResultEditable ? 'feature_understanding' : selectedStage
  const editableRunResultContent = finalResultEditable
    ? formatStructuredContent(selectedRun?.resultYaml)
    : selectedStageOutputContent

  const selectedRunResultSections = useMemo(() => {
    if (!selectedRun) return []

    return runResultSectionDefinitions
      .map((section) => {
        const directValue = selectedRun[section.key]
        const configValue =
          section.key === 'firstStepOutput' || section.key === 'secondStepOutput'
            ? selectedRunConfigJson[section.key]
            : undefined
        return { ...section, value: formatStructuredContent(directValue || configValue) }
      })
      .filter((item) => item.value)
  }, [selectedRun, selectedRunConfigJson])
  const selectedRunResultSectionMap = useMemo(
    () => new Map(selectedRunResultSections.map((section) => [section.key, section.value])),
    [selectedRunResultSections],
  )
  const runResultModalContent = runResultModal ? selectedRunResultSectionMap.get(runResultModal.key) : undefined
  const runHistoryRefreshing = runsQuery.isFetching || selectedRunQuery.isFetching
  const runnableTask = isRunnableApiCaseGenerateTaskRun(latestRunRecord?.status)
  const selectedRunTaskType = activeSelectedRun?.snapshotJson?.taskType ?? task?.taskType
  const canImportSelectedRun =
    Boolean(activeSelectedRun?.runId) &&
    selectedRunTaskType === 'requirement_analysis' &&
    String(activeSelectedRun?.status ?? '').toLowerCase() === 'success'
  const canImportRunResultModal = canImportSelectedRun && runResultModal?.key === 'resultYaml'

  const detailItems = useMemo(() => {
    if (!task) return []
    const boundRequirementSprintName =
      boundRequirement && 'sprintName' in boundRequirement
        ? String(boundRequirement.sprintName ?? '')
        : undefined
    return [
      { label: '任务名称', value: task.name || '-' },
      { label: '迭代', value: sprintNameMap.get(task.sprintId ?? '') ?? boundRequirementSprintName ?? task.sprintId ?? '-' },
      { label: '需求', value: boundRequirement?.name ?? task.requirementId ?? '-' },
      { label: '来源类型', value: task.sourceType || '-' },
      { label: '更新时间', value: formatTime(pickUpdatedAt(task)) },
    ]
  }, [boundRequirement, sprintNameMap, task])

  const taskSourceContent = task?.sourceContent?.trim() ?? ''
  const displaySourceContent = taskSourceContent
  const canPreviewBoundRequirement = Boolean(boundRequirement && hasRequirementDocument(boundRequirement))

  useEffect(() => {
    if (!task) return
    const requirement = task.requirementId ? requirementMap.get(task.requirementId) : undefined
    const sprintId = task.sprintId || requirement?.sprintIdForCreate
    setDrawerSprintId(sprintId)
    form.setFieldsValue({
      name: task.name,
      sprintId,
      requirementId: task.requirementId,
      instruction: task.instruction,
    })
  }, [form, requirementMap, task])

  useEffect(() => {
    setExpandedSection('runHistory')
    setSelectedRunRecordId(null)
    setRunResultModal(null)
  }, [taskId])

  useEffect(() => {
    if (runRecords.length === 0) {
      setSelectedRunRecordId(null)
      return
    }
    setSelectedRunRecordId((current) =>
      current && runRecords.some((record) => record.runId === current) ? current : (runRecords[0].runId ?? null),
    )
  }, [runRecords])

  useEffect(() => {
    setRunResultModal(null)
    setReviseModalOpen(false)
    setRevisionInstruction('')
  }, [selectedRunId])

  useEffect(() => {
    const nextSourceKey = `${selectedRun?.runId ?? ''}:${editableRunResultStage ?? ''}:${runResultModal?.key ?? ''}`

    if (stageOutputSourceKey !== nextSourceKey) {
      setStageOutputSourceKey(nextSourceKey)
      setStageOutputDraft(editableRunResultContent)
      setStageOutputDirty(false)
      setStageReviewAction(null)
      return
    }

    if (!stageOutputDirty) {
      setStageOutputDraft(editableRunResultContent)
    }
  }, [
    editableRunResultContent,
    editableRunResultStage,
    runResultModal?.key,
    selectedRun?.runId,
    stageOutputDirty,
    stageOutputSourceKey,
  ])

  const updateTaskMutation = useMutation({
    mutationFn: (values: RequirementAnalysisTaskFormValues) =>
      api.updateRequirementAnalysisTask(taskId, {
        name: values.name,
        requirementId: values.requirementId,
        instruction: normalizeInstruction(values.instruction),
      }),
    onSuccess: (updatedTask) => {
      message.success('需求分析任务已更新')
      setDrawerOpen(false)
      queryClient.setQueryData(['requirementAnalysisTask', taskId], updatedTask)
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTasks', updatedTask.projectId] })
    },
  })

  const runTaskMutation = useMutation({
    mutationFn: (values: RequirementAnalysisRunFormValues) =>
      api.runRequirementAnalysisTask(taskId, {
        connectionId: values.connectionId,
        instruction: normalizeInstruction(values.instruction),
        triggerType: 'manual',
        checkpointEnabled: Boolean(values.checkpointEnabled),
        configJson: '{}',
      }),
    onSuccess: (run) => {
      message.success('需求分析任务已加入执行队列')
      setRunModalOpen(false)
      setExpandedSection('runHistory')
      setSelectedRunRecordId(run.runId ?? null)
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTask', taskId] })
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTaskRuns', taskId] })
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTasks', task?.projectId ?? run.projectId] })
    },
  })

  const importRunMutation = useMutation({
    mutationFn: (runId: string) => api.importRequirementAnalysisRunToRequirement(runId),
    onSuccess: (updatedRequirement, runId) => {
      const updatedRequirementId = normalizeRequirementId(updatedRequirement)
      message.success('已导入到需求')
      setRunResultModal(null)
      queryClient.setQueryData(
        ['requirement', 'requirementAnalysisTaskDetail', updatedRequirementId],
        updatedRequirement,
      )
      queryClient.setQueryData(['requirement', updatedRequirementId], updatedRequirement)
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisRun', runId] })
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTaskRuns', taskId] })
      queryClient.invalidateQueries({ queryKey: ['requirementsPool', 'requirementAnalysisTaskDetail', task?.projectId] })
      queryClient.invalidateQueries({ queryKey: ['requirementsPool', task?.projectId] })
    },
  })

  const saveStageOutputMutation = useMutation({
    mutationFn: (payload: { runId: string; stage: string; configJson: Record<string, unknown>; resultYaml?: string; silent?: boolean }) =>
      api.updateRequirementAnalysisRunStageOutput(payload.runId, {
        stage: payload.stage,
        configJson: payload.configJson,
        resultYaml: payload.resultYaml,
      }),
    onSuccess: (updatedRun, payload) => {
      if (!payload.silent) {
        message.success('阶段产物已保存')
      }
      setStageOutputDirty(false)
      queryClient.setQueryData(['requirementAnalysisRun', payload.runId], updatedRun)
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisRun', payload.runId] })
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTaskRuns', taskId] })
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const reviewStageMutation = useMutation({
    mutationFn: (payload: {
      runId: string
      body: { stage: string; action: 'approve'; configJson: Record<string, unknown> }
    }) => api.reviewRequirementAnalysisRunStage(payload.runId, payload.body),
    onSuccess: (updatedRun, payload) => {
      message.success('阶段审核已通过，继续执行')
      setStageReviewAction(null)
      setSelectedRunRecordId(updatedRun.runId ?? payload.runId)
      queryClient.setQueryData(['requirementAnalysisRun', payload.runId], updatedRun)
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisRun', payload.runId] })
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTaskRuns', taskId] })
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
      setStageReviewAction(null)
    },
  })

  const reviseStageMutation = useMutation({
    mutationFn: (payload: {
      runId: string
      body: { stage: string; revisionInstruction: string; configJson: Record<string, unknown>; resultYaml?: string }
    }) => api.reviseRequirementAnalysisRunStage(payload.runId, payload.body),
    onSuccess: (updatedRun, payload) => {
      message.success('已提交 AI 修改，等待当前阶段重新执行')
      setReviseModalOpen(false)
      setRevisionInstruction('')
      setRunResultModal(null)
      setStageOutputDirty(false)
      setStageReviewAction(null)
      setSelectedRunRecordId(updatedRun.runId ?? payload.runId)
      queryClient.setQueryData(['requirementAnalysisRun', payload.runId], updatedRun)
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisRun', payload.runId] })
      queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTaskRuns', taskId] })
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
      setStageReviewAction(null)
    },
  })
  const stageActionPending =
    saveStageOutputMutation.isPending || reviewStageMutation.isPending || reviseStageMutation.isPending

  const deleteTaskMutation = useMutation({
    mutationFn: () => api.deleteRequirementAnalysisTask(taskId),
    onSuccess: () => {
      message.success('需求分析任务已删除')
      queryClient.removeQueries({ queryKey: ['requirementAnalysisTask', taskId], exact: true })
      if (task?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['requirementAnalysisTasks', task.projectId] })
      }
      navigate('/ai-testing?tab=analysis')
    },
  })

  function toggleSection(section: 'instruction' | 'sourceContent' | 'runHistory') {
    setExpandedSection((current) => (current === section ? null : section))
  }

  function handleRunTask() {
    if (runsQuery.isLoading) {
      message.warning('运行记录加载中，请稍后再试')
      return
    }
    if (!runnableTask) {
      message.warning('任务执行中，暂时不能重复运行')
      return
    }
    setRunModalOpen(true)
  }

  function handleRefreshRuns() {
    void runsQuery.refetch()
    if (selectedRunId) {
      void selectedRunQuery.refetch()
    }
  }

  function buildStageConfigJson() {
    if (!selectedStageField) return selectedRunConfigJson
    return {
      ...selectedRunConfigJson,
      [selectedStageField.key]: stageOutputDraft,
    }
  }

  function buildStageOutputPayload() {
    const stage = editableRunResultStage
    if (!selectedRun?.runId || !stage) return null

    const configJson = buildStageConfigJson()
    if (stage === 'feature_understanding') {
      return {
        runId: selectedRun.runId,
        stage,
        configJson,
        resultYaml: stageOutputDraft,
      }
    }

    return {
      runId: selectedRun.runId,
      stage,
      configJson,
    }
  }

  function handleSaveStageOutput() {
    const payload = buildStageOutputPayload()
    if (!payload) return
    if (!stageOutputDraft.trim()) {
      message.warning('阶段产物不能为空')
      return
    }

    saveStageOutputMutation.mutate(payload)
  }

  async function handleApproveStageReview() {
    if (!selectedRun?.runId || !selectedStage || !selectedStageField || !checkpointStageWaitingReview) return
    if (!stageOutputDraft.trim()) {
      message.warning('阶段产物不能为空')
      return
    }

    setStageReviewAction('approve')
    const configJson = buildStageConfigJson()
    try {
      await saveStageOutputMutation.mutateAsync({
        runId: selectedRun.runId,
        stage: selectedStage,
        configJson,
        silent: true,
      })
      await reviewStageMutation.mutateAsync({
        runId: selectedRun.runId,
        body: {
          stage: selectedStage,
          action: 'approve',
          configJson,
        },
      })
    } catch {
      setStageReviewAction(null)
    }
  }

  function openReviseStageModal() {
    if (!selectedRun?.runId || !editableRunResultStage || !editableRunResultModal) return
    if (!stageOutputDraft.trim()) {
      message.warning('阶段产物不能为空')
      return
    }
    setRevisionInstruction('')
    setReviseModalOpen(true)
  }

  function handleReviseStage() {
    const payload = buildStageOutputPayload()
    if (!selectedRun?.runId || !payload) return
    const trimmedInstruction = revisionInstruction.trim()
    if (!trimmedInstruction) {
      message.warning('请输入 AI 修改要求')
      return
    }
    if (!stageOutputDraft.trim()) {
      message.warning('阶段产物不能为空')
      return
    }

    setStageReviewAction('revise')
    reviseStageMutation.mutate({
      runId: selectedRun.runId,
      body: {
        stage: payload.stage,
        revisionInstruction: trimmedInstruction,
        configJson: payload.configJson,
        resultYaml: payload.resultYaml,
      },
    })
  }

  function handleImportSelectedRun() {
    if (!activeSelectedRun?.runId || !canImportSelectedRun) return

    Modal.confirm({
      title: '导入需求',
      content: '导入后会把本次分析结果写回需求，并覆盖当前需求理解结果。',
      okText: '导入需求',
      cancelText: '取消',
      onOk: () => importRunMutation.mutateAsync(activeSelectedRun.runId!),
    })
  }

  return (
    <div className="workbench-page ai-testing-page">
      <div className="workbench-tabs">
        {taskQuery.error ? <Alert showIcon type="error" title={getErrorMessage(taskQuery.error)} /> : null}
        {runsQuery.error ? <Alert showIcon type="error" title={getErrorMessage(runsQuery.error)} /> : null}

        {!task && taskQuery.isLoading ? (
          <Spin />
        ) : task ? (
          <div className="ai-task-detail-layout">
            <Card className="ai-task-detail-summary-card">
              <div className="ai-task-detail-inline-meta">
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ai-testing?tab=analysis')}>
                  返回需求分析
                </Button>
                {detailItems.map((item) => (
                  <div key={item.label} className="ai-task-detail-inline-item">
                    <span className="ai-task-detail-inline-label">{item.label}</span>
                    <span className="ai-task-detail-inline-value">{item.value}</span>
                  </div>
                ))}
                <div className="ai-task-detail-inline-actions">
                  <AiTaskQuickLinks />
                  <Button
                    className="action-btn-run"
                    icon={<CaretRightOutlined />}
                    disabled={runsQuery.isLoading || !runnableTask}
                    loading={runTaskMutation.isPending}
                    onClick={handleRunTask}
                  >
                    运行
                  </Button>
                  <Button className="action-btn-update" icon={<EditOutlined />} onClick={() => setDrawerOpen(true)}>
                    编辑
                  </Button>
                  <Popconfirm title="确认删除该任务？" onConfirm={() => deleteTaskMutation.mutate()}>
                    <Button danger className="action-btn-delete" icon={<DeleteOutlined />} loading={deleteTaskMutation.isPending}>
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            </Card>

            <div className={`ai-task-detail-fold-group${expandedSection === 'runHistory' ? ' run-history-expanded' : ''}`}>
              <Card
                className={`ai-task-detail-card ai-task-detail-fold-card ai-task-detail-fold-card-source${expandedSection === 'sourceContent' ? ' expanded' : ' collapsed'}`}
                title={
                  <button
                    type="button"
                    className="ai-task-detail-fold-trigger"
                    onClick={() => toggleSection('sourceContent')}
                    aria-expanded={expandedSection === 'sourceContent'}
                  >
                    {expandedSection === 'sourceContent' ? <DownOutlined /> : <RightOutlined />}
                    <span>来源内容</span>
                  </button>
                }
              >
                {expandedSection === 'sourceContent' ? (
                  <div className="ai-task-detail-content-scroll">
                    {boundRequirementQuery.isLoading && !displaySourceContent ? (
                      <div className="ai-task-run-history-placeholder compact">
                        <Spin />
                        <span>需求内容加载中...</span>
                      </div>
                    ) : displaySourceContent ? (
                      <pre className="ai-task-code-block">{displaySourceContent}</pre>
                    ) : canPreviewBoundRequirement && boundRequirement ? (
                      <RequirementDocumentPreviewContent
                        embedded
                        requirementId={normalizeRequirementId(boundRequirement)}
                        requirementName={boundRequirement.name}
                        documentType={boundRequirement.documentType}
                        documentContent={boundRequirement.documentContent}
                        documentFilename={boundRequirement.documentFilename}
                        documentDownloadUrl={boundRequirement.documentDownloadUrl}
                      />
                    ) : (
                      <div className="ai-task-run-history-placeholder compact">
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前任务未返回来源内容，绑定需求也暂无可展示文档" />
                      </div>
                    )}
                  </div>
                ) : null}
              </Card>

              <Card
                className={`ai-task-detail-card ai-task-detail-fold-card ai-task-detail-fold-card-instruction${expandedSection === 'instruction' ? ' expanded' : ' collapsed'}`}
                title={
                  <button
                    type="button"
                    className="ai-task-detail-fold-trigger"
                    onClick={() => toggleSection('instruction')}
                    aria-expanded={expandedSection === 'instruction'}
                  >
                    {expandedSection === 'instruction' ? <DownOutlined /> : <RightOutlined />}
                    <span>补充指令</span>
                  </button>
                }
              >
                {expandedSection === 'instruction' ? (
                  <div className="ai-task-detail-content-scroll">
                    <pre className="ai-task-code-block">{task.instruction || '-'}</pre>
                  </div>
                ) : null}
              </Card>

              <Card
                className={`ai-task-detail-card ai-task-detail-fold-card ai-task-detail-fold-card-history${expandedSection === 'runHistory' ? ' expanded' : ' collapsed'}`}
                extra={
                  <div className="ai-task-run-history-toolbar">
                    <span className="ai-task-run-history-auto-refresh">每 5 秒自动刷新</span>
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      loading={runHistoryRefreshing}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleRefreshRuns()
                      }}
                    >
                      刷新
                    </Button>
                  </div>
                }
                title={
                  <button
                    type="button"
                    className="ai-task-detail-fold-trigger"
                    onClick={() => toggleSection('runHistory')}
                    aria-expanded={expandedSection === 'runHistory'}
                  >
                    {expandedSection === 'runHistory' ? <DownOutlined /> : <RightOutlined />}
                    <span>运行记录</span>
                  </button>
                }
              >
                {expandedSection === 'runHistory' ? (
                  <div className="ai-task-detail-content-scroll ai-task-run-history-scroll">
                    {runsQuery.isLoading ? (
                      <div className="ai-task-run-history-placeholder">
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="运行记录加载中..." />
                      </div>
                    ) : runRecords.length > 0 ? (
                      <div className="ai-task-run-history-list single-list">
                        {runRecords.map((record, index) => {
                          const active = record.runId === selectedRunId
                          const recordStatus = active && selectedRun ? selectedRun.status : record.status
                          const recordSucceeded = String(recordStatus ?? '').toLowerCase() === 'success'
                          const recordStage = active && selectedRun ? selectedRun.currentStage : record.currentStage
                          const recordStageMeta = getRequirementAnalysisStageMeta(
                            recordStage,
                          )
                          const showRecordStage = recordStage && recordStage !== 'completed'
                          const visibleSections = runResultSectionDefinitions.filter(
                            (section) =>
                              !(section.key === 'errorMessage' && recordSucceeded),
                          )

                          return (
                            <div
                              key={record.runId ?? `${index}`}
                              className={`ai-task-run-history-record-row${active ? ' active' : ''}`}
                              onClick={() => setSelectedRunRecordId(record.runId ?? null)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  setSelectedRunRecordId(record.runId ?? null)
                                }
                              }}
                            >
                              <div className="ai-task-run-history-record-main">
                                <div className="ai-task-run-history-record-identity">
                                  <span className="ai-task-run-history-record-index">#{index + 1}</span>
                                  <span className="ai-task-run-history-record-name" title={record.runId || '未命名记录'}>
                                    {record.runId || '未命名记录'}
                                  </span>
                                </div>
                                <div className="ai-task-run-history-record-meta">
                                  <span className="ai-task-run-history-record-status">
                                    {renderApiCaseGenerateTaskRunStatusTag(recordStatus)}
                                  </span>
                                  {showRecordStage ? (
                                    <span className="ai-task-run-history-record-stage">
                                      <Tag color={recordStageMeta.color}>{recordStageMeta.label}</Tag>
                                    </span>
                                  ) : null}
                                  <span className="ai-task-run-history-record-field">耗时：{formatDurationSeconds(record.durationMs)}</span>
                                </div>
                              </div>
                              <div className="ai-task-run-history-record-actions">
                                {visibleSections.map((section) => {
                                  const showStageReview = active && section.key === selectedStageField?.key && checkpointStageWaitingReview
                                  const isOpen = active && runResultModal?.key === section.key
                                  const sectionLabel = showStageReview ? '审核' : section.label

                                  return (
                                    <button
                                      key={section.key}
                                      type="button"
                                      className={`ai-task-run-result-popover-btn${isOpen ? ' active' : ''}${showStageReview ? ' review' : ''}`}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        setSelectedRunRecordId(record.runId ?? null)
                                        setRunResultModal({ key: section.key, label: sectionLabel })
                                      }}
                                    >
                                      {sectionLabel}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="ai-task-run-history-placeholder">
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无运行记录" />
                      </div>
                    )}
                  </div>
                ) : null}
              </Card>
            </div>
          </div>
        ) : (
          <Empty description="未找到需求分析任务" />
        )}
      </div>

      <RequirementAnalysisTaskDrawer
        title="编辑需求分析任务"
        open={drawerOpen}
        form={form}
        loading={updateTaskMutation.isPending}
        error={updateTaskMutation.error}
        sprintOptions={sprintOptions}
        requirementOptions={requirementOptions}
        onSprintChange={(value) => {
          setDrawerSprintId(value)
          form.setFieldValue('requirementId', undefined)
        }}
        onClose={() => setDrawerOpen(false)}
        onFinish={(values) => updateTaskMutation.mutate(values)}
      />

      <RequirementAnalysisRunModal
        open={runModalOpen}
        projectId={task?.projectId}
        loading={runTaskMutation.isPending}
        onClose={() => setRunModalOpen(false)}
        onConfirm={(values) => runTaskMutation.mutate(values)}
      />

      <Modal
        title={
          <div className="ai-task-run-result-expanded-title">
            <span>{showStageReviewInRunResultModal ? '审核' : runResultModal?.label || '运行结果'}</span>
            <div className="ai-task-run-result-expanded-actions">
              {canImportRunResultModal && !finalResultEditable ? (
                <Button
                  type="primary"
                  size="small"
                  loading={importRunMutation.isPending}
                  onClick={handleImportSelectedRun}
                >
                  导入需求
                </Button>
              ) : null}
            </div>
          </div>
        }
        open={Boolean(runResultModal)}
        onCancel={() => setRunResultModal(null)}
        footer={
          editableRunResultModal
            ? [
                <Button key="close" onClick={() => setRunResultModal(null)}>
                  关闭
                </Button>,
                <Button
                  key="save"
                  onClick={handleSaveStageOutput}
                  loading={saveStageOutputMutation.isPending && !stageReviewAction}
                  disabled={reviewStageMutation.isPending || reviseStageMutation.isPending}
                >
                  保存修改
                </Button>,
                <Button
                  key="revise"
                  onClick={openReviseStageModal}
                  loading={reviseStageMutation.isPending && stageReviewAction === 'revise'}
                  disabled={stageActionPending && stageReviewAction !== 'revise'}
                >
                  AI 修改
                </Button>,
                <Button
                  key="approve"
                  type="primary"
                  onClick={finalResultEditable ? handleImportSelectedRun : handleApproveStageReview}
                  loading={finalResultEditable ? importRunMutation.isPending : stageActionPending && stageReviewAction === 'approve'}
                  disabled={finalResultEditable ? stageActionPending : stageActionPending && stageReviewAction !== 'approve'}
                >
                  {finalResultEditable ? '导入需求' : '审核通过并继续'}
                </Button>,
              ]
            : null
        }
        width="min(1180px, calc(100vw - 56px))"
        className={`ai-task-run-result-modal api-task-run-result-modal${editableRunResultModal ? ' review' : ''}`}
        centered
        destroyOnHidden
      >
        <div className={`ai-task-run-result-modal-content api-task-run-result-modal-content${editableRunResultModal ? ' review' : ''}`}>
          {selectedRunQuery.isLoading ? (
            <div className="ai-task-run-result-popover-loading">
              <Spin />
            </div>
          ) : editableRunResultModal ? (
            <div className="ai-task-stage-review-popover">
              <div className="ai-task-run-result-popover-header">
                <span>{finalResultEditable ? '最终需求理解结果 resultYaml' : `阶段产物 ${selectedStageField?.label ?? '当前阶段'}`}</span>
                <div className="ai-task-stage-review-mini-tags">
                  <Tag color={selectedStageMeta.color}>{selectedStageMeta.label}</Tag>
                  <Tag color={selectedStageStatusMeta.color}>{selectedStageStatusMeta.label}</Tag>
                </div>
              </div>
              <div className="ai-task-stage-review-note compact">
                <strong>{finalResultEditable ? '最终结果/可编辑' : '待审核/可编辑'}</strong>
                <span>{finalResultEditable ? '当前编辑的是最终需求理解结果，保存或 AI 修改后仍需点击导入需求。' : '当前编辑的是本阶段产物，保存后会写回当前阶段输出，审核通过后继续进入下一阶段。'}</span>
              </div>
              <TextCodeEditor
                value={stageOutputDraft}
                onChange={(value) => {
                  setStageOutputDraft(value)
                  setStageOutputDirty(true)
                }}
                minHeight={360}
              />
            </div>
          ) : runResultModalContent ? (
            <pre className="ai-task-code-block">{runResultModalContent}</pre>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无内容" />
          )}
        </div>
      </Modal>

      <Modal
        title="AI 修改"
        open={reviseModalOpen}
        onCancel={() => {
          if (reviseStageMutation.isPending) return
          setReviseModalOpen(false)
          setRevisionInstruction('')
        }}
        onOk={handleReviseStage}
        okText="提交修改"
        cancelText="取消"
        confirmLoading={reviseStageMutation.isPending}
        okButtonProps={{ disabled: !revisionInstruction.trim() }}
        destroyOnHidden
      >
        <Input.TextArea
          value={revisionInstruction}
          onChange={(event) => setRevisionInstruction(event.target.value)}
          rows={5}
          maxLength={1000}
          showCount
          placeholder="例如：请补充图片中的流程信息，并增加异常场景"
        />
      </Modal>

    </div>
  )
}
