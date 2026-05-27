import { ArrowLeftOutlined, CaretRightOutlined, DeleteOutlined, DownOutlined, EditOutlined, RightOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Form, Input, Modal, Popconfirm, Popover, Select, Spin, Tag, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiCaseGenerateTaskDrawer, type ApiCaseGenerateTaskFormValues } from '../components/ApiCaseGenerateTaskDrawer'
import { isRunnableApiCaseGenerateTaskRun, renderApiCaseGenerateTaskRunStatusTag } from '../utils/taskStatus'
import '@/features/ai-testing/styles/index.css'
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { api } from '@/services/api'
import { formatTime, getErrorMessage, normalizeRequirementId, normalizeSprintId, normalizeUserName, pickUpdatedAt } from '@/utils/format'

const runResultSectionDefinitions = [
  { key: 'resultSummaryJson', label: '结果摘要' },
  { key: 'configJson', label: '中间配置' },
  { key: 'resultYaml', label: '结果 YAML' },
  { key: 'errorMessage', label: '错误信息' },
] as const

const reviewStatusMetaMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已丢弃', color: 'default' },
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

function formatDurationSeconds(durationMs?: number | null) {
  if (durationMs === undefined || durationMs === null) return '-'
  return `${(durationMs / 1000).toFixed(2)} s`
}

function normalizeReviewStatus(status?: string) {
  return status ?? 'pending'
}

function renderReviewStatusTag(status?: string) {
  const normalizedStatus = normalizeReviewStatus(status)
  const meta = reviewStatusMetaMap[normalizedStatus] ?? {
    label: normalizedStatus,
    color: 'default',
  }

  return <Tag color={meta.color}>{meta.label}</Tag>
}

export function ApiCaseGenerateTaskDetailPage() {
  const { taskId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSprintId, setDrawerSprintId] = useState<string | undefined>(undefined)
  const [expandedSection, setExpandedSection] = useState<'instruction' | 'sourceContent' | 'runHistory' | null>('runHistory')
  const [selectedRunRecordId, setSelectedRunRecordId] = useState<string | null>(null)
  const [openRunDetailPopoverKey, setOpenRunDetailPopoverKey] = useState<string | null>(null)
  const [reviewModalRunId, setReviewModalRunId] = useState<string | null>(null)
  const [reviewSubmitAction, setReviewSubmitAction] = useState<'approve' | 'reject' | null>(null)
  const [form] = Form.useForm<ApiCaseGenerateTaskFormValues>()
  const [reviewForm] = Form.useForm<{ collectionId?: string; comment?: string }>()
  useCurrentUser()
  const currentUser = useAuthStore((state) => state.user)

  const taskQuery = useQuery({
    queryKey: ['apiCaseGenerateTask', taskId],
    queryFn: () => api.getApiCaseGenerateTask(taskId),
    enabled: Boolean(taskId),
  })

  const task = taskQuery.data
  const runsQuery = useQuery({
    queryKey: ['apiCaseGenerateTaskRuns', taskId],
    queryFn: () => api.getApiCaseGenerateTaskRuns(taskId),
    enabled: Boolean(taskId),
  })
  const sprintsQuery = useQuery({
    queryKey: ['sprints', 'aiTestingDetail', task?.projectId],
    queryFn: async () => {
      const projectId = task?.projectId
      if (!projectId) return []
      return api.getSprints(projectId)
    },
    enabled: Boolean(task?.projectId),
  })
  const sprintOptions = useMemo(
    () => (sprintsQuery.data ?? []).map((sprint) => ({ label: sprint.name, value: normalizeSprintId(sprint) })),
    [sprintsQuery.data],
  )
  const requirementsQuery = useQuery({
    queryKey: ['requirements', 'aiTestingDetail', drawerSprintId],
    queryFn: () => api.getRequirements(drawerSprintId!),
    enabled: Boolean(drawerSprintId),
  })
  const requirementOptions = useMemo(
    () =>
      (requirementsQuery.data ?? []).map((requirement) => ({
        label: requirement.name,
        value: normalizeRequirementId(requirement),
      })),
    [requirementsQuery.data],
  )
  const apiCollectionsQuery = useQuery({
    queryKey: ['apiCollections', 'aiTestingReview', task?.requirementId],
    queryFn: async () => {
      const requirementId = task?.requirementId
      if (!requirementId) return []
      return api.getApiCollections(requirementId)
    },
    enabled: Boolean(task?.requirementId),
  })
  const sprintNameMap = useMemo(
    () => new Map((sprintsQuery.data ?? []).map((sprint) => [normalizeSprintId(sprint), sprint.name])),
    [sprintsQuery.data],
  )
  const requirementNameMap = useMemo(
    () => new Map((requirementsQuery.data ?? []).map((requirement) => [normalizeRequirementId(requirement), requirement.name])),
    [requirementsQuery.data],
  )

  const runRecords = useMemo(
    () =>
      [...(runsQuery.data ?? [])].sort((left, right) => {
        const leftTime = new Date(left.createdAt || left.startedAt || left.updatedAt || '').getTime()
        const rightTime = new Date(right.createdAt || right.startedAt || right.updatedAt || '').getTime()
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
      }),
    [runsQuery.data],
  )
  const latestRunRecord = runRecords[0]

  const selectedRunId = selectedRunRecordId ?? runRecords[0]?.runId ?? ''
  const selectedRunQuery = useQuery({
    queryKey: ['apiCaseGenerateTaskRun', selectedRunId],
    queryFn: () => api.getApiCaseGenerateTaskRun(selectedRunId),
    enabled: Boolean(selectedRunId),
  })
  const selectedRun = selectedRunQuery.data
  const selectedRunResultSections = useMemo(
    () =>
      selectedRun
        ? runResultSectionDefinitions
            .map((section) => {
              const rawValue = selectedRun[section.key]
              return { ...section, value: formatStructuredContent(rawValue) }
            })
            .filter((item) => item.value)
      : [],
    [selectedRun],
  )
  const apiCollectionOptions = useMemo(
    () =>
      (apiCollectionsQuery.data ?? []).map((collection) => ({
        label: collection.name,
        value: collection.collectionId ?? collection.collection_id ?? '',
      })),
    [apiCollectionsQuery.data],
  )
  const apiCollectionNameMap = useMemo(
    () =>
      new Map(
        (apiCollectionsQuery.data ?? []).map((collection) => [
          collection.collectionId ?? collection.collection_id ?? '',
          collection.name,
        ]),
      ),
    [apiCollectionsQuery.data],
  )

  useEffect(() => {
    if (!task) return
    setDrawerSprintId(task.sprintId)
    form.setFieldsValue({
      name: task.name,
      sprintId: task.sprintId,
      requirementId: task.requirementId,
      sourceType: task.sourceType,
      sourceContent: task.sourceContent,
      instruction: task.instruction,
    })
  }, [form, task])

  useEffect(() => {
    setExpandedSection('runHistory')
  }, [taskId])

  const updateTaskMutation = useMutation({
    mutationFn: (values: ApiCaseGenerateTaskFormValues) => api.updateApiCaseGenerateTask(taskId, values),
    onSuccess: (updatedTask) => {
      message.success('任务已更新')
      setDrawerOpen(false)
      queryClient.setQueryData(['apiCaseGenerateTask', taskId], updatedTask)
      queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTasks', updatedTask.projectId] })
    },
  })

  const runTaskMutation = useMutation({
    mutationFn: () => api.runApiCaseGenerateTask(taskId),
    onSuccess: (run) => {
      message.success('任务已加入执行队列')
      setExpandedSection('runHistory')
      setSelectedRunRecordId(run.runId ?? null)
      queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTask', taskId] })
      queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTaskRuns', taskId] })
      queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTasks', task?.projectId ?? run.projectId] })
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: () => api.deleteApiCaseGenerateTask(taskId),
    onSuccess: () => {
      message.success('任务已删除')
      queryClient.removeQueries({ queryKey: ['apiCaseGenerateTask', taskId], exact: true })
      if (task?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTasks', task.projectId] })
      }
      navigate('/ai-testing')
    },
  })

  const reviewRunMutation = useMutation({
    mutationFn: (payload: {
      runId: string
      body:
        | { action: 'approve'; collectionId: string; comment?: string }
        | { action: 'reject'; comment?: string }
    }) => api.reviewApiCaseGenerateTaskRun(payload.runId, payload.body),
    onSuccess: (updatedRun, payload) => {
      message.success(payload.body.action === 'approve' ? '审核已通过并导入API测试集' : '已丢弃本次生成结果')
      setReviewModalRunId(null)
      setReviewSubmitAction(null)
      reviewForm.resetFields()
      setSelectedRunRecordId(updatedRun.runId ?? payload.runId)
      queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTaskRun', payload.runId] })
      queryClient.invalidateQueries({ queryKey: ['apiCaseGenerateTaskRuns', taskId] })
    },
  })

  const creatorName = useMemo(() => normalizeUserName(currentUser), [currentUser])
  const runnableTask = isRunnableApiCaseGenerateTaskRun(latestRunRecord?.status)
  const detailItems = useMemo(
    () =>
      task
        ? [
            { label: '任务名称', value: task.name || '-' },
            { label: '迭代', value: sprintNameMap.get(task.sprintId ?? '') ?? task.sprintId ?? '-' },
            { label: '需求', value: requirementNameMap.get(task.requirementId ?? '') ?? task.requirementId ?? '-' },
            { label: '来源类型', value: task.sourceType },
            { label: '创建人', value: creatorName },
            { label: '更新时间', value: formatTime(pickUpdatedAt(task)) },
          ]
        : [],
    [creatorName, requirementNameMap, sprintNameMap, task],
  )

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
    setOpenRunDetailPopoverKey(null)
  }, [selectedRunId])

  useEffect(() => {
    if (!reviewModalRunId) {
      reviewForm.resetFields()
      return
    }
    reviewForm.setFieldsValue({
      collectionId: undefined,
      comment: undefined,
    })
  }, [reviewForm, reviewModalRunId])

  const selectedRunResultSectionMap = useMemo(
    () => new Map(selectedRunResultSections.map((section) => [section.key, section.value])),
    [selectedRunResultSections],
  )
  const selectedRunReviewStatus = normalizeReviewStatus(selectedRun?.reviewStatus)
  const selectedRunImportedCollectionId = selectedRun?.importedCollectionId ?? ''
  const selectedRunImportedCollectionName = selectedRunImportedCollectionId
    ? (apiCollectionNameMap.get(selectedRunImportedCollectionId) ?? selectedRunImportedCollectionId)
    : ''

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
    runTaskMutation.mutate()
  }

  function openReviewModal(runId?: string) {
    if (!runId) return
    setSelectedRunRecordId(runId)
    setReviewModalRunId(runId)
    setReviewSubmitAction(null)
  }

  async function handleApproveReview() {
    if (!reviewModalRunId) return
    const values = await reviewForm.validateFields(['collectionId', 'comment'])
    setReviewSubmitAction('approve')
    reviewRunMutation.mutate({
      runId: reviewModalRunId,
      body: {
        action: 'approve',
        collectionId: values.collectionId || '',
        comment: values.comment?.trim() || undefined,
      },
    })
  }

  function handleRejectReview() {
    if (!reviewModalRunId) return
    const values = reviewForm.getFieldsValue()
    setReviewSubmitAction('reject')
    reviewRunMutation.mutate({
      runId: reviewModalRunId,
      body: {
        action: 'reject',
        comment: values.comment?.trim() || undefined,
      },
    })
  }

  return (
    <div className="workbench-page ai-testing-page">
      <div className="workbench-tabs">
      {taskQuery.error ? <Alert showIcon type="error" message={getErrorMessage(taskQuery.error)} /> : null}
      {runsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(runsQuery.error)} /> : null}

      {!task && taskQuery.isLoading ? (
        <Spin />
      ) : task ? (
        <div className="ai-task-detail-layout">
          <Card className="ai-task-detail-summary-card">
            <div className="ai-task-detail-inline-meta">
              {detailItems.map((item) => (
                <div key={item.label} className="ai-task-detail-inline-item">
                  <span className="ai-task-detail-inline-label">{item.label}</span>
                  <span className="ai-task-detail-inline-value">{item.value}</span>
                </div>
              ))}
              <div className="ai-task-detail-inline-actions">
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ai-testing')}>
                  返回
                </Button>
                <Button
                  className="action-btn-run"
                  icon={<CaretRightOutlined />}
                  disabled={runsQuery.isLoading || !runnableTask}
                  loading={runTaskMutation.isPending}
                  onClick={handleRunTask}
                >
                  运行
                </Button>
                <Button
                  className="action-btn-update"
                  icon={<EditOutlined />}
                  onClick={() => setDrawerOpen(true)}
                >
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
                  <pre className="ai-task-code-block">{task.sourceContent || '-'}</pre>
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
                  <span>生成指令</span>
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
                        const sectionValues = active ? selectedRunResultSectionMap : new Map<string, string>()
                        const visibleSections = runResultSectionDefinitions.filter(
                          (section) => !(section.key === 'errorMessage' && String(record.status ?? '').toLowerCase() === 'success'),
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
                                <span className="ai-task-run-history-record-name">{record.runId || '未命名记录'}</span>
                              </div>
                              <div className="ai-task-run-history-record-meta">
                                <span className="ai-task-run-history-record-status">{renderApiCaseGenerateTaskRunStatusTag(record.status)}</span>
                                {active && selectedRun ? (
                                  <span className="ai-task-run-history-review-status">{renderReviewStatusTag(selectedRun.reviewStatus)}</span>
                                ) : null}
                                <span className="ai-task-run-history-record-field">开始：{formatTime(record.startedAt)}</span>
                                <span className="ai-task-run-history-record-field">结束：{formatTime(record.finishedAt)}</span>
                                <span className="ai-task-run-history-record-field">耗时：{formatDurationSeconds(record.durationMs)}</span>
                              </div>
                            </div>
                            <div className="ai-task-run-history-record-actions">
                              {visibleSections.map((section) => {
                                const popoverKey = `${record.runId ?? index}:${section.key}`
                                const isOpen = openRunDetailPopoverKey === popoverKey
                                const loading = active && selectedRunQuery.isLoading
                                const content = active ? sectionValues.get(section.key) : undefined

                                return (
                                  <Popover
                                    key={popoverKey}
                                    trigger="click"
                                    placement="bottomRight"
                                    overlayClassName="ai-task-run-result-popover"
                                    open={isOpen}
                                    onOpenChange={(open) => {
                                      setSelectedRunRecordId(record.runId ?? null)
                                      setOpenRunDetailPopoverKey(open ? popoverKey : null)
                                    }}
                                    content={(
                                      <div className="ai-task-run-result-popover-content">
                                        {loading ? (
                                          <div className="ai-task-run-result-popover-loading">
                                            <Spin size="small" />
                                          </div>
                                        ) : content ? (
                                          <pre className="ai-task-code-block">{content}</pre>
                                        ) : (
                                          <div className="ai-task-run-result-popover-empty">暂无内容</div>
                                        )}
                                      </div>
                                    )}
                                  >
                                    <button
                                      type="button"
                                      className={`ai-task-run-result-popover-btn${isOpen ? ' active' : ''}`}
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {section.label}
                                    </button>
                                  </Popover>
                                )
                              })}
                              {active && selectedRun ? (
                                <div className="ai-task-run-history-review-inline">
                                  {selectedRunReviewStatus === 'approved' && selectedRunImportedCollectionName ? (
                                    <span className="ai-task-run-history-record-field">导入：{selectedRunImportedCollectionName}</span>
                                  ) : null}
                                  {selectedRun.reviewedAt ? (
                                    <span className="ai-task-run-history-record-field">审核时间：{formatTime(selectedRun.reviewedAt)}</span>
                                  ) : null}
                                  {selectedRun.reviewComment ? (
                                    <Popover
                                      trigger="click"
                                      placement="bottomRight"
                                      content={<div className="ai-task-run-review-comment">{selectedRun.reviewComment}</div>}
                                    >
                                      <button
                                        type="button"
                                        className="ai-task-run-review-note-btn"
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        审核备注
                                      </button>
                                    </Popover>
                                  ) : null}
                                  {selectedRunReviewStatus === 'pending' ? (
                                    <Button
                                      size="small"
                                      type="primary"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        openReviewModal(record.runId)
                                      }}
                                    >
                                      审核
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                      {selectedRunQuery.isLoading && !selectedRun ? (
                        <div className="ai-task-run-history-placeholder compact">
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="运行详情加载中..." />
                        </div>
                      ) : null}
                      {selectedRun && selectedRunResultSections.length === 0 ? (
                        <div className="ai-task-run-history-hint compact">
                          当前选中记录暂无可展示结果
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="ai-task-run-history-placeholder">
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="当前还没有运行记录"
                      />
                      <div className="ai-task-run-history-hint">
                        点击上方“运行”后，任务状态和最近一次执行信息会展示在这里。
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      ) : (
        <Alert showIcon type="warning" message="未找到对应任务" />
      )}

      <ApiCaseGenerateTaskDrawer
        title="编辑 API 用例生成任务"
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

      <Modal
        title="审核 AI 生成结果"
        open={Boolean(reviewModalRunId)}
        onCancel={() => {
          setReviewModalRunId(null)
          setReviewSubmitAction(null)
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setReviewModalRunId(null)
            setReviewSubmitAction(null)
          }}>
            取消
          </Button>,
          <Button
            key="reject"
            danger
            ghost
            loading={reviewRunMutation.isPending && reviewSubmitAction === 'reject'}
            onClick={handleRejectReview}
          >
            审核不通过
          </Button>,
          <Button
            key="approve"
            type="primary"
            loading={reviewRunMutation.isPending && reviewSubmitAction === 'approve'}
            disabled={apiCollectionsQuery.isLoading || apiCollectionOptions.length === 0}
            onClick={handleApproveReview}
          >
            审核通过
          </Button>,
        ]}
        destroyOnHidden
        width={960}
      >
        <Form form={reviewForm} layout="vertical">
          <div className="ai-task-review-modal-content">
            <div className="ai-task-review-modal-section">
              <div className="ai-task-review-modal-label">生成结果 YAML</div>
              <div className="ai-task-review-modal-preview">
                {selectedRunQuery.isLoading ? (
                  <div className="ai-task-run-result-popover-loading">
                    <Spin />
                  </div>
                ) : selectedRun?.resultYaml ? (
                  <pre className="ai-task-code-block">{formatStructuredContent(selectedRun.resultYaml)}</pre>
                ) : (
                  <div className="ai-task-run-result-popover-empty">当前记录暂无 YAML 结果</div>
                )}
              </div>
            </div>
            <div className="ai-task-review-modal-section">
              <Form.Item
                label="通过后导入到API测试集"
                name="collectionId"
                rules={[{ required: true, message: '请选择要导入的API测试集' }]}
                extra={!apiCollectionsQuery.isLoading && apiCollectionOptions.length === 0 ? '当前需求下还没有可用的API测试集' : undefined}
              >
                <Select
                  showSearch
                  placeholder={apiCollectionsQuery.isLoading ? 'API测试集加载中...' : '请选择API测试集'}
                  options={apiCollectionOptions}
                  loading={apiCollectionsQuery.isLoading}
                  optionFilterProp="label"
                />
              </Form.Item>
            </div>
          </div>
          <Form.Item label="审核备注" name="comment">
            <Input.TextArea rows={4} placeholder="请输入审核备注或驳回原因" />
          </Form.Item>
        </Form>
      </Modal>
      </div>
    </div>
  )
}
