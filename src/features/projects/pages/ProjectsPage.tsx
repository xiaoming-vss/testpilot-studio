import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tooltip,
  Typography,
  message,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useActiveProject } from '@/features/projects/hooks/useActiveProject'
import { RequirementDrawer, type RequirementFormValues } from '@/features/requirements/components/RequirementDrawer'
import { SprintDrawer } from '@/features/projects/components/SprintDrawer'
import { useWorkbenchStore } from '@/features/projects/store/workbench.store'
import { api, type Project, type Requirement, type Sprint } from '@/services/api'
import {
  formatTime,
  getErrorMessage,
  normalizeProjectId,
  normalizeRequirementId,
  normalizeSprintId,
  pickCreatedAt,
  pickEndTime,
  pickStartTime,
  pickUpdatedAt,
  statusTag,
} from '@/utils/format'
import { buildProjectUpdatePayload, buildRequirementUpdatePayload, buildSprintCreatePayload, buildSprintUpdatePayload } from '@/utils/updatePayload'

const { Text, Title } = Typography

type RequirementPoolItem = Requirement & {
  sprintName: string
  sprintIdForCreate: string
}

type PaginationState = {
  projectId?: string
  page: number
}

type RequirementViewState = {
  projectId?: string
  page: number
  selectedSprintId?: string
}

function footerRange(total: number, page: number, pageSize: number) {
  if (total === 0) return '显示第 0 条 - 第 0 条，共 0 条'
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return `显示第 ${start} 条 - 第 ${end} 条，共 ${total} 条`
}

function toPickerValue(value?: string) {
  if (!value) return undefined
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed : undefined
}

export function ProjectsPage() {
  const queryClient = useQueryClient()
  const projectModalOpen = useWorkbenchStore((state) => state.projectModalOpen)
  const editingProject = useWorkbenchStore((state) => state.editingProject)
  const openProjectModal = useWorkbenchStore((state) => state.openProjectModal)
  const closeProjectModal = useWorkbenchStore((state) => state.closeProjectModal)
  const [sprintDrawerOpen, setSprintDrawerOpen] = useState(false)
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null)
  const [requirementDrawerOpen, setRequirementDrawerOpen] = useState(false)
  const [editingRequirement, setEditingRequirement] = useState<RequirementPoolItem | null>(null)
  const [activeBoard, setActiveBoard] = useState<'sprints' | 'requirements'>('sprints')
  const [sprintPagination, setSprintPagination] = useState<PaginationState>({ page: 1 })
  const [sprintPageSize, setSprintPageSize] = useState(10)
  const [requirementView, setRequirementView] = useState<RequirementViewState>({ page: 1 })
  const [requirementPageSize, setRequirementPageSize] = useState(10)
  const [projectForm] = Form.useForm()
  const [sprintForm] = Form.useForm()
  const [requirementForm] = Form.useForm()
  const { activeProjectId, projects, projectsQuery, setActiveProjectId } = useActiveProject()
  const activeProject = useMemo(
    () => projects.find((project) => normalizeProjectId(project) === activeProjectId),
    [activeProjectId, projects],
  )
  const sprintPage = sprintPagination.projectId === activeProjectId ? sprintPagination.page : 1
  const requirementPage = requirementView.projectId === activeProjectId ? requirementView.page : 1
  const selectedRequirementSprintId =
    requirementView.projectId === activeProjectId ? requirementView.selectedSprintId : undefined

  useEffect(() => {
    if (projectModalOpen) {
      projectForm.setFieldsValue(editingProject ?? { name: '', description: '' })
    }
  }, [editingProject, projectForm, projectModalOpen])

  const sprintsQuery = useQuery({
    queryKey: ['sprints', activeProjectId],
    queryFn: () => api.getSprints(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })
  const sprints = sprintsQuery.data ?? []
  const sprintOptions = sprints.map((sprint) => ({ label: sprint.name, value: normalizeSprintId(sprint) }))
  const sprintIds = sprintOptions.map((option) => option.value).join(',')

  const requirementsQuery = useQuery({
    queryKey: ['requirementsPool', activeProjectId, sprintIds],
    queryFn: async () => {
      if (sprints.length === 0) return []
      const requirementGroups = await Promise.all(
        sprints.map(async (sprint) => {
          const sprintId = normalizeSprintId(sprint)
          const requirements = await api.getRequirements(sprintId)
          return requirements.map((requirement) => ({
            ...requirement,
            sprintName: sprint.name,
            sprintIdForCreate: sprintId,
          }))
        }),
      )
      return requirementGroups.flat()
    },
    enabled: Boolean(activeProjectId) && !sprintsQuery.isLoading,
  })
  const requirements = requirementsQuery.data ?? []
  const filteredRequirements = !selectedRequirementSprintId
    ? requirements
    : requirements.filter((requirement) => requirement.sprintIdForCreate === selectedRequirementSprintId)
  const visibleSprints = sprints.slice((sprintPage - 1) * sprintPageSize, sprintPage * sprintPageSize)
  const visibleRequirements = filteredRequirements.slice(
    (requirementPage - 1) * requirementPageSize,
    requirementPage * requirementPageSize,
  )

  const saveProjectMutation = useMutation({
    mutationFn: (values: Pick<Project, 'name' | 'description'>) =>
      editingProject
        ? api.updateProject(normalizeProjectId(editingProject), buildProjectUpdatePayload(editingProject, values))
        : api.createProject(values),
    onSuccess: (project) => {
      message.success(editingProject ? '项目已更新' : '项目已创建')
      closeProjectModal()
      projectForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      if (!editingProject && project) setActiveProjectId(normalizeProjectId(project))
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: api.deleteProject,
    onSuccess: () => {
      message.success('项目已删除')
      setActiveProjectId(undefined)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const saveSprintMutation = useMutation({
    mutationFn: (values: Parameters<typeof buildSprintCreatePayload>[0]) => {
      if (editingSprint) {
        return api.updateSprint(normalizeSprintId(editingSprint), buildSprintUpdatePayload(editingSprint, values))
      }
      return api.createSprint(activeProjectId!, buildSprintCreatePayload(values))
    },
    onSuccess: () => {
      message.success(editingSprint ? '迭代已更新' : '迭代已创建')
      closeSprintDrawer()
      queryClient.invalidateQueries({ queryKey: ['sprints', activeProjectId] })
      queryClient.invalidateQueries({ queryKey: ['requirementsPool', activeProjectId] })
    },
  })

  const deleteSprintMutation = useMutation({
    mutationFn: api.deleteSprint,
    onSuccess: () => {
      message.success('迭代已删除')
      queryClient.invalidateQueries({ queryKey: ['sprints', activeProjectId] })
      queryClient.invalidateQueries({ queryKey: ['requirementsPool', activeProjectId] })
    },
  })

  const saveRequirementMutation = useMutation({
    mutationFn: (values: RequirementFormValues) => {
      if (editingRequirement) {
        return api.updateRequirement(
          normalizeRequirementId(editingRequirement),
          buildRequirementUpdatePayload(editingRequirement, {
            name: values.name,
            description: values.description,
            status: values.status,
          }),
        )
      }

      return api.createRequirement(values.sprintId!, {
        name: values.name,
        description: values.description,
      })
    },
    onSuccess: () => {
      message.success(editingRequirement ? '需求已更新' : '需求已创建')
      closeRequirementDrawer()
      queryClient.invalidateQueries({ queryKey: ['requirementsPool', activeProjectId] })
    },
  })

  const deleteRequirementMutation = useMutation({
    mutationFn: api.deleteRequirement,
    onSuccess: () => {
      message.success('需求已删除')
      queryClient.invalidateQueries({ queryKey: ['requirementsPool', activeProjectId] })
    },
  })

  function openSprintDrawer(sprint?: Sprint) {
    setEditingSprint(sprint ?? null)
    sprintForm.setFieldsValue(
      sprint
        ? {
            ...sprint,
            startTime: toPickerValue(pickStartTime(sprint)),
            endTime: toPickerValue(pickEndTime(sprint)),
          }
        : {
            name: '',
            description: '',
            startTime: undefined,
            endTime: undefined,
          },
    )
    setSprintDrawerOpen(true)
  }

  function closeSprintDrawer() {
    setSprintDrawerOpen(false)
    setEditingSprint(null)
    sprintForm.resetFields()
  }

  function openRequirementDrawer(requirement?: RequirementPoolItem) {
    setEditingRequirement(requirement ?? null)
    requirementForm.setFieldsValue(
      requirement ?? {
        sprintId: sprintOptions[0]?.value,
        name: '',
        description: '',
      },
    )
    setRequirementDrawerOpen(true)
  }

  function closeRequirementDrawer() {
    setRequirementDrawerOpen(false)
    setEditingRequirement(null)
    requirementForm.resetFields()
  }

  function openSprintRequirements(sprintId: string) {
    setActiveBoard('requirements')
    setRequirementView({
      projectId: activeProjectId,
      page: 1,
      selectedSprintId: sprintId,
    })
  }

  return (
    <div className="workbench-page">
      {projectsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(projectsQuery.error)} /> : null}

      {!projectsQuery.isLoading && projects.length === 0 ? (
        <div className="workbench-empty">
          <Empty description="暂无项目，请先新建项目">
            <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} onClick={() => openProjectModal()}>
              新建项目
            </Button>
          </Empty>
        </div>
      ) : (
        <>
          <section className="workbench-project-toolbar">
            <div>
              <Title level={4}>项目概览</Title>
              <Text type="secondary">项目描述：{activeProject?.description || '暂无描述'}</Text>
            </div>
            <Space size={8} className="project-actions">
              <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} onClick={() => openProjectModal()}>
                新建项目
              </Button>
              <Tooltip title="编辑项目">
                <Button type="text" className="action-btn-update" icon={<EditOutlined />} disabled={!activeProject} onClick={() => activeProject && openProjectModal(activeProject)} />
              </Tooltip>
              <Popconfirm
                title="确认删除当前项目？"
                disabled={!activeProjectId}
                onConfirm={() => activeProjectId && deleteProjectMutation.mutate(activeProjectId)}
              >
                <Button danger type="text" className="action-btn-delete" icon={<DeleteOutlined />} disabled={!activeProjectId} loading={deleteProjectMutation.isPending} />
              </Popconfirm>
            </Space>
          </section>

          <div className="workbench-tabs">
            <div className="workbench-board-switcher">
              <Segmented
                value={activeBoard}
                onChange={(value) => setActiveBoard(value as 'sprints' | 'requirements')}
                options={[
                  { label: '迭代', value: 'sprints' },
                  { label: '需求', value: 'requirements' },
                ]}
              />
            </div>

            <section className="workbench-panel workbench-board-panel">
              {activeBoard === 'sprints' ? (
                <>
                  <div className="panel-header">
                    <Text strong>迭代列表</Text>
                    <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} disabled={!activeProjectId} onClick={() => openSprintDrawer()}>
                      新建迭代
                    </Button>
                  </div>
                  {sprintsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(sprintsQuery.error)} /> : null}
                  <div className="table-body-scroll sprint-card-scroll">
                    {sprintsQuery.isLoading ? <div className="sprint-card-loading"><Empty description="迭代加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} /></div> : null}
                    {!sprintsQuery.isLoading && visibleSprints.length === 0 ? <Empty description="暂无迭代" /> : null}
                    {!sprintsQuery.isLoading && visibleSprints.length > 0 ? (
                        <div className="sprint-card-grid sprint-card-grid-workbench">
                        {visibleSprints.map((sprint) => (
                          <Card
                            key={normalizeSprintId(sprint)}
                            hoverable
                            className="sprint-card"
                            bodyStyle={{ padding: 20 }}
                            onClick={() => openSprintRequirements(normalizeSprintId(sprint))}
                          >
                            <div className="sprint-card-head">
                              <div className="sprint-card-title-wrap">
                                <Space size={10}>
                                  {sprint.status === 'completed' ? (
                                    <CheckCircleOutlined className="sprint-icon done" />
                                  ) : (
                                    <RocketOutlined className="sprint-icon running" />
                                  )}
                                  <div className="sprint-card-title">{sprint.name}</div>
                                </Space>
                              </div>
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
                            <div className="sprint-card-actions">
                              <Tooltip title="编辑迭代">
                                <Button
                                  type="text"
                                  shape="circle"
                                  className="action-btn-update"
                                  icon={<EditOutlined />}
                                  aria-label="编辑迭代"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openSprintDrawer(sprint)
                                  }}
                                />
                              </Tooltip>
                              <Popconfirm title="确认删除该迭代？" onConfirm={() => deleteSprintMutation.mutate(normalizeSprintId(sprint))}>
                                <Tooltip title="删除迭代">
                                  <Button
                                    danger
                                    type="text"
                                    shape="circle"
                                    className="action-btn-delete"
                                    icon={<DeleteOutlined />}
                                    aria-label="删除迭代"
                                    loading={deleteSprintMutation.isPending}
                                    onClick={(event) => event.stopPropagation()}
                                  />
                                </Tooltip>
                              </Popconfirm>
                              <Tooltip title="查看需求">
                                <Button
                                  type="text"
                                  shape="circle"
                                  className="action-btn-read"
                                  icon={<FileTextOutlined />}
                                  aria-label="查看需求"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openSprintRequirements(normalizeSprintId(sprint))
                                  }}
                                />
                              </Tooltip>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="table-footer">
                    <Text type="secondary">{footerRange(sprints.length, sprintPage, sprintPageSize)}</Text>
                    <Pagination
                      current={sprintPage}
                      pageSize={sprintPageSize}
                      total={sprints.length}
                      showSizeChanger
                      onChange={(page, pageSize) => {
                        setSprintPagination({ projectId: activeProjectId, page })
                        setSprintPageSize(pageSize)
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="panel-header">
                    <div className="requirement-panel-head">
                      <Text strong>需求列表</Text>
                      <div className="requirement-filter-bar">
                        <span className="requirement-filter-label">迭代范围</span>
                        <div className="requirement-filter-control">
                          <Select
                            className="requirement-filter-select"
                            loading={sprintsQuery.isLoading}
                            value={selectedRequirementSprintId}
                            placeholder="筛选迭代"
                            allowClear
                            options={sprintOptions}
                            onChange={(value) => {
                              setRequirementView({
                                projectId: activeProjectId,
                                page: 1,
                                selectedSprintId: value,
                              })
                            }}
                            variant="borderless"
                            disabled={sprints.length === 0}
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      type="primary"
                      className="action-btn-create"
                      icon={<PlusOutlined />}
                      disabled={!activeProjectId || sprints.length === 0}
                      onClick={() => openRequirementDrawer()}
                    >
                      新建需求
                    </Button>
                  </div>
                  {requirementsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(requirementsQuery.error)} /> : null}
                  <div className="table-body-scroll sprint-card-scroll">
                    {sprintsQuery.isLoading || requirementsQuery.isLoading ? (
                      <div className="sprint-card-loading">
                        <Empty description="需求加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      </div>
                    ) : null}
                    {!sprintsQuery.isLoading && !requirementsQuery.isLoading && sprints.length === 0 ? (
                      <Empty description="请先创建迭代，再添加需求" />
                    ) : null}
                    {!sprintsQuery.isLoading && !requirementsQuery.isLoading && sprints.length > 0 && visibleRequirements.length === 0 ? (
                      <Empty description="暂无需求" />
                    ) : null}
                    {!sprintsQuery.isLoading && !requirementsQuery.isLoading && visibleRequirements.length > 0 ? (
                      <div className="sprint-card-grid sprint-card-grid-workbench">
                        {visibleRequirements.map((requirement) => (
                          <Card key={normalizeRequirementId(requirement)} hoverable className="sprint-card" bodyStyle={{ padding: 20 }}>
                            <div className="sprint-card-head">
                              <div className="sprint-card-title-wrap">
                                <Space size={10}>
                                  <FileTextOutlined className="requirement-icon" />
                                  <div className="sprint-card-title">{requirement.name}</div>
                                </Space>
                              </div>
                              <div className="sprint-card-status">{statusTag(requirement.status)}</div>
                            </div>
                            <div className="sprint-card-meta">
                              <span className="sprint-card-label">所属迭代</span>
                              <span className="requirement-sprint">{requirement.sprintName}</span>
                            </div>
                            <div className="sprint-card-meta">
                              <span className="sprint-card-label">创建时间</span>
                              <span className="sprint-card-value">{formatTime(pickCreatedAt(requirement))}</span>
                            </div>
                            <div className="sprint-card-meta">
                              <span className="sprint-card-label">更新时间</span>
                              <span className="sprint-card-value">{formatTime(pickUpdatedAt(requirement))}</span>
                            </div>
                            <div className="sprint-card-description">{requirement.description || '暂无需求描述'}</div>
                            <div className="sprint-card-actions">
                              <Tooltip title="编辑需求">
                                <Button
                                  type="text"
                                  shape="circle"
                                  className="action-btn-update"
                                  icon={<EditOutlined />}
                                  aria-label="编辑需求"
                                  onClick={() => openRequirementDrawer(requirement)}
                                />
                              </Tooltip>
                              <Popconfirm title="确认删除该需求？" onConfirm={() => deleteRequirementMutation.mutate(normalizeRequirementId(requirement))}>
                                <Tooltip title="删除需求">
                                  <Button
                                    danger
                                    type="text"
                                    shape="circle"
                                    className="action-btn-delete"
                                    icon={<DeleteOutlined />}
                                    aria-label="删除需求"
                                    loading={deleteRequirementMutation.isPending}
                                  />
                                </Tooltip>
                              </Popconfirm>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="table-footer">
                    <Text type="secondary">{footerRange(filteredRequirements.length, requirementPage, requirementPageSize)}</Text>
                    <Pagination
                      current={requirementPage}
                      pageSize={requirementPageSize}
                      total={filteredRequirements.length}
                      showSizeChanger
                      onChange={(page, pageSize) => {
                        setRequirementView({
                          projectId: activeProjectId,
                          page,
                          selectedSprintId: selectedRequirementSprintId,
                        })
                        setRequirementPageSize(pageSize)
                      }}
                    />
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      )}

      <Modal
        title={editingProject ? '编辑项目' : '新建项目'}
        open={projectModalOpen}
        onCancel={closeProjectModal}
        onOk={() => projectForm.submit()}
        confirmLoading={saveProjectMutation.isPending}
      >
        {saveProjectMutation.error ? <Alert showIcon type="error" message={getErrorMessage(saveProjectMutation.error)} /> : null}
        <Form form={projectForm} layout="vertical" onFinish={(values) => saveProjectMutation.mutate(values)} requiredMark={false}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea maxLength={256} rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <SprintDrawer
        title={editingSprint ? '编辑迭代' : '新建迭代'}
        open={sprintDrawerOpen}
        form={sprintForm}
        loading={saveSprintMutation.isPending}
        error={saveSprintMutation.error}
        mode={editingSprint ? 'edit' : 'create'}
        onClose={closeSprintDrawer}
        onFinish={(values) => saveSprintMutation.mutate(values)}
      />

      <RequirementDrawer
        title={editingRequirement ? '编辑需求' : '新建需求'}
        open={requirementDrawerOpen}
        form={requirementForm}
        loading={saveRequirementMutation.isPending}
        error={saveRequirementMutation.error}
        mode={editingRequirement ? 'edit' : 'create'}
        sprintOptions={editingRequirement ? undefined : sprintOptions}
        onClose={closeRequirementDrawer}
        onFinish={(values) => saveRequirementMutation.mutate(values)}
      />
    </div>
  )
}
