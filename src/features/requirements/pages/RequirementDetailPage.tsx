import {
  ApiOutlined,
  ArrowLeftOutlined,
  BugOutlined,
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Descriptions, Empty, Form, Popconfirm, Space, Spin, Tabs, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { UiTestSuiteSection } from '@/features/ui-automation/components/UiTestSuiteSection'
import { RequirementDrawer } from '@/features/requirements/components/RequirementDrawer'
import { api, type Requirement } from '@/services/api'
import { PageFrame } from '@/shared/components/PageFrame/PageFrame'
import { formatTime, getErrorMessage, pickUpdatedAt, statusTag } from '@/utils/format'
import { buildRequirementUpdatePayload } from '@/utils/updatePayload'

const { Text } = Typography

export function RequirementDetailPage() {
  const { projectId = '', sprintId = '', requirementId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const requirementQuery = useQuery({
    queryKey: ['requirement', requirementId],
    queryFn: () => api.getRequirement(requirementId),
    enabled: Boolean(requirementId),
  })
  const sprintQuery = useQuery({ queryKey: ['sprint', sprintId], queryFn: () => api.getSprint(sprintId), enabled: Boolean(sprintId) })

  const updateMutation = useMutation({
    mutationFn: (values: Partial<Requirement>) =>
      api.updateRequirement(requirementId, buildRequirementUpdatePayload(requirementQuery.data!, values)),
    onSuccess: () => {
      message.success('需求已更新')
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ['requirement', requirementId] })
      queryClient.invalidateQueries({ queryKey: ['requirements', sprintId] })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteRequirement(requirementId),
    onSuccess: () => {
      message.success('需求已删除')
      navigate(`/projects/${projectId}/sprints/${sprintId}`)
    },
  })

  useEffect(() => {
    if (requirementQuery.data) form.setFieldsValue(requirementQuery.data)
  }, [form, requirementQuery.data])

  return (
    <PageFrame
      title={requirementQuery.data?.name ?? '需求详情'}
      description="AI 生成用例、API 自动化和 UI Agent 执行都从这里进入。"
      back={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/projects/${projectId}/sprints/${sprintId}`)}>
          返回迭代
        </Button>
      }
      actions={
        <Space>
          <Button className="action-btn-update" icon={<EditOutlined />} onClick={() => setOpen(true)}>
            编辑需求
          </Button>
          <Popconfirm title="确认删除这个需求？" onConfirm={() => deleteMutation.mutate()}>
            <Button danger className="action-btn-delete" icon={<DeleteOutlined />}>
              删除需求
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      {requirementQuery.error ? <Alert showIcon type="error" message={getErrorMessage(requirementQuery.error)} /> : null}
      {requirementQuery.data ? (
        <Descriptions bordered size="small" className="detail-block">
          <Descriptions.Item label="状态">{statusTag(requirementQuery.data.status)}</Descriptions.Item>
          <Descriptions.Item label="所属迭代">{sprintQuery.data?.name ?? sprintId}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatTime(pickUpdatedAt(requirementQuery.data))}</Descriptions.Item>
          <Descriptions.Item label="需求描述" span={3}>
            {requirementQuery.data.description || '-'}
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Spin />
      )}
      <Card className="capability-card">
        <Tabs
          items={[
            { key: 'cases', label: '功能用例', children: <CapabilityEmpty icon={<ExperimentOutlined />} title="功能测试用例生成" action="生成测试用例" /> },
            { key: 'api', label: 'API 自动化', children: <CapabilityEmpty icon={<ApiOutlined />} title="Swagger / OpenAPI 导入" action="导入 Swagger/OpenAPI" /> },
            {
              key: 'ui',
              label: 'UI测试集',
              children: requirementId ? (
                <UiTestSuiteSection requirementId={requirementId} />
              ) : (
                <CapabilityEmpty icon={<BugOutlined />} title="UI测试集" action="新建 UI测试集" />
              ),
            },
          ]}
        />
      </Card>
      <RequirementDrawer
        title="编辑需求"
        open={open}
        form={form}
        loading={updateMutation.isPending}
        error={updateMutation.error}
        onClose={() => setOpen(false)}
        mode="edit"
        onFinish={(values) => updateMutation.mutate(values)}
      />
    </PageFrame>
  )
}

function CapabilityEmpty({ icon, title, action }: { icon: React.ReactNode; title: string; action: string }) {
  return (
    <Empty
      image={icon}
      description={
        <Space direction="vertical" size={4}>
          <Text strong>{title}</Text>
          <Text type="secondary">接口确认后将在这里承载真实生成、导入和执行流程。</Text>
        </Space>
      }
    >
      <Button className="action-btn-create" icon={<CodeOutlined />}>{action}</Button>
    </Empty>
  )
}
