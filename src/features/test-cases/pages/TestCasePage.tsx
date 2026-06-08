import { AppstoreOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Badge, Button, Card, Drawer, Empty, Form, Input, Pagination, Popconfirm, Select, Space, Tooltip, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSprintRequirementScope } from '@/features/projects/hooks/useSprintRequirementScope'
import { useWorkbenchStore } from '@/features/projects/store/workbench.store'
import { api, type FunctionTestSuite } from '@/services/api'
import {
  formatTime,
  getErrorMessage,
  normalizeFunctionTestSuiteId,
  normalizeRequirementId,
  pickCreatedAt,
  pickUpdatedAt,
} from '@/utils/format'

const { Paragraph, Text } = Typography

type FunctionalTestSuiteFormValues = {
  sprintId?: string
  requirementId?: string
  name: string
  description?: string
}

type TestCasePageScope = {
  projectId?: string
  sprintId?: string
  sprintName?: string
  requirementId: string
  requirementName?: string
}

function footerRange(total: number, currentPage: number, currentPageSize: number) {
  if (total === 0) return '显示第 0 条 - 第 0 条，共 0 条'
  const start = (currentPage - 1) * currentPageSize + 1
  const end = Math.min(currentPage * currentPageSize, total)
  return `显示第 ${start} 条 - 第 ${end} 条，共 ${total} 条`
}

export function TestCasePage({ scope }: { scope?: TestCasePageScope }) {
  const navigate = useNavigate()
  const workbenchActiveProjectId = useWorkbenchStore((state) => state.activeProjectId)
  const activeProjectId = scope?.projectId ?? workbenchActiveProjectId
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSprintId, setDrawerSprintId] = useState<string | undefined>(undefined)
  const [editingSuite, setEditingSuite] = useState<FunctionTestSuite | null>(null)
  const [form] = Form.useForm<FunctionalTestSuiteFormValues>()
  const isRequirementLocked = Boolean(scope?.requirementId)

  const {
    requirementFilterOptions,
    requirementsQuery,
    resolvedSelectedRequirementId,
    resolvedSelectedSprintId,
    selectRequirement,
    selectSprint,
    sprintFilterOptions,
    sprintsQuery,
  } = useSprintRequirementScope({ activeProjectId })

  const selectedSprintId = scope?.sprintId ?? resolvedSelectedSprintId
  const selectedRequirementId = scope?.requirementId ?? resolvedSelectedRequirementId

  const drawerRequirementsQuery = useQuery({
    queryKey: ['requirements', 'functionalSuiteDrawer', drawerSprintId],
    queryFn: () => api.getRequirements(drawerSprintId!),
    enabled: Boolean(drawerSprintId) && !editingSuite && !isRequirementLocked,
  })
  const drawerRequirementOptions = useMemo(
    () =>
      (drawerRequirementsQuery.data ?? []).map((requirement) => ({
        label: requirement.name,
        value: normalizeRequirementId(requirement),
      })),
    [drawerRequirementsQuery.data],
  )

  const sprintName = scope?.sprintName || sprintFilterOptions.find((item) => item.value === selectedSprintId)?.label || selectedSprintId || '-'
  const requirementName =
    scope?.requirementName ||
    requirementFilterOptions.find((item) => item.value === selectedRequirementId)?.label ||
    selectedRequirementId ||
    '-'

  const suitesQuery = useQuery({
    queryKey: ['functionTestSuites', selectedRequirementId],
    queryFn: () => api.getFunctionTestSuites(selectedRequirementId!),
    enabled: Boolean(selectedRequirementId),
  })
  const suites = useMemo(() => suitesQuery.data ?? [], [suitesQuery.data])
  const orderedSuites = useMemo(
    () =>
      [...suites].sort((left, right) => {
        const leftTime = new Date(pickCreatedAt(left) ?? '').getTime()
        const rightTime = new Date(pickCreatedAt(right) ?? '').getTime()
        return (Number.isNaN(leftTime) ? 0 : leftTime) - (Number.isNaN(rightTime) ? 0 : rightTime)
      }),
    [suites],
  )
  const pagedSuites = useMemo(
    () => orderedSuites.slice((page - 1) * pageSize, page * pageSize),
    [orderedSuites, page, pageSize],
  )

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(orderedSuites.length / pageSize))
    if (page > maxPage) setPage(maxPage)
  }, [orderedSuites.length, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [selectedRequirementId])

  function closeDrawer() {
    setDrawerOpen(false)
    setEditingSuite(null)
    setDrawerSprintId(undefined)
    form.resetFields()
  }

  function openCreateDrawer() {
    setEditingSuite(null)
    setDrawerSprintId(scope?.sprintId ?? resolvedSelectedSprintId)
    form.setFieldsValue({
      sprintId: scope?.sprintId ?? resolvedSelectedSprintId,
      requirementId: selectedRequirementId,
      name: '',
      description: '',
    })
    setDrawerOpen(true)
  }

  function openEditDrawer(suite: FunctionTestSuite) {
    setEditingSuite(suite)
    setDrawerSprintId(undefined)
    form.setFieldsValue({
      name: suite.name,
      description: suite.description,
    })
    setDrawerOpen(true)
  }

  const saveSuiteMutation = useMutation({
    mutationFn: (values: FunctionalTestSuiteFormValues) => {
      if (editingSuite) {
        const suiteId = normalizeFunctionTestSuiteId(editingSuite)
        if (!suiteId) throw new Error('未获取到功能测试集 ID')
        return api.updateFunctionTestSuite(suiteId, {
          name: values.name,
          description: values.description,
        })
      }

      const targetRequirementId = values.requirementId || selectedRequirementId
      if (!targetRequirementId) throw new Error('请选择所属需求')
      return api.createFunctionTestSuite(targetRequirementId, {
        name: values.name,
        description: values.description,
      })
    },
    onSuccess: (suite, values) => {
      const suiteId = normalizeFunctionTestSuiteId(suite)
      const nextRequirementId = suite.requirementId ?? values.requirementId ?? selectedRequirementId
      message.success(editingSuite ? '功能测试集已更新' : '功能测试集已创建')
      if (suiteId) {
        queryClient.setQueryData(['functionTestSuite', suiteId], suite)
      }
      if (nextRequirementId) {
        queryClient.invalidateQueries({ queryKey: ['functionTestSuites', nextRequirementId] })
      }
      queryClient.invalidateQueries({ queryKey: ['functionTestSuites'] })
      closeDrawer()
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const deleteSuiteMutation = useMutation({
    mutationFn: (suiteId: string) => api.deleteFunctionTestSuite(suiteId),
    onSuccess: () => {
      message.success('功能测试集已删除')
      queryClient.invalidateQueries({ queryKey: ['functionTestSuites', selectedRequirementId] })
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  function handleOpenSuite(suite: FunctionTestSuite) {
    const suiteId = normalizeFunctionTestSuiteId(suite)
    if (!suiteId) {
      message.error('未获取到功能测试集 ID')
      return
    }
    navigate(`/test-cases/suites/${suiteId}`)
  }

  return (
    <div className="workbench-page api-automation-page functional-test-page">
      <div className="api-automation-content">
        <section className="workbench-panel workbench-board-panel">
          <div className="panel-header api-panel-header">
            <div className="requirement-panel-head">
              <Text strong>功能测试集</Text>
              {!isRequirementLocked ? (
                <div className="api-filter-group">
                  <div className="api-filter-field">
                    <span className="api-filter-field-label">迭代</span>
                    <Select
                      className="api-filter-select business-filter-select"
                      value={selectedSprintId}
                      options={sprintFilterOptions}
                      loading={sprintsQuery.isLoading}
                      placeholder="请选择迭代"
                      onChange={selectSprint}
                    />
                  </div>
                  <div className="api-filter-field">
                    <span className="api-filter-field-label">需求</span>
                    <Select
                      className="api-filter-select business-filter-select"
                      value={selectedRequirementId}
                      options={requirementFilterOptions}
                      loading={requirementsQuery.isLoading}
                      placeholder="请选择需求"
                      disabled={!selectedSprintId}
                      onChange={selectRequirement}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <Space size={8}>
              <Button
                type="primary"
                className="action-btn-create"
                icon={<PlusOutlined />}
                disabled={!selectedRequirementId}
                onClick={openCreateDrawer}
              >
                新建测试集
              </Button>
            </Space>
          </div>

          {sprintsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(sprintsQuery.error)} /> : null}
          {requirementsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(requirementsQuery.error)} /> : null}
          {suitesQuery.error ? <Alert showIcon type="error" message={getErrorMessage(suitesQuery.error)} /> : null}

          {!activeProjectId ? (
            <div className="sprint-card-loading">
              <Empty description="请先选择项目" />
            </div>
          ) : !isRequirementLocked && !selectedSprintId ? (
            <div className="sprint-card-loading">
              <Empty description="当前项目下暂无迭代" />
            </div>
          ) : !selectedRequirementId ? (
            <div className="sprint-card-loading">
              <Empty description={isRequirementLocked ? '当前需求不可用' : '请选择一个需求后查看功能测试集'} />
            </div>
          ) : (
            <div className="table-body-scroll sprint-card-scroll functional-suite-scroll">
              {suitesQuery.isLoading ? (
                <div className="sprint-card-loading">
                  <Empty description="功能测试集加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
              ) : orderedSuites.length === 0 ? (
                <div className="sprint-card-loading">
                  <Empty
                    image={<AppstoreOutlined />}
                    description={
                      <Space direction="vertical" size={4}>
                        <Text strong>当前需求下还没有功能测试集</Text>
                        <Text type="secondary">先创建测试集，后续接口补齐后可进入详情管理用例与执行记录。</Text>
                      </Space>
                    }
                  >
                    <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} onClick={openCreateDrawer}>
                      新建测试集
                    </Button>
                  </Empty>
                </div>
              ) : (
                <div className="api-collection-grid functional-suite-grid">
                  {pagedSuites.map((suite) => {
                    const suiteId = normalizeFunctionTestSuiteId(suite)

                    return (
                      <Card
                        key={suiteId}
                        hoverable
                        className="sprint-card api-collection-card functional-suite-card"
                        bodyStyle={{ padding: 20 }}
                        onClick={() => handleOpenSuite(suite)}
                      >
                        <div className="api-collection-card-top">
                          <Space size={10}>
                            <Badge status="processing" />
                            <Text strong>{suite.name}</Text>
                          </Space>
                        </div>

                        <Paragraph className="api-collection-description" type="secondary">
                          {suite.description || '暂无功能测试集描述'}
                        </Paragraph>

                        <div className="sprint-card-meta api-collection-meta-inline">
                          <span className="sprint-card-label">所属迭代/需求</span>
                          <span className="api-collection-inline-value">
                            {sprintName}/{requirementName}
                          </span>
                        </div>

                        <div className="sprint-card-meta">
                          <span className="sprint-card-label">最近更新</span>
                          <span className="api-collection-inline-value">{formatTime(pickUpdatedAt(suite))}</span>
                        </div>

                        <div
                          className="sprint-card-actions"
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <Tooltip title="查看详情">
                            <Button
                              type="text"
                              shape="circle"
                              className="action-btn-read"
                              icon={<EyeOutlined />}
                              aria-label="查看功能测试集"
                              onClick={() => handleOpenSuite(suite)}
                            />
                          </Tooltip>
                          <Tooltip title="编辑">
                            <Button
                              type="text"
                              shape="circle"
                              className="action-btn-update"
                              icon={<EditOutlined />}
                              aria-label="编辑功能测试集"
                              onClick={() => openEditDrawer(suite)}
                            />
                          </Tooltip>
                          <Popconfirm title="确认删除该功能测试集？" onConfirm={() => deleteSuiteMutation.mutate(suiteId)}>
                            <Tooltip title="删除">
                              <Button
                                danger
                                type="text"
                                shape="circle"
                                className="action-btn-delete"
                                icon={<DeleteOutlined />}
                                aria-label="删除功能测试集"
                                loading={deleteSuiteMutation.isPending && deleteSuiteMutation.variables === suiteId}
                              />
                            </Tooltip>
                          </Popconfirm>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="table-footer">
            <Text type="secondary">{footerRange(orderedSuites.length, page, pageSize)}</Text>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={orderedSuites.length}
              showSizeChanger
              onChange={(nextPage, nextPageSize) => {
                setPage(nextPage)
                setPageSize(nextPageSize)
              }}
            />
          </div>
        </section>
      </div>

      <Drawer
        title={editingSuite ? '编辑功能测试集' : '新建功能测试集'}
        open={drawerOpen}
        onClose={closeDrawer}
        width={520}
        extra={
          <Button type="primary" className="action-btn-save" onClick={() => form.submit()}>
            {saveSuiteMutation.isPending ? '保存中...' : '保存'}
          </Button>
        }
      >
        {drawerRequirementsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(drawerRequirementsQuery.error)} /> : null}
        <Form<FunctionalTestSuiteFormValues> form={form} layout="vertical" requiredMark={false} onFinish={(values) => saveSuiteMutation.mutate(values)}>
          {!editingSuite && !isRequirementLocked ? (
            <>
              <Form.Item name="sprintId" label="所属迭代" rules={[{ required: true, message: '请选择所属迭代' }]}>
                <Select
                  placeholder="请选择迭代"
                  options={sprintFilterOptions}
                  onChange={(value) => {
                    setDrawerSprintId(value)
                    form.setFieldValue('requirementId', undefined)
                  }}
                />
              </Form.Item>
              <Form.Item name="requirementId" label="所属需求" rules={[{ required: true, message: '请选择所属需求' }]}>
                <Select
                  placeholder="请选择需求"
                  options={drawerRequirementOptions}
                  loading={drawerRequirementsQuery.isLoading}
                  disabled={!drawerSprintId || drawerRequirementOptions.length === 0}
                />
              </Form.Item>
            </>
          ) : null}
          <Form.Item name="name" label="测试集名称" rules={[{ required: true, message: '请输入测试集名称' }]}>
            <Input maxLength={120} placeholder="例如：登录主流程 / 订单核心链路" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={5} maxLength={512} placeholder="补充测试集目标、范围或备注" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
