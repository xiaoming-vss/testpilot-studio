import { AppstoreOutlined, DeleteOutlined, EditOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Badge, Button, Card, Empty, Form, Pagination, Popconfirm, Space, Tooltip, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_UI_TEST_SUITE_RUN_CONFIG, UiTestSuiteDrawer, type UiTestSuiteFormValues } from './EntityDrawers'
import { api, type UiTestSuite, type UiTestSuiteRunSummary } from '../services/api'
import { formatTime, getErrorMessage, normalizeUiTestSuiteId, pickCreatedAt, pickUpdatedAt } from '../utils/format'
import { buildUiTestSuiteUpdatePayload } from '../utils/updatePayload'

const { Paragraph, Text } = Typography

function formatSuiteViewport(suite: UiTestSuite) {
  if (!suite.viewportWidth || !suite.viewportHeight) return '-'
  return `${suite.viewportWidth} x ${suite.viewportHeight}`
}

function formatSuiteRunConfig(suite: UiTestSuite) {
  return `${suite.headless === undefined ? '未设置模式' : suite.headless ? '无头' : '可视'} / ${formatSuiteViewport(suite)} / ${
    suite.defaultStepTimeoutMs ? `${suite.defaultStepTimeoutMs}ms` : '未设置超时'
  }`
}

export type UiTestSuiteSectionRef = {
  openCreateDrawer: () => void
}

function footerRange(total: number, currentPage: number, currentPageSize: number) {
  if (total === 0) return '显示第 0 条 - 第 0 条，共 0 条'
  const start = (currentPage - 1) * currentPageSize + 1
  const end = Math.min(currentPage * currentPageSize, total)
  return `显示第 ${start} 条 - 第 ${end} 条，共 ${total} 条`
}

function isUiSuiteRunPollingStatus(status?: string) {
  return status === 'pending' || status === 'claimed' || status === 'running'
}

function getUiSuiteRunId(run?: UiTestSuiteRunSummary | null) {
  return run?.suiteRunId ?? ''
}

export const UiTestSuiteSection = forwardRef<
  UiTestSuiteSectionRef,
  {
    requirementId: string
    selectedSprintId?: string
    sprintOptions?: Array<{ label: string; value: string }>
    requirementOptions?: Array<{ label: string; value: string }>
    onCreateSprintChange?: (value?: string) => void
    showInlineCreateButton?: boolean
  }
>(function UiTestSuiteSection(
  {
    requirementId,
    selectedSprintId,
    sprintOptions,
    requirementOptions,
    onCreateSprintChange,
    showInlineCreateButton = true,
  },
  ref,
) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingSuite, setEditingSuite] = useState<UiTestSuite | null>(null)
  const [form] = Form.useForm<UiTestSuiteFormValues>()

  const suitesQuery = useQuery({
    queryKey: ['uiTestSuites', requirementId],
    queryFn: () => api.getUiTestSuites(requirementId),
    enabled: Boolean(requirementId),
  })
  const suites = suitesQuery.data ?? []
  const sprintName = sprintOptions?.find((item) => item.value === selectedSprintId)?.label || selectedSprintId || '-'
  const requirementName = requirementOptions?.find((item) => item.value === requirementId)?.label || requirementId || '-'

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

  const saveSuiteMutation = useMutation({
    mutationFn: (values: UiTestSuiteFormValues) => {
      const suiteId = editingSuite ? normalizeUiTestSuiteId(editingSuite) : ''
      if (suiteId && editingSuite) {
        return api.updateUiTestSuite(suiteId, buildUiTestSuiteUpdatePayload(editingSuite, values))
      }
      const targetRequirementId = values.requirementId || requirementId
      if (!targetRequirementId) throw new Error('请选择所属需求')
      return api.createUiTestSuite(targetRequirementId, {
        name: values.name,
        description: values.description,
        ...(values.headless !== undefined ? { headless: values.headless } : {}),
        ...(values.slowMoMs !== undefined ? { slowMoMs: values.slowMoMs } : {}),
        ...(values.viewportWidth !== undefined ? { viewportWidth: values.viewportWidth } : {}),
        ...(values.viewportHeight !== undefined ? { viewportHeight: values.viewportHeight } : {}),
        ...(values.defaultStepTimeoutMs !== undefined ? { defaultStepTimeoutMs: values.defaultStepTimeoutMs } : {}),
      })
    },
    onSuccess: (suite) => {
      const suiteId = normalizeUiTestSuiteId(suite)
      const nextRequirementId = suite.requirementId ?? suite.requirement_id ?? requirementId
      message.success(editingSuite ? 'UI测试集已更新' : 'UI测试集已创建')
      setDrawerOpen(false)
      setEditingSuite(null)
      form.resetFields()
      if (suiteId) {
        queryClient.setQueryData(['uiTestSuite', suiteId], suite)
      }
      queryClient.invalidateQueries({ queryKey: ['uiTestSuites', nextRequirementId] })
      queryClient.invalidateQueries({ queryKey: ['uiTestSuites'] })
    },
  })

  const deleteSuiteMutation = useMutation({
    mutationFn: (suiteId: string) => api.deleteUiTestSuite(suiteId),
    onSuccess: () => {
      message.success('UI测试集已删除')
      queryClient.invalidateQueries({ queryKey: ['uiTestSuites', requirementId] })
    },
  })

  const runSuiteMutation = useMutation({
    mutationFn: (suiteId: string) => api.runUiTestSuite(suiteId),
    onSuccess: (runRecord, suiteId) => {
      const suiteRunId = getUiSuiteRunId(runRecord)
      if (!suiteRunId) {
        message.error('未获取到运行记录 ID')
        return
      }

      queryClient.setQueryData<UiTestSuiteRunSummary[]>(['uiTestSuiteRuns', suiteId], (current) => {
        const currentItems = current ?? []
        return [runRecord, ...currentItems.filter((item) => item.suiteRunId !== suiteRunId)]
      })

      message.success(isUiSuiteRunPollingStatus(runRecord.status) ? '已开始运行测试集' : '测试集运行记录已创建')
      navigate(`/ui-automation/suites/${suiteId}?suiteRunId=${suiteRunId}`)
    },
  })

  function openCreateDrawer() {
    setEditingSuite(null)
    form.setFieldsValue({
      sprintId: selectedSprintId,
      requirementId,
      name: '',
      description: '',
      ...DEFAULT_UI_TEST_SUITE_RUN_CONFIG,
    })
    setDrawerOpen(true)
  }

  function openEditDrawer(suite: UiTestSuite) {
    setEditingSuite(suite)
    form.setFieldsValue({
      name: suite.name,
      description: suite.description,
      headless: suite.headless ?? DEFAULT_UI_TEST_SUITE_RUN_CONFIG.headless,
      slowMoMs: suite.slowMoMs ?? DEFAULT_UI_TEST_SUITE_RUN_CONFIG.slowMoMs,
      viewportWidth: suite.viewportWidth ?? DEFAULT_UI_TEST_SUITE_RUN_CONFIG.viewportWidth,
      viewportHeight: suite.viewportHeight ?? DEFAULT_UI_TEST_SUITE_RUN_CONFIG.viewportHeight,
      defaultStepTimeoutMs: suite.defaultStepTimeoutMs ?? DEFAULT_UI_TEST_SUITE_RUN_CONFIG.defaultStepTimeoutMs,
    })
    setDrawerOpen(true)
  }

  function openSuiteCasePage(suiteId: string) {
    navigate(`/ui-automation/suites/${suiteId}`)
  }

  useImperativeHandle(
    ref,
    () => ({
      openCreateDrawer,
    }),
    [],
  )
  return (
    <div className="ui-test-suite-section">
      {showInlineCreateButton ? (
        <div className="ui-test-suite-toolbar">
          <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} onClick={openCreateDrawer}>
            新建测试集
          </Button>
        </div>
      ) : null}

      {suitesQuery.error ? <Alert showIcon type="error" message={getErrorMessage(suitesQuery.error)} /> : null}

      <div className="table-body-scroll sprint-card-scroll ui-test-suite-scroll">
        {suitesQuery.isLoading ? (
          <div className="sprint-card-loading">
            <Empty description="UI测试集加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : orderedSuites.length === 0 ? (
          <div className="sprint-card-loading">
            <Empty
              image={<AppstoreOutlined />}
              description={
                <Space direction="vertical" size={4}>
                  <Text strong>当前需求下还没有 UI测试集</Text>
                  <Text type="secondary">支持创建测试集，并进入详情管理用例、步骤与正式运行报告。</Text>
                </Space>
              }
            >
              <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} onClick={openCreateDrawer}>
                新建测试集
              </Button>
            </Empty>
          </div>
        ) : (
          <div className="api-collection-grid ui-test-suite-grid">
            {pagedSuites.map((suite) => {
              const suiteId = normalizeUiTestSuiteId(suite)

              return (
                <Card
                  key={suiteId}
                  hoverable
                  className="sprint-card api-collection-card ui-test-suite-card"
                  bodyStyle={{ padding: 20 }}
                  onClick={() => openSuiteCasePage(suiteId)}
                >
                  <div className="api-collection-card-top">
                    <Space size={10}>
                      <Badge status="processing" />
                      <Text strong>{suite.name}</Text>
                    </Space>
                  </div>

                  <Paragraph className="api-collection-description" type="secondary">
                    {suite.description || '暂无测试集描述'}
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

                  <div className="sprint-card-meta">
                    <span className="sprint-card-label">运行配置</span>
                    <span className="api-collection-inline-value">{formatSuiteRunConfig(suite)}</span>
                  </div>

                  <div
                    className="sprint-card-actions"
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <Tooltip title="运行测试集">
                      <Button
                        type="text"
                        shape="circle"
                        className="action-btn-read"
                        icon={<PlayCircleOutlined />}
                        aria-label="运行 UI测试集"
                        loading={runSuiteMutation.isPending && runSuiteMutation.variables === suiteId}
                        onClick={() => runSuiteMutation.mutate(suiteId)}
                      />
                    </Tooltip>
                    <Tooltip title="编辑">
                      <Button
                        type="text"
                        shape="circle"
                        className="action-btn-update"
                        icon={<EditOutlined />}
                        aria-label="编辑 UI测试集"
                        onClick={() => openEditDrawer(suite)}
                      />
                    </Tooltip>
                    <Popconfirm title="确认删除该 UI测试集？" onConfirm={() => deleteSuiteMutation.mutate(suiteId)}>
                      <Tooltip title="删除">
                        <Button
                          danger
                          type="text"
                          shape="circle"
                          className="action-btn-delete"
                          icon={<DeleteOutlined />}
                          aria-label="删除 UI测试集"
                          loading={deleteSuiteMutation.isPending}
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

      <UiTestSuiteDrawer
        title={editingSuite ? '编辑 UI测试集' : '新建 UI测试集'}
        open={drawerOpen}
        form={form}
        loading={saveSuiteMutation.isPending}
        error={saveSuiteMutation.error}
        onClose={() => {
          setDrawerOpen(false)
          setEditingSuite(null)
          form.resetFields()
        }}
        sprintOptions={editingSuite ? undefined : sprintOptions}
        requirementOptions={editingSuite ? undefined : requirementOptions}
        onSprintChange={
          editingSuite
            ? undefined
            : (value) => {
                form.setFieldValue('requirementId', undefined)
                onCreateSprintChange?.(value)
              }
        }
        onFinish={(values) => saveSuiteMutation.mutate(values)}
      />
    </div>
  )
})
