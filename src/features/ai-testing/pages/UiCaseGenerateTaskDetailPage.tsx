import { ArrowLeftOutlined, CaretRightOutlined, EditOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Descriptions, Empty, Input, Modal, Select, Space, Spin, Table, Tabs, Tag, Tooltip, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { LlmConnectionSelectModal } from '../components/LlmConnectionSelectModal'
import { validateUiSourceArchive } from '../utils/uiSourceArchive'
import type { UiCaseGenerateTaskRun } from '../types'
import { parseUiCaseCandidate } from '../utils/uiCaseCandidate'
import { TextCodeEditor } from '@/shared/components/TextCodeEditor/TextCodeEditor'
import { api, ApiError, listItems } from '@/services/api'
import { message } from '@/shared/utils/feedback'
import { formatTime, getErrorMessage, normalizeRequirementId, normalizeSprintId } from '@/utils/format'

const { Text, Title } = Typography
const activeRunStatuses = new Set(['pending', 'claimed', 'running'])

function formatBytes(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Number((value / 1024).toFixed(1))} KiB`
  return `${Number((value / 1024 / 1024).toFixed(1))} MiB`
}

function statusTag(status?: string) {
  const colors: Record<string, string> = {
    pending: 'gold',
    claimed: 'processing',
    running: 'processing',
    success: 'success',
    failed: 'error',
  }
  return <Tag color={colors[status ?? ''] ?? 'default'}>{status ?? '-'}</Tag>
}

function reviewTag(status?: string) {
  if (status === 'approved') return <Tag color="success">已批准</Tag>
  if (status === 'rejected') return <Tag>已拒绝</Tag>
  return <Tag color="gold">待审核</Tag>
}

function archiveErrorMessage(error: unknown) {
  const messageText = getErrorMessage(error)
  return error instanceof ApiError && error.status === 413
    ? `源码包超过上传大小限制：${messageText}`
    : messageText
}

function CandidatePreview({ yaml }: { yaml: string }) {
  const parsed = useMemo(() => parseUiCaseCandidate(yaml), [yaml])
  if (parsed.error) {
    return (
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Alert showIcon type="warning" title="YAML 暂时无法解析，已保留原文供修复" description={parsed.error} />
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{parsed.rawYaml}</pre>
      </Space>
    )
  }
  if (parsed.cases.length === 0) return <Empty description="候选结果中没有可预览的用例" />
  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {parsed.cases.map((candidate, caseIndex) => (
        <Card
          key={`${candidate.name ?? 'case'}-${caseIndex}`}
          size="small"
          title={candidate.name || `未命名用例 ${caseIndex + 1}`}
          extra={<Space>{candidate.enabled === undefined ? null : <Tag>{candidate.enabled ? '启用' : '停用'}</Tag>}<Text type="secondary">顺序 {candidate.orderNo ?? '-'}</Text></Space>}
        >
          {Object.keys(candidate.extraFields).length ? (
            <Descriptions size="small" column={1} items={Object.entries(candidate.extraFields).map(([key, value]) => ({ key, label: key, children: JSON.stringify(value) }))} />
          ) : null}
          <Table
            size="small"
            pagination={false}
            rowKey="__rowKey"
            dataSource={candidate.steps.map((step, index) => ({ ...step, __rowKey: index }))}
            columns={[
              { title: '顺序', dataIndex: 'orderNo', width: 70 },
              { title: '步骤名称', dataIndex: 'stepName' },
              { title: '关键字', dataIndex: 'keyword', width: 110 },
              { title: '定位类型', dataIndex: 'locatorType', width: 110 },
              { title: '定位值', dataIndex: 'locatorValue' },
              { title: '操作值', dataIndex: 'operationValue' },
              { title: '失败继续', dataIndex: 'continueOnFailure', render: (value) => value === undefined ? '-' : value ? '是' : '否' },
              { title: '启用', dataIndex: 'enabled', render: (value) => value === undefined ? '-' : value ? '是' : '否' },
              { title: '其他字段', dataIndex: 'extraFields', render: (value) => Object.keys(value ?? {}).length ? JSON.stringify(value) : '-' },
            ]}
          />
        </Card>
      ))}
    </Space>
  )
}

type DetailLocationState = { pendingSourceArchive?: File; pendingSourceArchiveError?: string } | null

export function UiCaseGenerateTaskDetailPage() {
  const { taskId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const pendingNavigationFile = (location.state as DetailLocationState)?.pendingSourceArchive
  const pendingNavigationError = (location.state as DetailLocationState)?.pendingSourceArchiveError
  const [selectedRunId, setSelectedRunId] = useState<string>()
  const [draftYaml, setDraftYaml] = useState('')
  const [savedYaml, setSavedYaml] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [llmModalOpen, setLlmModalOpen] = useState(false)
  const [archiveModalOpen, setArchiveModalOpen] = useState(Boolean(pendingNavigationFile))
  const [archiveFile, setArchiveFile] = useState<File | undefined>(pendingNavigationFile)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editInstruction, setEditInstruction] = useState('')
  const [editSprintId, setEditSprintId] = useState<string>()
  const [editRequirementId, setEditRequirementId] = useState<string>()

  const taskQuery = useQuery({
    queryKey: ['uiCaseGenerateTask', taskId],
    queryFn: () => api.getUiCaseGenerateTask(taskId),
    enabled: Boolean(taskId),
    retry: false,
  })
  const runsQuery = useQuery({
    queryKey: ['uiCaseGenerateTaskRuns', taskId],
    queryFn: () => api.getUiCaseGenerateTaskRuns(taskId),
    enabled: Boolean(taskId) && !taskQuery.error,
    refetchInterval: (query) => listItems(query.state.data).some((run) => activeRunStatuses.has(run.status ?? '')) ? 2000 : false,
    retry: false,
  })
  const runs = useMemo(
    () => [...listItems(runsQuery.data)].sort((left, right) => new Date(right.createdAt ?? '').getTime() - new Date(left.createdAt ?? '').getTime()),
    [runsQuery.data],
  )

  useEffect(() => {
    if (!selectedRunId && runs[0]?.runId) setSelectedRunId(runs[0].runId)
  }, [runs, selectedRunId])

  const selectedRunQuery = useQuery({
    queryKey: ['uiCaseGenerateTaskRun', selectedRunId],
    queryFn: () => api.getUiCaseGenerateTaskRun(selectedRunId!),
    enabled: Boolean(selectedRunId),
    refetchInterval: (query) => activeRunStatuses.has((query.state.data as UiCaseGenerateTaskRun | undefined)?.status ?? '') ? 2000 : false,
    retry: false,
  })
  const selectedRun = selectedRunQuery.error
    ? undefined
    : selectedRunQuery.data ?? runs.find((run) => run.runId === selectedRunId)

  const editSprintsQuery = useQuery({
    queryKey: ['sprints', 'uiTaskEdit', taskQuery.data?.projectId],
    queryFn: () => api.getSprints(taskQuery.data!.projectId!),
    enabled: editModalOpen && Boolean(taskQuery.data?.projectId),
  })
  const editRequirementsQuery = useQuery({
    queryKey: ['requirements', 'uiTaskEdit', editSprintId],
    queryFn: () => api.getRequirements(editSprintId!),
    enabled: editModalOpen && Boolean(editSprintId),
  })

  useEffect(() => {
    const nextYaml = selectedRun?.resultYaml ?? ''
    setDraftYaml(nextYaml)
    setSavedYaml(nextYaml)
    setReviewComment('')
  }, [selectedRun?.resultYaml, selectedRun?.runId])

  const hasActiveRun = runs.some((run) => activeRunStatuses.has(run.status ?? ''))
  const canEditCandidate = selectedRun?.status === 'success' && (selectedRun.reviewStatus ?? 'pending') === 'pending'
  const hasUnsavedChanges = draftYaml !== savedYaml
  const canReview = canEditCandidate && Boolean(savedYaml.trim()) && !hasUnsavedChanges

  function navigateBack() {
    if (!hasUnsavedChanges) {
      navigate('/ai-testing/tasks')
      return
    }
    Modal.confirm({
      title: '放弃未保存的候选改动？',
      content: '离开页面后，本次未保存的 YAML 修改将丢失。',
      okText: '放弃并离开',
      okButtonProps: { danger: true },
      onOk: () => navigate('/ai-testing/tasks'),
    })
  }

  function selectRun(runId?: string) {
    if (!runId || runId === selectedRunId) return
    if (!hasUnsavedChanges) {
      setSelectedRunId(runId)
      return
    }
    Modal.confirm({
      title: '放弃未保存的候选改动？',
      content: '切换运行记录会丢失当前未保存的 YAML 修改。',
      okText: '放弃并切换',
      okButtonProps: { danger: true },
      onOk: () => setSelectedRunId(runId),
    })
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadUiCaseGenerateTaskSourceArchive(taskId, file),
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(['uiCaseGenerateTask', taskId], updatedTask)
      queryClient.invalidateQueries({ queryKey: ['uiCaseGenerateTasks', updatedTask.projectId] })
      message.success(taskQuery.data?.sourceArchive ? '源码包已替换' : '源码包已上传')
      setArchiveModalOpen(false)
      setArchiveFile(undefined)
      navigate(location.pathname, { replace: true, state: null })
    },
  })
  const updateTaskMutation = useMutation({
    mutationFn: () => api.updateUiCaseGenerateTask(taskId, {
      name: editName.trim(),
      sprintId: editSprintId!,
      requirementId: editRequirementId!,
      instruction: editInstruction.trim(),
    }),
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(['uiCaseGenerateTask', taskId], updatedTask)
      queryClient.invalidateQueries({ queryKey: ['uiCaseGenerateTasks', updatedTask.projectId] })
      setEditModalOpen(false)
      message.success('任务已更新')
    },
  })
  const runMutation = useMutation({
    mutationFn: (connectionId: string) => api.runUiCaseGenerateTask(taskId, { connectionId }),
    onSuccess: (createdRun) => {
      setLlmModalOpen(false)
      setSelectedRunId(createdRun.runId)
      queryClient.invalidateQueries({ queryKey: ['uiCaseGenerateTaskRuns', taskId] })
      message.success('任务已加入执行队列')
    },
  })
  const saveMutation = useMutation({
    mutationFn: () => api.updateUiCaseGenerateTaskRunResult(selectedRunId!, { resultYaml: draftYaml }),
    onSuccess: (updatedRun) => {
      queryClient.setQueryData(['uiCaseGenerateTaskRun', selectedRunId], updatedRun)
      setSavedYaml(updatedRun.resultYaml ?? draftYaml)
      setDraftYaml(updatedRun.resultYaml ?? draftYaml)
      message.success('候选结果已保存')
    },
  })
  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') => api.reviewUiCaseGenerateTaskRun(selectedRunId!, {
      action,
      ...(reviewComment.trim() ? { reviewComment: reviewComment.trim() } : {}),
    }),
    onSuccess: (updatedRun) => {
      queryClient.setQueryData(['uiCaseGenerateTaskRun', selectedRunId], updatedRun)
      queryClient.invalidateQueries({ queryKey: ['uiCaseGenerateTaskRuns', taskId] })
      message.success(updatedRun.reviewStatus === 'approved' ? '候选结果已批准' : '候选结果已拒绝')
    },
  })

  if (taskQuery.isLoading) return <div className="workbench-page"><Spin /></div>
  if (taskQuery.error) {
    return <div className="workbench-page"><Alert showIcon type="error" title={getErrorMessage(taskQuery.error)} description="无法访问该 UI 生成任务。" /></div>
  }
  const task = taskQuery.data
  if (!task) return <div className="workbench-page"><Empty description="任务不存在" /></div>

  const archiveValidationError = validateUiSourceArchive(archiveFile)
  const replacementBlocked = hasActiveRun

  return (
    <div className="workbench-page ai-testing-page">
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={navigateBack}>返回任务列表</Button>
            <div><Title level={3} style={{ margin: 0 }}>{task.name}</Title><Text type="secondary">UI 用例生成 · ZIP 源码包</Text></div>
          </Space>
          <Space>
            <Button icon={<EditOutlined />} onClick={() => {
              setEditName(task.name)
              setEditInstruction(task.instruction)
              setEditSprintId(task.sprintId)
              setEditRequirementId(task.requirementId)
              setEditModalOpen(true)
            }}>编辑任务</Button>
            <Tooltip title={!task.sourceArchive ? '请先上传源码 ZIP' : hasActiveRun ? '任务执行中，暂时不能重复运行' : '运行任务'}>
              <span><Button type="primary" icon={<CaretRightOutlined />} disabled={!task.sourceArchive || hasActiveRun} onClick={() => setLlmModalOpen(true)}>运行任务</Button></span>
            </Tooltip>
            <Button icon={<ReloadOutlined />} onClick={() => { taskQuery.refetch(); runsQuery.refetch(); selectedRunQuery.refetch() }}>刷新</Button>
          </Space>
        </Space>

        {runMutation.error ? <Alert showIcon type="error" title={getErrorMessage(runMutation.error)} /> : null}

        <Card title="源码包" extra={<Tooltip title={replacementBlocked ? '存在执行中的运行，完成后才能替换源码包' : undefined}><span><Button icon={task.sourceArchive ? <EditOutlined /> : <UploadOutlined />} disabled={replacementBlocked} onClick={() => setArchiveModalOpen(true)}>{task.sourceArchive ? '替换源码包' : '上传源码包'}</Button></span></Tooltip>}>
          {task.sourceArchive ? (
            <Descriptions column={2} items={[
              { key: 'filename', label: '文件名', children: task.sourceArchive.filename },
              { key: 'size', label: '大小', children: formatBytes(task.sourceArchive.sizeBytes) },
              { key: 'uploadedAt', label: '上传时间', children: formatTime(task.sourceArchive.uploadedAt) },
              { key: 'sha256', label: 'SHA256', children: <Text code copyable>{task.sourceArchive.sha256}</Text> },
            ]} />
          ) : <Alert showIcon type="info" title="请先上传源码 ZIP" description="没有有效源码包时不能运行任务。" />}
        </Card>

        <Card title="运行记录">
          {runsQuery.error ? <Alert showIcon type="error" title={getErrorMessage(runsQuery.error)} /> : null}
          <Table<UiCaseGenerateTaskRun>
            size="small"
            loading={runsQuery.isLoading}
            pagination={false}
            rowKey={(item) => item.runId ?? ''}
            dataSource={runs}
            rowSelection={{ type: 'radio', selectedRowKeys: selectedRunId ? [selectedRunId] : [], onChange: (keys) => selectRun(String(keys[0])) }}
            onRow={(item) => ({ onClick: () => selectRun(item.runId) })}
            columns={[
              { title: '状态', dataIndex: 'status', render: (value) => statusTag(value) },
              { title: '审核', dataIndex: 'reviewStatus', render: (value) => reviewTag(value) },
              { title: '开始时间', dataIndex: 'startedAt', render: (value, item) => formatTime(value ?? item.createdAt) },
              { title: '完成时间', dataIndex: 'finishedAt', render: (value) => formatTime(value) },
              { title: '错误', dataIndex: 'errorMessage', render: (value) => value || '-' },
            ]}
          />
        </Card>

        {selectedRunQuery.error ? (
          <Card title="候选结果">
            <Alert showIcon type="error" title={getErrorMessage(selectedRunQuery.error)} description="无法访问该运行详情，候选内容已隐藏。" />
          </Card>
        ) : selectedRun ? (
          <Card title={<Space>候选结果 {statusTag(selectedRun.status)} {reviewTag(selectedRun.reviewStatus)} {selectedRun.reviewStatus === 'approved' ? <Tag color="gold">待导入</Tag> : null}</Space>}>
            {saveMutation.error ? <Alert showIcon type="error" title={getErrorMessage(saveMutation.error)} style={{ marginBottom: 12 }} /> : null}
            {reviewMutation.error ? <Alert showIcon type="error" title={getErrorMessage(reviewMutation.error)} style={{ marginBottom: 12 }} /> : null}
            <Tabs items={[
              { key: 'preview', label: '结构化预览', children: <CandidatePreview yaml={draftYaml} /> },
              { key: 'yaml', label: '编辑 YAML', children: <TextCodeEditor value={draftYaml} onChange={setDraftYaml} readOnly={!canEditCandidate} ariaLabel="候选结果 YAML" minHeight={320} /> },
            ]} />
            <Space orientation="vertical" style={{ width: '100%', marginTop: 12 }}>
              {hasUnsavedChanges ? <Alert showIcon type="warning" title="存在未保存改动，保存或还原后才能审核" /> : null}
              <Space wrap>
                <Button type="primary" disabled={!canEditCandidate || !hasUnsavedChanges} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>保存候选结果</Button>
                <Button disabled={!hasUnsavedChanges} onClick={() => setDraftYaml(savedYaml)}>还原未保存改动</Button>
                <Input aria-label="审核备注" placeholder="审核备注（可选）" value={reviewComment} disabled={!canEditCandidate} onChange={(event) => setReviewComment(event.target.value)} style={{ width: 260 }} />
                <Button disabled={!canReview} loading={reviewMutation.isPending} onClick={() => reviewMutation.mutate('approve')}>批准候选</Button>
                <Button danger disabled={!canReview} loading={reviewMutation.isPending} onClick={() => reviewMutation.mutate('reject')}>拒绝候选</Button>
              </Space>
            </Space>
          </Card>
        ) : <Card><Empty description="请选择一条运行记录查看候选结果" /></Card>}
      </Space>

      <Modal
        title="编辑 UI 用例生成任务"
        open={editModalOpen}
        okText="保存"
        okButtonProps={{ disabled: !editName.trim() || !editSprintId || !editRequirementId, loading: updateTaskMutation.isPending }}
        cancelButtonProps={{ disabled: updateTaskMutation.isPending }}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => updateTaskMutation.mutate()}
      >
        {updateTaskMutation.error ? <Alert showIcon type="error" title={getErrorMessage(updateTaskMutation.error)} style={{ marginBottom: 12 }} /> : null}
        <Space orientation="vertical" style={{ width: '100%' }}>
          <label>任务名称<Input aria-label="编辑任务名称" value={editName} maxLength={120} onChange={(event) => setEditName(event.target.value)} /></label>
          <label>所属迭代<Select aria-label="编辑所属迭代" value={editSprintId} loading={editSprintsQuery.isLoading} options={listItems(editSprintsQuery.data).map((sprint) => ({ label: sprint.name, value: normalizeSprintId(sprint) }))} onChange={(value) => { setEditSprintId(value); setEditRequirementId(undefined) }} style={{ width: '100%' }} /></label>
          <label>所属需求<Select aria-label="编辑所属需求" value={editRequirementId} loading={editRequirementsQuery.isLoading} options={listItems(editRequirementsQuery.data).map((requirement) => ({ label: requirement.name, value: normalizeRequirementId(requirement) }))} onChange={setEditRequirementId} style={{ width: '100%' }} /></label>
          <label>生成指令<Input.TextArea aria-label="编辑生成指令" value={editInstruction} maxLength={1000} onChange={(event) => setEditInstruction(event.target.value)} /></label>
        </Space>
      </Modal>

      <Modal
        title={task.sourceArchive ? '确认替换源码包' : '上传源码包'}
        open={archiveModalOpen}
        onCancel={() => { if (!uploadMutation.isPending) { setArchiveModalOpen(false); setArchiveFile(undefined) } }}
        okText={task.sourceArchive ? '确认替换' : '确认上传'}
        okButtonProps={{ disabled: Boolean(archiveValidationError), loading: uploadMutation.isPending }}
        cancelButtonProps={{ disabled: uploadMutation.isPending }}
        onOk={() => archiveFile && uploadMutation.mutate(archiveFile)}
      >
        {pendingNavigationError && !uploadMutation.error ? <Alert showIcon type="error" title={pendingNavigationError} style={{ marginBottom: 12 }} /> : null}
        {uploadMutation.error ? <Alert showIcon type="error" title={archiveErrorMessage(uploadMutation.error)} style={{ marginBottom: 12 }} /> : null}
        {task.sourceArchive ? <Alert showIcon type="warning" title={`当前：${task.sourceArchive.filename}`} description="替换只影响后续运行；替换失败时当前源码包仍然有效。" style={{ marginBottom: 12 }} /> : null}
        <input aria-label="新的源码 ZIP" type="file" accept=".zip,application/zip" disabled={uploadMutation.isPending} onChange={(event) => setArchiveFile(event.target.files?.[0])} />
        {archiveFile ? <Text style={{ display: 'block', marginTop: 8 }}>新文件：{archiveFile.name}</Text> : null}
        {archiveFile && archiveValidationError ? <Alert showIcon type="error" title={archiveValidationError} style={{ marginTop: 12 }} /> : null}
      </Modal>

      <LlmConnectionSelectModal
        open={llmModalOpen}
        projectId={task.projectId}
        loading={runMutation.isPending}
        onClose={() => setLlmModalOpen(false)}
        onConfirm={(connectionId) => runMutation.mutate(connectionId)}
      />
    </div>
  )
}
