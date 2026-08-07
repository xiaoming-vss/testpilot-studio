import { AppstoreOutlined, DeleteOutlined, EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, Button, Drawer, Empty, Form, Input, InputNumber, Modal, Pagination, Popconfirm, Progress, Select, Space, Table, Tooltip, Typography } from 'antd'
import type { TableProps } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProjectRequirements } from '@/features/projects/hooks/useProjectRequirements'
import { useSprintRequirementScope } from '@/features/projects/hooks/useSprintRequirementScope'
import { useWorkbenchStore } from '@/features/projects/store/workbench.store'
import { useTestCasePageStore } from '@/features/test-cases/store/testCasePage.store'
import { api, listItems, type FunctionTestSuite, type Requirement } from '@/services/api'
import { message } from '@/shared/utils/feedback'
import {
  formatTime,
  getErrorMessage,
  normalizeFunctionTestSuiteId,
  normalizeRequirementId,
  normalizeSprintId,
  pickCreatedAt,
  pickUpdatedAt,
} from '@/utils/format'

const { Text } = Typography

type FunctionalTestSuiteFormValues = {
  sprintId?: string
  requirementId?: string
  name: string
  description?: string
}

type ZentaoImportFormValues = {
  productId: number
  moduleId?: number
}

type RequirementZentaoImportResult = {
  importedCaseCount: number
  successSuiteCount: number
  skippedSuiteCount: number
}

type RequirementImportProgress = {
  completedSuiteCount: number
  totalSuiteCount: number
  currentSuiteIndex: number
  currentSuiteId?: string
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
  const [searchParams, setSearchParams] = useSearchParams()
  const workbenchActiveProjectId = useWorkbenchStore((state) => state.activeProjectId)
  const functionalSelectionsByProject = useTestCasePageStore((state) => state.functionalSelectionsByProject)
  const updateFunctionalSelection = useTestCasePageStore((state) => state.updateFunctionalSelection)
  const activeProjectId = scope?.projectId ?? workbenchActiveProjectId
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSprintId, setDrawerSprintId] = useState<string | undefined>(undefined)
  const [editingSuite, setEditingSuite] = useState<FunctionTestSuite | null>(null)
  const [form] = Form.useForm<FunctionalTestSuiteFormValues>()
  const [zentaoImportSuite, setZentaoImportSuite] = useState<FunctionTestSuite | null>(null)
  const [zentaoImportForm] = Form.useForm<ZentaoImportFormValues>()
  const [requirementZentaoImportOpen, setRequirementZentaoImportOpen] = useState(false)
  const [requirementZentaoImportForm] = Form.useForm<ZentaoImportFormValues>()
  const [requirementImportProgress, setRequirementImportProgress] = useState<RequirementImportProgress | null>(null)
  const isRequirementLocked = Boolean(scope?.requirementId)

  const functionalSprintParam = searchParams.get('functionalSprintId')
  const functionalRequirementParam = searchParams.get('functionalRequirementId')
  const storedFunctionalSelection = activeProjectId ? functionalSelectionsByProject[activeProjectId] : undefined
  const initialFunctionalSprintId =
    functionalSprintParam !== null
      ? functionalSprintParam === 'all'
        ? null
        : functionalSprintParam
      : storedFunctionalSelection?.sprintId
  const initialFunctionalRequirementId =
    functionalRequirementParam !== null
      ? functionalRequirementParam === 'all'
        ? null
        : functionalRequirementParam
      : storedFunctionalSelection?.requirementId

  const {
    currentRequirementSelection,
    currentSprintSelection,
    requirementFilterOptions,
    requirementsQuery,
    resolvedSelectedRequirementId,
    resolvedSelectedSprintId,
    selectRequirement,
    selectSprint,
    sprintFilterOptions,
    sprints,
    sprintsQuery,
  } = useSprintRequirementScope({
    activeProjectId,
    includeAllRequirementOption: true,
    includeAllSprintOption: true,
    defaultToAllWhenIncluded: true,
    initialRequirementId: initialFunctionalRequirementId,
    initialSprintId: initialFunctionalSprintId,
  })

  const selectedSprintId = scope?.sprintId ?? resolvedSelectedSprintId
  const selectedRequirementId = scope?.requirementId ?? resolvedSelectedRequirementId
  const drawerSprintOptions = useMemo(
    () => sprints.map((sprint) => ({ label: sprint.name, value: normalizeSprintId(sprint) })),
    [sprints],
  )

  const { allRequirements, allRequirementsQuery, requirementNameMap, requirementSprintMap, sprintNameMap } =
    useProjectRequirements({
      activeProjectId,
      enabled: !sprintsQuery.isLoading && !isRequirementLocked,
      sprints,
    })

  const drawerRequirementsQuery = useQuery({
    queryKey: ['requirements', 'functionalSuiteDrawer', drawerSprintId],
    queryFn: () => api.getRequirements(drawerSprintId!),
    enabled: Boolean(drawerSprintId) && !editingSuite && !isRequirementLocked,
  })
  const drawerRequirementOptions = useMemo(
    () =>
      listItems(drawerRequirementsQuery.data).map((requirement) => ({
        label: requirement.name,
        value: normalizeRequirementId(requirement),
      })),
    [drawerRequirementsQuery.data],
  )

  const displayRequirementFilterOptions = useMemo(() => {
    if (selectedSprintId) return requirementFilterOptions
    return [
      { label: '全部需求', value: 'all' },
      ...allRequirements.map((requirement) => ({
        label: requirement.name,
        value: normalizeRequirementId(requirement),
      })),
    ]
  }, [allRequirements, requirementFilterOptions, selectedSprintId])

  const suitesQuery = useQuery({
    queryKey: [
      'functionTestSuites',
      activeProjectId,
      selectedSprintId,
      selectedRequirementId,
      allRequirements.map(normalizeRequirementId).join(','),
    ],
    queryFn: async () => {
      if (selectedRequirementId) {
        const suites = await api.getFunctionTestSuites(selectedRequirementId)
        return suites.map((suite) => ({
          ...suite,
          requirementId: suite.requirementId ?? suite.requirement_id ?? selectedRequirementId,
        }))
      }

      const targetRequirements: Requirement[] = selectedSprintId
        ? allRequirements.filter((item) => (item.sprintId ?? item.sprint_id) === selectedSprintId)
        : allRequirements

      if (targetRequirements.length === 0) return []

      const suiteGroups = await Promise.all(
        targetRequirements.map(async (requirement) => {
          const requirementId = normalizeRequirementId(requirement)
          const suites = await api.getFunctionTestSuites(requirementId)
          return suites.map((suite) => ({
            ...suite,
            requirementId: suite.requirementId ?? suite.requirement_id ?? requirementId,
          }))
        }),
      )

      return suiteGroups.flat()
    },
    enabled: Boolean(activeProjectId) && !sprintsQuery.isLoading && !allRequirementsQuery.isLoading,
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
  const requirementImportableSuiteIds = useMemo(
    () => orderedSuites.map((suite) => normalizeFunctionTestSuiteId(suite)).filter((value): value is string => Boolean(value)),
    [orderedSuites],
  )
  const requirementImportProgressPercent = useMemo(() => {
    if (!requirementImportProgress || requirementImportProgress.totalSuiteCount === 0) return 0
    return Math.round((requirementImportProgress.completedSuiteCount / requirementImportProgress.totalSuiteCount) * 100)
  }, [requirementImportProgress])
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
  }, [selectedRequirementId, selectedSprintId])

  useEffect(() => {
    if (scope?.requirementId) return
    if (!activeProjectId) return

    updateFunctionalSelection(activeProjectId, {
      sprintId: currentSprintSelection === null ? null : selectedSprintId ?? null,
      requirementId: currentRequirementSelection === null ? null : selectedRequirementId ?? null,
    })

    const nextSearchParams = new URLSearchParams(searchParams)
    const nextSprintParam = currentSprintSelection === null ? 'all' : selectedSprintId ?? 'all'
    const nextRequirementParam = currentRequirementSelection === null ? 'all' : selectedRequirementId ?? 'all'
    const prevSprintParam = searchParams.get('functionalSprintId')
    const prevRequirementParam = searchParams.get('functionalRequirementId')

    if (
      searchParams.get('tab') === 'functional' &&
      prevSprintParam === nextSprintParam &&
      prevRequirementParam === nextRequirementParam
    ) {
      return
    }

    nextSearchParams.set('tab', 'functional')
    nextSearchParams.set('functionalSprintId', nextSprintParam)
    nextSearchParams.set('functionalRequirementId', nextRequirementParam)
    setSearchParams(nextSearchParams, { replace: true })
  }, [
    activeProjectId,
    currentRequirementSelection,
    currentSprintSelection,
    scope?.requirementId,
    searchParams,
    selectedRequirementId,
    selectedSprintId,
    setSearchParams,
    updateFunctionalSelection,
  ])

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

  function openZentaoImportModal(suite: FunctionTestSuite) {
    zentaoImportForm.setFieldsValue({
      productId: 1,
      moduleId: 0,
    })
    setZentaoImportSuite(suite)
  }

  function closeZentaoImportModal() {
    if (importZentaoTestCasesMutation.isPending) return
    setZentaoImportSuite(null)
  }

  function openRequirementZentaoImportModal() {
    requirementZentaoImportForm.setFieldsValue({
      productId: 1,
      moduleId: 0,
    })
    setRequirementImportProgress(null)
    setRequirementZentaoImportOpen(true)
  }

  function closeRequirementZentaoImportModal() {
    if (importRequirementZentaoTestCasesMutation.isPending) return
    setRequirementZentaoImportOpen(false)
    setRequirementImportProgress(null)
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

  const importZentaoTestCasesMutation = useMutation({
    mutationFn: async (values: ZentaoImportFormValues) => {
      const suiteId = zentaoImportSuite ? normalizeFunctionTestSuiteId(zentaoImportSuite) : ''
      if (!suiteId) throw new Error('未获取到功能测试集 ID')

      const response = await api.getFunctionTestCases(suiteId)
      const caseIds = response.items.map((item) => item.caseId).filter((value): value is string => Boolean(value))
      if (caseIds.length === 0) throw new Error('当前测试集还没有可导入的用例')

      return api.importFunctionTestCasesToZentao(suiteId, {
        productId: values.productId,
        moduleId: values.moduleId ?? 0,
        caseIds,
      })
    },
    onSuccess: (result) => {
      const importedCount = result.importedCaseCount ?? result.imported_case_count ?? result.items?.length ?? 0
      message.success(`已导入禅道：${importedCount} 条用例`)
      setZentaoImportSuite(null)
      zentaoImportForm.resetFields()
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const importRequirementZentaoTestCasesMutation = useMutation({
    mutationFn: async (values: ZentaoImportFormValues): Promise<RequirementZentaoImportResult> => {
      const requirementId = scope?.requirementId ?? selectedRequirementId
      if (!requirementId) throw new Error('未获取到需求 ID')
      if (requirementImportableSuiteIds.length === 0) throw new Error('当前需求下还没有可导入的测试集')

      let importedCaseCount = 0
      let successSuiteCount = 0
      let skippedSuiteCount = 0
      const totalSuiteCount = requirementImportableSuiteIds.length

      setRequirementImportProgress({
        completedSuiteCount: 0,
        totalSuiteCount,
        currentSuiteIndex: 1,
        currentSuiteId: requirementImportableSuiteIds[0],
      })

      for (const [index, suiteId] of requirementImportableSuiteIds.entries()) {
        setRequirementImportProgress({
          completedSuiteCount: index,
          totalSuiteCount,
          currentSuiteIndex: index + 1,
          currentSuiteId: suiteId,
        })

        const response = await api.getFunctionTestCases(suiteId)
        const caseIds = [...new Set(response.items.map((item) => item.caseId).filter((value): value is string => Boolean(value)))]
        if (caseIds.length === 0) {
          skippedSuiteCount += 1
          setRequirementImportProgress({
            completedSuiteCount: index + 1,
            totalSuiteCount,
            currentSuiteIndex: index + 1,
            currentSuiteId: suiteId,
          })
          continue
        }

        const result = await api.importFunctionTestCasesToZentao(suiteId, {
          productId: values.productId,
          moduleId: values.moduleId ?? 0,
          caseIds,
        })
        importedCaseCount += result.importedCaseCount ?? result.imported_case_count ?? result.items?.length ?? 0
        successSuiteCount += 1
        setRequirementImportProgress({
          completedSuiteCount: index + 1,
          totalSuiteCount,
          currentSuiteIndex: index + 1,
          currentSuiteId: suiteId,
        })
      }

      if (successSuiteCount === 0) throw new Error('当前需求下没有可导入的用例')

      return {
        importedCaseCount,
        successSuiteCount,
        skippedSuiteCount,
      }
    },
    onSuccess: (result) => {
      message.success(`已导入当前需求到禅道：${result.importedCaseCount} 条用例，涉及 ${result.successSuiteCount} 个测试集`)
      setRequirementZentaoImportOpen(false)
      requirementZentaoImportForm.resetFields()
      setRequirementImportProgress(null)
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
      setRequirementImportProgress(null)
    },
  })

  function handleOpenSuite(suite: FunctionTestSuite) {
    const suiteId = normalizeFunctionTestSuiteId(suite)
    if (!suiteId) {
      message.error('未获取到功能测试集 ID')
      return
    }
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('tab', 'functional')
    navigate(`/test-cases/suites/${suiteId}?${nextSearchParams.toString()}`)
  }

  function getSuiteRowContext(suite: FunctionTestSuite) {
    const suiteId = normalizeFunctionTestSuiteId(suite) ?? ''
    const requirementId = suite.requirementId ?? suite.requirement_id
    const suiteRequirementName = scope?.requirementName || (requirementId ? requirementNameMap.get(requirementId) ?? requirementId : '-')
    const sprintIdForSuite = scope?.sprintId ?? (requirementId ? requirementSprintMap.get(requirementId) : undefined)
    const suiteSprintName = scope?.sprintName || (sprintIdForSuite ? sprintNameMap.get(sprintIdForSuite) ?? sprintIdForSuite : '-')
    const suiteDescription = suite.description || '暂无功能测试集描述'
    const suiteScopeText = `${suiteSprintName} / ${suiteRequirementName}`

    return { suiteDescription, suiteId, suiteScopeText }
  }

  const columns: TableProps<FunctionTestSuite>['columns'] = [
    {
      title: '测试集名称',
      dataIndex: 'name',
      key: 'name',
      width: '30%',
      render: (name: FunctionTestSuite['name']) => (
        <Space size={0} className="functional-suite-list-name">
          <Tooltip title={name}>
            <Text ellipsis>{name}</Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '所属迭代/需求',
      key: 'scope',
      ellipsis: true,
      render: (_, suite) => {
        const { suiteScopeText } = getSuiteRowContext(suite)
        return (
          <Tooltip title={suiteScopeText}>
            <Text className="functional-suite-list-scope" ellipsis>
              {suiteScopeText}
            </Text>
          </Tooltip>
        )
      },
    },
    {
      title: '创建时间',
      key: 'createdAt',
      width: 180,
      render: (_, suite) => <Text type="secondary">{formatTime(pickCreatedAt(suite))}</Text>,
    },
    {
      title: '最近更新',
      key: 'updatedAt',
      width: 180,
      render: (_, suite) => <Text type="secondary">{formatTime(pickUpdatedAt(suite))}</Text>,
    },
    {
      title: '描述',
      key: 'description',
      ellipsis: true,
      render: (_, suite) => {
        const { suiteDescription } = getSuiteRowContext(suite)
        return (
          <Tooltip title={suiteDescription}>
            <Text className="functional-suite-list-description" type="secondary" ellipsis>
              {suiteDescription}
            </Text>
          </Tooltip>
        )
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 138,
      align: 'right',
      render: (_, suite) => {
        const { suiteId } = getSuiteRowContext(suite)
        return (
          <Space
            size={8}
            className="functional-suite-list-actions"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Tooltip title="导入禅道">
              <Button
                type="text"
                shape="circle"
                className="action-btn-update"
                icon={<UploadOutlined />}
                aria-label="导入禅道"
                onClick={() => openZentaoImportModal(suite)}
              />
            </Tooltip>
            <Tooltip title="编辑测试集">
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
              <Tooltip title="删除测试集">
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
          </Space>
        )
      },
    },
  ]

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
                      value={currentSprintSelection === null ? 'all' : selectedSprintId ?? 'all'}
                      options={sprintFilterOptions}
                      loading={sprintsQuery.isLoading}
                      placeholder="请选择迭代"
                      onChange={(value: string) => {
                        selectSprint(value === 'all' ? null : value)
                        if (value === 'all') {
                          selectRequirement(null)
                        }
                        setPage(1)
                      }}
                    />
                  </div>
                  <div className="api-filter-field">
                    <span className="api-filter-field-label">需求</span>
                    <Select
                      className="api-filter-select business-filter-select"
                      value={currentRequirementSelection === null ? 'all' : selectedRequirementId ?? 'all'}
                      options={displayRequirementFilterOptions}
                      loading={requirementsQuery.isLoading || allRequirementsQuery.isLoading}
                      placeholder="请选择需求"
                      disabled={!selectedSprintId && allRequirements.length === 0}
                      onChange={(value: string) => {
                        selectRequirement(value === 'all' ? null : value)
                        setPage(1)
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <Space size={8}>

              {isRequirementLocked ? (
                <Button
                  className="action-btn-update"
                  icon={<UploadOutlined />}
                  disabled={orderedSuites.length === 0 || requirementImportableSuiteIds.length === 0}
                  onClick={openRequirementZentaoImportModal}
                >
                  导入禅道
                </Button>
              ) : null}
              <Button
                type="primary"
                className="action-btn-create"
                icon={<PlusOutlined />}
                disabled={!activeProjectId || sprints.length === 0}
                onClick={openCreateDrawer}
              >
                新建测试集
              </Button>
            </Space>
          </div>

          {sprintsQuery.error ? <Alert showIcon type="error" title={getErrorMessage(sprintsQuery.error)} /> : null}
          {requirementsQuery.error ? <Alert showIcon type="error" title={getErrorMessage(requirementsQuery.error)} /> : null}
          {allRequirementsQuery.error ? <Alert showIcon type="error" title={getErrorMessage(allRequirementsQuery.error)} /> : null}
          {suitesQuery.error ? <Alert showIcon type="error" title={getErrorMessage(suitesQuery.error)} /> : null}

          {!activeProjectId ? (
            <div className="sprint-card-loading">
              <Empty description="请先选择项目" />
            </div>
          ) : !isRequirementLocked && !sprintsQuery.isLoading && sprints.length === 0 ? (
            <div className="sprint-card-loading">
              <Empty description="当前项目下暂无迭代" />
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
                      <Space orientation="vertical" size={4}>
                        <Text strong>当前需求下还没有功能测试集</Text>
                        <Text type="secondary">先创建测试集，后续接口补齐后可进入详情管理用例与执行记录。</Text>
                      </Space>
                    }
                  >
                    <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} disabled={!activeProjectId || sprints.length === 0} onClick={openCreateDrawer}>
                      新建测试集
                    </Button>
                  </Empty>
                </div>
              ) : (
                <Table<FunctionTestSuite>
                  className="functional-suite-list-table"
                  columns={columns}
                  dataSource={pagedSuites}
                  rowKey={(suite) => normalizeFunctionTestSuiteId(suite) ?? suite.name}
                  pagination={false}
                  onRow={(suite) => ({
                    onClick: () => handleOpenSuite(suite),
                  })}
                />
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
              pageSizeOptions={['10', '20', '30', '50']}
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
        size={520}
        extra={
          <Button type="primary" className="action-btn-save" onClick={() => form.submit()}>
            {saveSuiteMutation.isPending ? '保存中...' : '保存'}
          </Button>
        }
      >
        {drawerRequirementsQuery.error ? <Alert showIcon type="error" title={getErrorMessage(drawerRequirementsQuery.error)} /> : null}
        <Form<FunctionalTestSuiteFormValues> form={form} layout="vertical" requiredMark={false} onFinish={(values) => saveSuiteMutation.mutate(values)}>
          {!editingSuite && !isRequirementLocked ? (
            <>
              <Form.Item name="sprintId" label="所属迭代" rules={[{ required: true, message: '请选择所属迭代' }]}>
                <Select
                  placeholder="请选择迭代"
                  options={drawerSprintOptions}
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

      <Modal
        open={Boolean(zentaoImportSuite)}
        title="导入到禅道"
        okText={importZentaoTestCasesMutation.isPending ? '导入中...' : '开始导入'}
        cancelText="取消"
        confirmLoading={importZentaoTestCasesMutation.isPending}
        onCancel={closeZentaoImportModal}
        onOk={async () => {
          const values = await zentaoImportForm.validateFields()
          importZentaoTestCasesMutation.mutate(values)
        }}
      >
        <Form<ZentaoImportFormValues> form={zentaoImportForm} layout="vertical" requiredMark={false}>
          <Form.Item
            name="productId"
            label="禅道产品 ID"
            rules={[{ required: true, message: '请输入禅道产品 ID' }]}
          >
            <InputNumber min={1} precision={0} placeholder="例如：1" />
          </Form.Item>
          <Form.Item name="moduleId" label="禅道模块 ID">
            <InputNumber min={0} precision={0} placeholder="默认 0" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={requirementZentaoImportOpen}
        title="导入当前需求到禅道"
        okText={importRequirementZentaoTestCasesMutation.isPending ? '导入中...' : '开始导入'}
        cancelText="取消"
        confirmLoading={importRequirementZentaoTestCasesMutation.isPending}
        onCancel={closeRequirementZentaoImportModal}
        onOk={async () => {
          const values = await requirementZentaoImportForm.validateFields()
          importRequirementZentaoTestCasesMutation.mutate(values)
        }}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            title={`将按测试集逐个导入当前需求“${scope?.requirementName ?? selectedRequirementId ?? '-'}”下的所有用例`}
            description={`当前共 ${orderedSuites.length} 个测试集，可用于导入的测试集 ${requirementImportableSuiteIds.length} 个。`}
          />
          {requirementImportProgress ? (
            <div>
              <Progress percent={requirementImportProgressPercent} status="active" />
              <Text type="secondary">
                当前进度：{requirementImportProgress.completedSuiteCount}/{requirementImportProgress.totalSuiteCount}
                {requirementImportProgress.currentSuiteId ? `，正在导入第 ${requirementImportProgress.currentSuiteIndex} 个测试集` : ''}
              </Text>
            </div>
          ) : null}
          <Form<ZentaoImportFormValues> form={requirementZentaoImportForm} layout="vertical" requiredMark={false}>
            <Form.Item
              name="productId"
              label="禅道产品 ID"
              rules={[{ required: true, message: '请输入禅道产品 ID' }]}
            >
              <InputNumber min={1} precision={0} placeholder="例如：1" />
            </Form.Item>
            <Form.Item name="moduleId" label="禅道模块 ID">
              <InputNumber min={0} precision={0} placeholder="默认 0" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </div>
  )
}
