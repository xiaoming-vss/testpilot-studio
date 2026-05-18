import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Descriptions, Empty, Form, Input, Modal, Popconfirm, Space, Spin, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SprintDrawer } from '../components/EntityDrawers'
import { PageFrame, SectionHeader } from '../components/PageFrame'
import { api, type Project } from '../services/api'
import { formatTime, getErrorMessage, normalizeSprintId, pickCreatedAt, pickEndTime, pickStartTime, pickUpdatedAt, statusTag } from '../utils/format'
import { buildProjectUpdatePayload, buildSprintCreatePayload } from '../utils/updatePayload'

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [projectOpen, setProjectOpen] = useState(false)
  const [sprintOpen, setSprintOpen] = useState(false)
  const [projectForm] = Form.useForm()
  const [sprintForm] = Form.useForm()

  const projectQuery = useQuery({ queryKey: ['project', projectId], queryFn: () => api.getProject(projectId), enabled: Boolean(projectId) })
  const sprintsQuery = useQuery({ queryKey: ['sprints', projectId], queryFn: () => api.getSprints(projectId), enabled: Boolean(projectId) })

  const updateProjectMutation = useMutation({
    mutationFn: (values: Pick<Project, 'name' | 'description'>) =>
      api.updateProject(projectId, buildProjectUpdatePayload(projectQuery.data!, values)),
    onSuccess: () => {
      message.success('项目已更新')
      setProjectOpen(false)
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
  const deleteProjectMutation = useMutation({
    mutationFn: () => api.deleteProject(projectId),
    onSuccess: () => {
      message.success('项目已删除')
      navigate('/projects')
    },
  })
  const createSprintMutation = useMutation({
    mutationFn: (values: Parameters<typeof buildSprintCreatePayload>[0]) => api.createSprint(projectId, buildSprintCreatePayload(values)),
    onSuccess: () => {
      message.success('迭代已创建')
      setSprintOpen(false)
      sprintForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] })
    },
  })

  useEffect(() => {
    if (projectQuery.data) projectForm.setFieldsValue(projectQuery.data)
  }, [projectForm, projectQuery.data])

  return (
    <PageFrame
      title={projectQuery.data?.name ?? '项目详情'}
      description={projectQuery.data?.description || '查看项目下的迭代与测试执行上下文。'}
      back={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>
          返回项目
        </Button>
      }
      actions={
        <Space>
          <Button className="action-btn-update" icon={<EditOutlined />} onClick={() => setProjectOpen(true)}>
            编辑项目
          </Button>
          <Popconfirm title="确认删除这个项目？" onConfirm={() => deleteProjectMutation.mutate()}>
            <Button danger className="action-btn-delete" icon={<DeleteOutlined />}>
              删除项目
            </Button>
          </Popconfirm>
          <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} onClick={() => setSprintOpen(true)}>
            新建迭代
          </Button>
        </Space>
      }
    >
      {projectQuery.isLoading ? <Spin /> : null}
      {projectQuery.error ? <Alert showIcon type="error" message={getErrorMessage(projectQuery.error)} /> : null}
      {projectQuery.data ? (
        <Descriptions bordered size="small" className="detail-block">
          <Descriptions.Item label="项目 ID">{projectId}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatTime(pickCreatedAt(projectQuery.data))}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatTime(pickUpdatedAt(projectQuery.data))}</Descriptions.Item>
        </Descriptions>
      ) : null}
      <SectionHeader title="迭代列表" description="当前项目下的每个迭代以独立卡片展示，便于快速浏览状态与时间范围。" />
      {sprintsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(sprintsQuery.error)} /> : null}
      {sprintsQuery.isLoading ? <Spin /> : null}
      {!sprintsQuery.isLoading && (sprintsQuery.data?.length ?? 0) === 0 ? <Empty description="暂无迭代" /> : null}
      {!sprintsQuery.isLoading && (sprintsQuery.data?.length ?? 0) > 0 ? (
        <div className="sprint-card-grid">
          {(sprintsQuery.data ?? []).map((sprint) => (
            <Link
              key={normalizeSprintId(sprint)}
              to={`/projects/${projectId}/sprints/${normalizeSprintId(sprint)}`}
              className="sprint-card-link"
            >
              <Card hoverable className="sprint-card" bodyStyle={{ padding: 20 }}>
                <div className="sprint-card-head">
                  <div className="sprint-card-title">{sprint.name}</div>
                  <div className="sprint-card-status">{statusTag(sprint.status)}</div>
                </div>
                <div className="sprint-card-meta">
                  <span className="sprint-card-label">开始时间</span>
                  <span className="sprint-card-value">{formatTime(pickStartTime(sprint))}</span>
                </div>
                <div className="sprint-card-meta">
                  <span className="sprint-card-label">结束时间</span>
                  <span className="sprint-card-value">{formatTime(pickEndTime(sprint))}</span>
                </div>
                <div className="sprint-card-description">{sprint.description || '暂无迭代描述'}</div>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
      <Modal
        title="编辑项目"
        open={projectOpen}
        onCancel={() => setProjectOpen(false)}
        onOk={() => projectForm.submit()}
        confirmLoading={updateProjectMutation.isPending}
        okButtonProps={{ className: 'action-btn-save' }}
      >
        {updateProjectMutation.error ? <Alert showIcon type="error" message={getErrorMessage(updateProjectMutation.error)} /> : null}
        <Form form={projectForm} layout="vertical" onFinish={(values) => updateProjectMutation.mutate(values)} requiredMark={false}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
      <SprintDrawer
        title="新建迭代"
        open={sprintOpen}
        form={sprintForm}
        loading={createSprintMutation.isPending}
        error={createSprintMutation.error}
        onClose={() => setSprintOpen(false)}
        onFinish={(values) => createSprintMutation.mutate(values)}
      />
    </PageFrame>
  )
}
