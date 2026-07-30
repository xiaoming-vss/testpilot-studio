import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Badge, Button, Card, Empty, Form, Pagination, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api, listItems, type CreateLlmConnectionPayload, type UpdateLlmConnectionPayload, type LlmConnection } from '@/services/api'
import { message } from '@/shared/utils/feedback'
import { formatTime, getErrorMessage } from '@/utils/format'
import { LlmConnectionDetailDrawer } from './LlmConnectionDetailDrawer'
import { LlmConnectionDrawer, type LlmConnectionFormValues } from './LlmConnectionDrawer'

const { Paragraph, Text, Title } = Typography

function getConnectionStatusMeta(status?: string) {
  switch (status) {
    case 'active':
      return { color: 'success' as const, label: '正常', badgeStatus: 'success' as const }
    case 'auth_failed':
      return { color: 'error' as const, label: '异常', badgeStatus: 'error' as const }
    case 'disabled':
      return { color: 'default' as const, label: '已停用', badgeStatus: 'default' as const }
    default:
      return { color: 'default' as const, label: status || '-', badgeStatus: 'default' as const }
  }
}

function footerRange(total: number, page: number, pageSize: number) {
  if (total === 0) return '显示第 0 条 - 第 0 条，共 0 条'
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return `显示第 ${start} 条 - 第 ${end} 条，共 ${total} 条`
}

function buildCreatePayload(values: LlmConnectionFormValues): CreateLlmConnectionPayload {
  return {
    name: values.name.trim(),
    baseUrl: values.baseUrl.trim(),
    modelId: values.modelId.trim(),
    apiKey: values.apiKey?.trim() ?? '',
  }
}

function buildUpdatePayload(current: LlmConnection, values: LlmConnectionFormValues): UpdateLlmConnectionPayload {
  const payload: UpdateLlmConnectionPayload = {}
  const nextName = values.name.trim()
  const nextBaseUrl = values.baseUrl.trim()
  const nextModelId = values.modelId.trim()
  const nextApiKey = values.apiKey?.trim()

  if (current.name !== nextName) payload.name = nextName
  if (current.baseUrl !== nextBaseUrl) payload.baseUrl = nextBaseUrl
  if ((current.modelId ?? '') !== nextModelId) payload.modelId = nextModelId
  if (nextApiKey) payload.apiKey = nextApiKey

  return payload
}

export function LlmConnectionsPanel({ projectId }: { projectId?: string }) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(18)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<LlmConnection | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailConnectionId, setDetailConnectionId] = useState('')
  const [form] = Form.useForm<LlmConnectionFormValues>()

  const connectionsQuery = useQuery({
    queryKey: ['llmConnections', projectId],
    queryFn: () => api.getLlmConnections(projectId!),
    enabled: Boolean(projectId),
  })

  const detailQuery = useQuery({
    queryKey: ['llmConnection', projectId, detailConnectionId],
    queryFn: () => api.getLlmConnection(projectId!, detailConnectionId),
    enabled: detailOpen && Boolean(projectId) && Boolean(detailConnectionId),
  })

  const connections = useMemo(
    () =>
      [...listItems(connectionsQuery.data)].sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || '').getTime()
        const rightTime = new Date(right.updatedAt || right.createdAt || '').getTime()
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
      }),
    [connectionsQuery.data],
  )
  const pagedConnections = useMemo(
    () => connections.slice((page - 1) * pageSize, page * pageSize),
    [connections, page, pageSize],
  )
  const shouldFillPageGrid = pageSize === 18 && pagedConnections.length === 18

  const saveMutation = useMutation({
    mutationFn: (values: LlmConnectionFormValues) => {
      if (!projectId) throw new Error('请先选择项目')
      if (editingConnection) {
        const payload = buildUpdatePayload(editingConnection, values)
        if (Object.keys(payload).length === 0) {
          return Promise.resolve(editingConnection)
        }
        return api.updateLlmConnection(projectId, editingConnection.connectionId, payload)
      }
      return api.createLlmConnection(projectId, buildCreatePayload(values))
    },
    onSuccess: (connection) => {
      const isEditing = Boolean(editingConnection)
      const hasChanges = !editingConnection || Object.keys(buildUpdatePayload(editingConnection, form.getFieldsValue())).length > 0
      message.success(isEditing ? (hasChanges ? 'LLM 连接已更新' : '未检测到变更') : 'LLM 连接已创建')
      queryClient.invalidateQueries({ queryKey: ['llmConnections', projectId] })
      queryClient.setQueryData(['llmConnection', projectId, connection.connectionId], connection)
      setDrawerOpen(false)
      setEditingConnection(null)
      form.resetFields()
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (connectionId: string) => {
      if (!projectId) throw new Error('请先选择项目')
      return api.deleteLlmConnection(projectId, connectionId)
    },
    onSuccess: (_, connectionId) => {
      message.success('LLM 连接已删除')
      queryClient.invalidateQueries({ queryKey: ['llmConnections', projectId] })
      queryClient.removeQueries({ queryKey: ['llmConnection', projectId, connectionId], exact: true })
      if (detailConnectionId === connectionId) {
        setDetailOpen(false)
        setDetailConnectionId('')
      }
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  function openCreateDrawer() {
    setEditingConnection(null)
    form.setFieldsValue({
      name: '',
      baseUrl: '',
      modelId: '',
      apiKey: '',
    })
    setDrawerOpen(true)
  }

  function openEditDrawer(connection: LlmConnection) {
    setEditingConnection(connection)
    form.setFieldsValue({
      name: connection.name,
      baseUrl: connection.baseUrl,
      modelId: connection.modelId ?? '',
      apiKey: '',
    })
    setDrawerOpen(true)
  }

  function openDetailDrawer(connectionId: string) {
    setDetailConnectionId(connectionId)
    setDetailOpen(true)
  }

  return (
    <>
      <div className="panel-header api-panel-header">
        <div className="requirement-panel-head">
          <Text strong>LLM 连接</Text>
        </div>
        <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} disabled={!projectId} onClick={openCreateDrawer}>
          新建 LLM 连接
        </Button>
      </div>

      {!projectId ? (
        <Alert showIcon type="info" title="请先选择项目" className="base-services-integration-alert" />
      ) : null}

      {connectionsQuery.error ? (
        <Alert showIcon type="error" title={getErrorMessage(connectionsQuery.error)} className="base-services-integration-alert" />
      ) : null}

      <div className="base-services-connection-shell">
        {connections.length > 0 && connections.some((item) => item.status === 'auth_failed') ? (
          <Alert
            showIcon
            type="warning"
            className="base-services-integration-alert"
            title="存在状态异常的 LLM 连接"
            description="请优先检查异常连接，并使用「编辑」更新连接配置。"
          />
        ) : null}

        <div className="table-body-scroll sprint-card-scroll base-services-card-scroll">
          {connectionsQuery.isLoading ? (
            <div className="sprint-card-loading">
              <Empty description="LLM 连接加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : connections.length === 0 ? (
            <div className="base-services-empty-card base-services-empty-card-list">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div className="base-services-empty-copy">
                    <Title level={5}>还没有 LLM 连接</Title>
                    <Text>先创建一个 LLM 连接，用于后续 AI 测试等能力。</Text>
                  </div>
                }
              />
            </div>
          ) : (
            <div className={`api-collection-grid base-services-connection-grid${shouldFillPageGrid ? ' base-services-grid-fill-page' : ''}`}>
              {pagedConnections.map((connection) => {
                const statusMeta = getConnectionStatusMeta(connection.status)
                const loadingDelete = deleteMutation.isPending && deleteMutation.variables === connection.connectionId

                return (
                  <Card
                    key={connection.connectionId}
                    className="sprint-card api-collection-card base-services-connection-card"
                    styles={{ body: { padding: 20 } }}
                  >
                    <div className="api-collection-card-top base-services-connection-head">
                      <Space size={10} className="base-services-connection-title-wrap">
                        <Badge status={statusMeta.badgeStatus} />
                        <Text strong className="base-services-connection-title">
                          {connection.name}
                        </Text>
                      </Space>
                      <Space size={8} wrap>
                        <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                      </Space>
                    </div>

                    <Paragraph className="api-collection-description base-services-connection-url">
                      {connection.baseUrl || '暂无请求地址'}
                    </Paragraph>

                    <div className="sprint-card-meta api-collection-meta-inline">
                      <span className="sprint-card-label">模型 ID</span>
                      <span className="api-collection-inline-value">{connection.modelId || '-'}</span>
                    </div>

                    <div className="sprint-card-meta">
                      <span className="sprint-card-label">状态</span>
                      <span className="api-collection-inline-value">{statusMeta.label}</span>
                    </div>
                    <div className="sprint-card-meta">
                      <span className="sprint-card-label">创建时间</span>
                      <span className="api-collection-inline-value">{formatTime(connection.createdAt)}</span>
                    </div>

                    <div className="sprint-card-actions base-services-connection-actions">
                      <Tooltip title="查看详情">
                        <Button
                          type="text"
                          shape="circle"
                          className="action-btn-read"
                          icon={<EyeOutlined />}
                          aria-label="查看详情"
                          onClick={() => openDetailDrawer(connection.connectionId)}
                        />
                      </Tooltip>
                      <Tooltip title="编辑">
                        <Button
                          type="text"
                          shape="circle"
                          className="action-btn-update"
                          icon={<EditOutlined />}
                          aria-label="编辑 LLM 连接"
                          onClick={() => openEditDrawer(connection)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="确认删除该 LLM 连接？"
                        description="删除后将无法继续使用该连接。"
                        onConfirm={() => deleteMutation.mutate(connection.connectionId)}
                      >
                        <Tooltip title="删除">
                          <Button
                            danger
                            type="text"
                            shape="circle"
                            className="action-btn-delete"
                            icon={<DeleteOutlined />}
                            aria-label="删除 LLM 连接"
                            loading={loadingDelete}
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
          <Text type="secondary">{footerRange(connections.length, page, pageSize)}</Text>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={connections.length}
            showSizeChanger
            pageSizeOptions={['18', '24', '30', '36', '48', '60']}
            onChange={(nextPage, nextPageSize) => {
              setPage(nextPage)
              setPageSize(nextPageSize)
            }}
          />
        </div>
      </div>

      <LlmConnectionDrawer
        title={editingConnection ? '编辑 LLM 连接' : '新建 LLM 连接'}
        open={drawerOpen}
        form={form}
        loading={saveMutation.isPending}
        error={saveMutation.error}
        mode={editingConnection ? 'edit' : 'create'}
        onClose={() => {
          setDrawerOpen(false)
          setEditingConnection(null)
          form.resetFields()
        }}
        onFinish={(values) => saveMutation.mutate(values)}
      />

      <LlmConnectionDetailDrawer
        open={detailOpen}
        loading={detailQuery.isLoading}
        error={detailQuery.error}
        connection={detailQuery.data}
        onClose={() => {
          setDetailOpen(false)
          setDetailConnectionId('')
        }}
      />
    </>
  )
}
