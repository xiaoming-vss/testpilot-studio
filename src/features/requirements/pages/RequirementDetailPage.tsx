import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { Alert, Button, Form, Popconfirm, Space, Spin, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiAutomationPage } from '@/features/api-automation/pages/ApiAutomationPage'
import { useActiveProject } from '@/features/projects/hooks/useActiveProject'
import { RequirementDrawer } from '@/features/requirements/components/RequirementDrawer'
import { TestCasePage } from '@/features/test-cases/pages/TestCasePage'
import { TestingTabSwitcher } from '@/features/testing/components/TestingTabSwitcher'
import { resolveTestingTab, type TestingTab } from '@/features/testing/components/testingTab'
import '@/features/testing/styles/index.css'
import { UiAutomationPage } from '@/features/ui-automation/pages/UiAutomationPage'
import { api, type Requirement } from '@/services/api'
import { getErrorMessage } from '@/utils/format'
import { buildRequirementUpdatePayload } from '@/utils/updatePayload'

const { Paragraph, Text, Title } = Typography

export function RequirementDetailPage() {
  const { projectId = '', sprintId = '', requirementId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const { setActiveProjectId } = useActiveProject()

  const activeTab = useMemo<TestingTab>(() => resolveTestingTab(searchParams.get('tab')), [searchParams])

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
      queryClient.invalidateQueries({ queryKey: ['requirementsPool', projectId] })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteRequirement(requirementId),
    onSuccess: () => {
      message.success('需求已删除')
      queryClient.invalidateQueries({ queryKey: ['requirements', sprintId] })
      queryClient.invalidateQueries({ queryKey: ['requirementsPool', projectId] })
      navigate('/projects')
    },
  })

  useEffect(() => {
    if (requirementQuery.data) form.setFieldsValue(requirementQuery.data)
  }, [form, requirementQuery.data])

  useEffect(() => {
    if (!projectId) return
    setActiveProjectId(projectId)
  }, [projectId, setActiveProjectId])

  function handleTabChange(nextTab: TestingTab) {
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('tab', nextTab)
    setSearchParams(nextSearchParams, { replace: true })
  }

  return (
    <div className="workbench-page testing-page requirement-testing-page">
      <section className="workbench-project-toolbar testing-toolbar requirement-testing-toolbar">
        <div className="requirement-testing-summary-row">
          <div className="requirement-testing-tabbar">
            <TestingTabSwitcher activeTab={activeTab} onChange={handleTabChange} />
          </div>
          <div className="requirement-testing-summary-main">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>
              返回项目
            </Button>
          </div>
        </div>
        <div className="requirement-testing-hover-body">
          <div className="requirement-testing-copy">
            <div className="requirement-testing-detail-head">
              <div className="requirement-testing-detail-copy">
                <Text type="secondary" className="requirement-testing-kicker">
                  需求测试工作台
                </Text>
                <Title level={4}>{requirementQuery.data?.name ?? '需求详情'}</Title>
                <div className="requirement-testing-meta">
                  <span>所属迭代：{sprintQuery.data?.name ?? sprintId ?? '-'}</span>
                  <span>状态：{requirementQuery.data?.status || '-'}</span>
                </div>
                <Paragraph className="requirement-testing-description" type="secondary" ellipsis={{ rows: 1 }}>
                  {requirementQuery.data?.description || '这里展示该需求下的功能测试、API测试和 UI测试内容。'}
                </Paragraph>
              </div>
              <Space size={8} className="requirement-testing-actions">
                <Button className="action-btn-update" icon={<EditOutlined />} onClick={() => setOpen(true)} disabled={!requirementQuery.data}>
                  编辑需求
                </Button>
                <Popconfirm title="确认删除这个需求？" onConfirm={() => deleteMutation.mutate()}>
                  <Button danger className="action-btn-delete" icon={<DeleteOutlined />} loading={deleteMutation.isPending}>
                    删除需求
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          </div>
        </div>
      </section>

      {requirementQuery.error ? <Alert showIcon type="error" message={getErrorMessage(requirementQuery.error)} /> : null}
      {sprintQuery.error ? <Alert showIcon type="error" message={getErrorMessage(sprintQuery.error)} /> : null}

      {!requirementId ? (
        <section className="workbench-panel workbench-board-panel requirement-testing-loading">
          <Spin />
        </section>
      ) : (
        <div className="testing-tab-panel">
          {activeTab === 'api' ? (
            <ApiAutomationPage
              scope={{
                projectId,
                sprintId,
                sprintName: sprintQuery.data?.name,
                requirementId,
                requirementName: requirementQuery.data?.name,
              }}
            />
          ) : null}
          {activeTab === 'ui' ? (
            <UiAutomationPage
              scope={{
                projectId,
                sprintId,
                sprintName: sprintQuery.data?.name,
                requirementId,
                requirementName: requirementQuery.data?.name,
              }}
            />
          ) : null}
          {activeTab === 'functional' ? (
            <TestCasePage
              scope={{
                projectId,
                sprintId,
                sprintName: sprintQuery.data?.name,
                requirementId,
                requirementName: requirementQuery.data?.name,
              }}
            />
          ) : null}
        </div>
      )}

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
    </div>
  )
}
