import { CaretRightOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { Alert, Badge, Button, Card, Empty, Form, Pagination, Popconfirm, Select, Space, Tooltip, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiEnvironmentDrawer } from '@/features/api-automation/components/ApiEnvironmentDrawer'
import { CollectionDrawer, type CollectionFormValues } from '@/features/api-automation/components/CollectionDrawer'
import { useSprintRequirementScope } from '@/features/projects/hooks/useSprintRequirementScope'
import { api, type ApiCollection, type ApiEnvironment, type Requirement } from '@/services/api'
import { useWorkbenchStore } from '@/store/workbench'
import {
  formatTime,
  getErrorMessage,
  normalizeEnvironmentId,
  normalizeRequirementId,
  normalizeSprintId,
  pickUpdatedAt,
} from '@/utils/format'
import { buildApiCollectionUpdatePayload } from '@/utils/updatePayload'

const { Paragraph, Text } = Typography

export function ApiAutomationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const activeProjectId = useWorkbenchStore((state) => state.activeProjectId)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSprintId, setDrawerSprintId] = useState<string | undefined>(undefined)
  const [editingCollection, setEditingCollection] = useState<ApiCollection | null>(null)
  const [environmentDrawerOpen, setEnvironmentDrawerOpen] = useState(false)
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | undefined>(undefined)
  const [runningCollectionId, setRunningCollectionId] = useState('')
  const [drawerForm] = Form.useForm<CollectionFormValues>()

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
  })

  const allRequirementsQuery = useQuery({
    queryKey: ['requirementsPoolForCollections', activeProjectId, sprints.map(normalizeSprintId).join(',')],
    queryFn: async () => {
      if (sprints.length === 0) return []
      const requirementGroups = await Promise.all(sprints.map((sprint) => api.getRequirements(normalizeSprintId(sprint))))
      return requirementGroups.flat()
    },
    enabled: Boolean(activeProjectId) && !sprintsQuery.isLoading,
  })
  const allRequirements = useMemo(() => allRequirementsQuery.data ?? [], [allRequirementsQuery.data])

  const collectionsQuery = useQuery({
    queryKey: [
      'apiCollections',
      activeProjectId,
      resolvedSelectedSprintId,
      resolvedSelectedRequirementId,
      sprints.map(normalizeSprintId).join(','),
    ],
    queryFn: async () => {
      const targetRequirements: Requirement[] = resolvedSelectedRequirementId
        ? (() => {
            const target = allRequirements.find((item) => normalizeRequirementId(item) === resolvedSelectedRequirementId)
            return target ? [target] : []
          })()
        : resolvedSelectedSprintId
          ? await api.getRequirements(resolvedSelectedSprintId)
          : sprints.length === 0
            ? []
            : (await Promise.all(sprints.map((sprint) => api.getRequirements(normalizeSprintId(sprint))))).flat()

      if (targetRequirements.length === 0) return []

      const collectionGroups = await Promise.all(
        targetRequirements.map(async (requirement) => {
          const requirementId = normalizeRequirementId(requirement)
          const collections = await api.getApiCollections(requirementId)
          return collections.map((collection) => ({
            ...collection,
            requirementId: collection.requirementId ?? collection.requirement_id ?? requirementId,
          }))
        }),
      )

      return collectionGroups.flat()
    },
    enabled: Boolean(activeProjectId) && !sprintsQuery.isLoading,
  })
  const collections = useMemo(() => collectionsQuery.data ?? [], [collectionsQuery.data])

  const environmentsQuery = useQuery({
    queryKey: ['apiEnvironments', activeProjectId],
    queryFn: () => api.getApiEnvironments(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })
  const environments = environmentsQuery.data ?? []
  const selectedEnvironment =
    environments.find((environment) => normalizeEnvironmentId(environment) === selectedEnvironmentId) ??
    environments.find((environment) => environment.isDefault) ??
    environments[0]
  const resolvedEnvironmentId = selectedEnvironment ? normalizeEnvironmentId(selectedEnvironment) : undefined

  const environmentVarsQuery = useQuery({
    queryKey: ['apiEnvironmentVars', resolvedEnvironmentId],
    queryFn: () => api.getApiEnvironmentVars(resolvedEnvironmentId!),
    enabled: Boolean(resolvedEnvironmentId),
  })

  const drawerSprintOptions = useMemo(
    () => sprints.map((sprint) => ({ label: sprint.name, value: normalizeSprintId(sprint) })),
    [sprints],
  )

  const drawerRequirementsQuery = useQuery({
    queryKey: ['requirements', 'drawer', drawerSprintId],
    queryFn: () => api.getRequirements(drawerSprintId!),
    enabled: Boolean(drawerSprintId),
  })
  const drawerRequirementOptions = useMemo(
    () => (drawerRequirementsQuery.data ?? []).map((requirement) => ({ label: requirement.name, value: normalizeRequirementId(requirement) })),
    [drawerRequirementsQuery.data],
  )

  const saveCollectionMutation = useMutation({
    mutationFn: (values: CollectionFormValues) => {
      if (!values.requirementId) throw new Error('请选择所属需求')
      const editingCollectionId = editingCollection?.collectionId ?? editingCollection?.collection_id

      if (editingCollectionId && editingCollection) {
        return api.updateApiCollection(editingCollectionId, buildApiCollectionUpdatePayload(editingCollection, values))
      }
      return api.createApiCollection(values.requirementId, {
        name: values.name,
        description: values.summary,
      })
    },
    onSuccess: () => {
      message.success(editingCollection ? 'API测试集已更新' : 'API测试集已创建')
      setDrawerOpen(false)
      setEditingCollection(null)
      setDrawerSprintId(undefined)
      drawerForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['apiCollections'] })
    },
  })

  const deleteCollectionMutation = useMutation({
    mutationFn: (collectionId: string) => api.deleteApiCollection(collectionId),
    onSuccess: () => {
      message.success('API测试集已删除')
      queryClient.invalidateQueries({ queryKey: ['apiCollections'] })
    },
  })

  const runCollectionMutation = useMutation({
    mutationFn: ({ collectionId, environmentId }: { collectionId: string; environmentId: string }) =>
      api.runApiCollection(collectionId, { environmentId }),
    onSuccess: (result) => {
      if (result.status === 'running') {
        message.success('已开始运行，可在API测试集详情查看运行记录')
        return
      }
      message.success('API测试集运行已触发')
    },
    onSettled: () => {
      setRunningCollectionId('')
    },
  })

  const sprintNameMap = useMemo(
    () => new Map(sprints.map((sprint) => [normalizeSprintId(sprint), sprint.name])),
    [sprints],
  )

  const requirementNameMap = useMemo(
    () => new Map(allRequirements.map((requirement) => [normalizeRequirementId(requirement), requirement.name])),
    [allRequirements],
  )

  const requirementSprintMap = useMemo(
    () =>
      new Map(
        allRequirements.map((requirement) => [
          normalizeRequirementId(requirement),
          requirement.sprintId ?? requirement.sprint_id,
        ]),
      ),
    [allRequirements],
  )

  const pagedCollections = useMemo(
    () => collections.slice((page - 1) * pageSize, page * pageSize),
    [collections, page, pageSize],
  )

  function footerRange(total: number, currentPage: number, currentPageSize: number) {
    if (total === 0) return '显示第 0 条 - 第 0 条，共 0 条'
    const start = (currentPage - 1) * currentPageSize + 1
    const end = Math.min(currentPage * currentPageSize, total)
    return `显示第 ${start} 条 - 第 ${end} 条，共 ${total} 条`
  }

  function openCreateDrawer() {
    setEditingCollection(null)
    setDrawerSprintId(resolvedSelectedSprintId)
    drawerForm.setFieldsValue({
      sprintId: resolvedSelectedSprintId,
      requirementId: resolvedSelectedRequirementId,
      name: '',
      summary: '',
    })
    setDrawerOpen(true)
  }

  function openEditDrawer(collection: ApiCollection) {
    const requirementId = collection.requirementId ?? collection.requirement_id
    const sprintId = requirementId ? requirementSprintMap.get(requirementId) : undefined

    setEditingCollection(collection)
    setDrawerSprintId(sprintId)
    drawerForm.setFieldsValue({
      sprintId,
      requirementId,
      name: collection.name,
      summary: collection.description,
    })
    setDrawerOpen(true)
  }

  function handleRunCollection(event: React.MouseEvent<HTMLElement>, collectionId: string) {
    event.stopPropagation()
    if (!resolvedEnvironmentId) {
      message.warning('请先选择运行环境')
      return
    }

    setRunningCollectionId(collectionId)
    runCollectionMutation.mutate({
      collectionId,
      environmentId: resolvedEnvironmentId,
    })
  }

  return (
    <div className="workbench-page api-automation-page">
      <div className="api-automation-content">
        <section className="workbench-panel workbench-board-panel">
          <div className="panel-header api-panel-header">
            <div className="requirement-panel-head">
              <Text strong>API测试集</Text>
              <div className="api-filter-group">
                <div className="api-filter-field">
                  <span className="api-filter-field-label">迭代</span>
                  <Select
                    className="api-filter-select business-filter-select"
                    value={currentSprintSelection === null ? 'all' : resolvedSelectedSprintId ?? 'all'}
                    options={sprintFilterOptions}
                    loading={sprintsQuery.isLoading}
                    placeholder="筛选迭代"
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
                    value={currentRequirementSelection === null ? 'all' : resolvedSelectedRequirementId ?? 'all'}
                    options={requirementFilterOptions}
                    loading={requirementsQuery.isLoading}
                    placeholder="筛选需求"
                    disabled={!resolvedSelectedSprintId && sprints.length === 0}
                    onChange={(value: string) => {
                      selectRequirement(value === 'all' ? null : value)
                      setPage(1)
                    }}
                  />
                </div>
              </div>
            </div>
            <Space size={8}>
              <Button icon={<SettingOutlined />} disabled={!activeProjectId} onClick={() => setEnvironmentDrawerOpen(true)}>
                环境管理
              </Button>
              <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} disabled={!resolvedSelectedRequirementId} onClick={openCreateDrawer}>
                新建API测试集
              </Button>
            </Space>
          </div>

          {sprintsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(sprintsQuery.error)} /> : null}
          {requirementsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(requirementsQuery.error)} /> : null}
          {allRequirementsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(allRequirementsQuery.error)} /> : null}
          {collectionsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(collectionsQuery.error)} /> : null}
          {environmentsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(environmentsQuery.error)} /> : null}

          <div className="api-environment-bar">
            <div className="api-environment-bar-main">
              <div className="api-environment-selector">
                <span className="api-environment-label">当前环境</span>
                <Select
                  className="api-filter-select business-filter-select"
                  value={resolvedEnvironmentId}
                  placeholder="请选择环境"
                  loading={environmentsQuery.isLoading}
                  options={environments.map((environment: ApiEnvironment) => ({
                    label: `${environment.name}${environment.isDefault ? '（启用中）' : ''}`,
                    value: normalizeEnvironmentId(environment),
                  }))}
                  onChange={(value: string) => setSelectedEnvironmentId(value)}
                  disabled={!activeProjectId || environments.length === 0}
                />
              </div>
              <div className="api-environment-summary">
                <span className="api-environment-summary-item">
                  Base URL：{selectedEnvironment?.baseUrl || '-'}
                </span>
                <span className="api-environment-summary-item">
                  变量数：{environmentVarsQuery.data?.length ?? 0}
                </span>
                <span className="api-environment-summary-item">
                  更新时间：{formatTime(pickUpdatedAt(selectedEnvironment))}
                </span>
              </div>
            </div>
            <Button type="link" onClick={() => setEnvironmentDrawerOpen(true)} disabled={!activeProjectId}>
              维护环境与变量
            </Button>
          </div>

          <div className="table-body-scroll sprint-card-scroll">
            {sprintsQuery.isLoading ? (
              <div className="sprint-card-loading">
                <Empty description="迭代加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : !activeProjectId ? (
              <div className="sprint-card-loading">
                <Empty description="请先选择项目" />
              </div>
            ) : collectionsQuery.isLoading ? (
              <div className="sprint-card-loading">
                <Empty description="API测试集加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : collections.length === 0 ? (
              <div className="sprint-card-loading">
                <Empty description="当前需求下暂无API测试集" />
              </div>
            ) : (
              <div className="api-collection-grid">
                {pagedCollections.map((collection) => {
                  const requirementId = collection.requirementId ?? collection.requirement_id
                  const requirementName = requirementId ? requirementNameMap.get(requirementId) ?? requirementId : '-'
                  const sprintIdForCollection = requirementId ? requirementSprintMap.get(requirementId) : undefined
                  const sprintName = sprintIdForCollection ? sprintNameMap.get(sprintIdForCollection) ?? sprintIdForCollection : '-'
                  const collectionId = collection.collectionId ?? collection.collection_id ?? ''

                  return (
                    <Card
                      key={collectionId}
                      hoverable
                      className="sprint-card api-collection-card"
                      bodyStyle={{ padding: 20 }}
                      onClick={() => navigate(`/api-automation/collections/${collectionId}`)}
                    >
                      <div className="api-collection-card-top">
                        <Space size={10}>
                          <Badge status="processing" />
                          <Text strong>{collection.name}</Text>
                        </Space>
                      </div>

                      <Paragraph className="api-collection-description" type="secondary">
                        {collection.description || '暂无API测试集描述'}
                      </Paragraph>

                      <div className="sprint-card-meta api-collection-meta-inline">
                        <span className="sprint-card-label">所属迭代/需求</span>
                        <span className="api-collection-inline-value">
                          {sprintName}/{requirementName}
                        </span>
                      </div>

                      <div className="sprint-card-meta">
                        <span className="sprint-card-label">最近更新</span>
                        <span className="api-collection-inline-value">{formatTime(pickUpdatedAt(collection))}</span>
                      </div>

                      <div
                        className="sprint-card-actions"
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <Tooltip title={resolvedEnvironmentId ? '运行API测试集' : '请先选择环境'}>
                          <Button
                            type="text"
                            shape="circle"
                            icon={<CaretRightOutlined />}
                            aria-label="运行API测试集"
                            disabled={!resolvedEnvironmentId}
                            loading={runningCollectionId === collectionId && runCollectionMutation.isPending}
                            onClick={(event) => handleRunCollection(event, collectionId)}
                          />
                        </Tooltip>
                        <Tooltip title="编辑">
                            <Button
                              type="text"
                              shape="circle"
                              className="action-btn-update"
                              icon={<EditOutlined />}
                            aria-label="编辑API测试集"
                            onClick={(event) => {
                              event.stopPropagation()
                              openEditDrawer(collection)
                            }}
                          />
                        </Tooltip>
                        <Popconfirm title="确认删除该API测试集？" onConfirm={() => deleteCollectionMutation.mutate(collectionId)}>
                          <Tooltip title="删除">
                            <Button
                              danger
                              type="text"
                              shape="circle"
                              className="action-btn-delete"
                              icon={<DeleteOutlined />}
                              aria-label="删除API测试集"
                              loading={deleteCollectionMutation.isPending}
                              onClick={(event) => event.stopPropagation()}
                              onMouseDown={(event) => event.stopPropagation()}
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
            <Text type="secondary">{footerRange(collections.length, page, pageSize)}</Text>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={collections.length}
              showSizeChanger
              onChange={(nextPage, nextPageSize) => {
                setPage(nextPage)
                setPageSize(nextPageSize)
              }}
            />
          </div>
        </section>
      </div>

      <CollectionDrawer
        title={editingCollection ? '编辑API测试集' : '新建API测试集'}
        open={drawerOpen}
        form={drawerForm}
        loading={saveCollectionMutation.isPending}
        error={saveCollectionMutation.error ?? drawerRequirementsQuery.error}
        sprintOptions={drawerSprintOptions}
        requirementOptions={drawerRequirementOptions}
        onSprintChange={(nextSprintId) => {
          setDrawerSprintId(nextSprintId)
          drawerForm.setFieldValue('requirementId', undefined)
        }}
        onClose={() => {
          setDrawerOpen(false)
          setEditingCollection(null)
          setDrawerSprintId(undefined)
          drawerForm.resetFields()
        }}
        onFinish={(values) => saveCollectionMutation.mutate(values)}
      />

      <ApiEnvironmentDrawer
        open={environmentDrawerOpen}
        projectId={activeProjectId}
        currentEnvironmentId={resolvedEnvironmentId}
        onClose={() => setEnvironmentDrawerOpen(false)}
        onSelectEnvironment={setSelectedEnvironmentId}
      />
    </div>
  )
}
