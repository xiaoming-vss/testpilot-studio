import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Descriptions, Empty, Form, Popconfirm, Space, Spin, Table, message } from 'antd'
import type { TableProps } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { SprintDrawer, type SprintFormValues } from '@/features/projects/components/SprintDrawer'
import { RequirementDrawer } from '@/features/requirements/components/RequirementDrawer'
import { api, type Requirement, type RequirementCreatePayload } from '@/services/api'
import { PageFrame, SectionHeader } from '@/shared/components/PageFrame/PageFrame'
import { formatTime, getErrorMessage, normalizeRequirementId, pickCreatedAt, pickEndTime, pickStartTime, pickUpdatedAt, statusTag } from '@/utils/format'
import { buildSprintUpdatePayload } from '@/utils/updatePayload'

function toPickerValue(value?: string) {
  if (!value) return undefined
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed : undefined
}

export function SprintDetailPage() {
  const { projectId = '', sprintId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [sprintOpen, setSprintOpen] = useState(false)
  const [requirementOpen, setRequirementOpen] = useState(false)
  const [sprintForm] = Form.useForm()
  const [requirementForm] = Form.useForm()

  const sprintQuery = useQuery({ queryKey: ['sprint', sprintId], queryFn: () => api.getSprint(sprintId), enabled: Boolean(sprintId) })
  const requirementsQuery = useQuery({
    queryKey: ['requirements', sprintId],
    queryFn: () => api.getRequirements(sprintId),
    enabled: Boolean(sprintId),
  })

  const updateSprintMutation = useMutation({
    mutationFn: (values: SprintFormValues) => api.updateSprint(sprintId, buildSprintUpdatePayload(sprintQuery.data!, values)),
    onSuccess: () => {
      message.success('迭代已更新')
      setSprintOpen(false)
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] })
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] })
    },
  })
  const deleteSprintMutation = useMutation({
    mutationFn: () => api.deleteSprint(sprintId),
    onSuccess: () => {
      message.success('迭代已删除')
      navigate(`/projects/${projectId}`)
    },
  })
  const createRequirementMutation = useMutation({
    mutationFn: (values: RequirementCreatePayload) => api.createRequirement(sprintId, values),
    onSuccess: () => {
      message.success('需求已创建')
      setRequirementOpen(false)
      requirementForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['requirements', sprintId] })
    },
  })

  useEffect(() => {
    if (sprintQuery.data) {
      sprintForm.setFieldsValue({
        ...sprintQuery.data,
        startTime: toPickerValue(pickStartTime(sprintQuery.data)),
        endTime: toPickerValue(pickEndTime(sprintQuery.data)),
      })
    }
  }, [sprintForm, sprintQuery.data])

  const columns: TableProps<Requirement>['columns'] = [
    {
      title: '需求名称',
      dataIndex: 'name',
      render: (text, row) => (
        <Link to={`/projects/${projectId}/sprints/${sprintId}/requirements/${normalizeRequirementId(row)}`}>{text}</Link>
      ),
    },
    { title: '状态', dataIndex: 'status', render: statusTag },
    { title: '描述', dataIndex: 'description', ellipsis: true, render: (text) => text || '-' },
    { title: '创建时间', render: (_, row) => formatTime(pickCreatedAt(row)) },
    { title: '更新时间', render: (_, row) => formatTime(pickUpdatedAt(row)) },
  ]

  return (
    <PageFrame
      title={sprintQuery.data?.name ?? '迭代详情'}
      description="查看迭代下的需求上下文，后续测试能力都将锚定到需求。"
      back={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/projects/${projectId}`)}>
          返回项目
        </Button>
      }
      actions={
        <Space>
          <Button className="action-btn-update" icon={<EditOutlined />} onClick={() => setSprintOpen(true)}>
            编辑迭代
          </Button>
          <Popconfirm title="确认删除这个迭代？" onConfirm={() => deleteSprintMutation.mutate()}>
            <Button danger className="action-btn-delete" icon={<DeleteOutlined />}>
              删除迭代
            </Button>
          </Popconfirm>
          <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} onClick={() => setRequirementOpen(true)}>
            新建需求
          </Button>
        </Space>
      }
    >
      {sprintQuery.error ? <Alert showIcon type="error" message={getErrorMessage(sprintQuery.error)} /> : null}
      {sprintQuery.data ? (
        <Descriptions bordered size="small" className="detail-block">
          <Descriptions.Item label="状态">{statusTag(sprintQuery.data.status)}</Descriptions.Item>
          <Descriptions.Item label="开始时间">{formatTime(pickStartTime(sprintQuery.data))}</Descriptions.Item>
          <Descriptions.Item label="结束时间">{formatTime(pickEndTime(sprintQuery.data))}</Descriptions.Item>
          <Descriptions.Item label="描述" span={3}>
            {sprintQuery.data.description || '-'}
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Spin />
      )}
      <SectionHeader title="需求列表" description="按创建时间升序展示当前迭代下的需求。" />
      {requirementsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(requirementsQuery.error)} /> : null}
      <Table
        rowKey={normalizeRequirementId}
        loading={requirementsQuery.isLoading}
        dataSource={requirementsQuery.data ?? []}
        columns={columns}
        locale={{ emptyText: <Empty description="暂无需求" /> }}
      />
      <SprintDrawer
        title="编辑迭代"
        open={sprintOpen}
        form={sprintForm}
        loading={updateSprintMutation.isPending}
        error={updateSprintMutation.error}
        onClose={() => setSprintOpen(false)}
        mode="edit"
        onFinish={(values) => updateSprintMutation.mutate(values)}
      />
      <RequirementDrawer
        title="新建需求"
        open={requirementOpen}
        form={requirementForm}
        loading={createRequirementMutation.isPending}
        error={createRequirementMutation.error}
        onClose={() => setRequirementOpen(false)}
        onFinish={(values) => createRequirementMutation.mutate(values)}
      />
    </PageFrame>
  )
}
